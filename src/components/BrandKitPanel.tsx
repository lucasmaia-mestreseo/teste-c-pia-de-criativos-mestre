import { useEffect, useState, useRef } from 'react';
import { useBrandKit, useUpsertBrandKit } from '@/hooks/useBrandKit';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, X, Upload, Save, Loader2, Globe, Image, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import ColorPickerWithHex from '@/components/ColorPickerWithHex';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BrandKitPanelProps {
  projectId: string | null;
}

export default function BrandKitPanel({ projectId }: BrandKitPanelProps) {
  const { data: kit, isLoading } = useBrandKit(projectId);
  const upsert = useUpsertBrandKit();

  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [auxColors, setAuxColors] = useState<string[]>([]);
  const [typography, setTypography] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [peoplePhotos, setPeoplePhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [extracting, setExtracting] = useState(false);

  const [pendingExtraction, setPendingExtraction] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const peoplePhotoInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (kit) {
      setPrimaryColor(kit.primary_color ?? '');
      setSecondaryColor(kit.secondary_color ?? '');
      setBackgroundColor(kit.background_color ?? '');
      setAuxColors(kit.aux_colors ?? []);
      setTypography(kit.typography ?? '');
      setLogoUrl(kit.logo_url ?? '');
      setPhotos(kit.photos ?? []);
      setPeoplePhotos(kit.people_photos ?? []);
    } else {
      setPrimaryColor('');
      setSecondaryColor('');
      setBackgroundColor('');
      setAuxColors([]);
      setTypography('');
      setLogoUrl('');
      setPhotos([]);
      setPeoplePhotos([]);
    }
  }, [kit]);

  const hasExistingData = primaryColor || secondaryColor || backgroundColor || auxColors.length > 0 || typography;

  const applyExtraction = (data: any, mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      if (data.primary_color) setPrimaryColor(data.primary_color);
      if (data.secondary_color) setSecondaryColor(data.secondary_color);
      if (data.background_color) setBackgroundColor(data.background_color);
      if (data.aux_colors?.length) setAuxColors(data.aux_colors);
      if (data.typography) setTypography(data.typography);
    } else {
      if (data.primary_color && !primaryColor) setPrimaryColor(data.primary_color);
      if (data.secondary_color && !secondaryColor) setSecondaryColor(data.secondary_color);
      if (data.background_color && !backgroundColor) setBackgroundColor(data.background_color);
      if (data.aux_colors?.length) setAuxColors(prev => [...new Set([...prev, ...data.aux_colors])]);
      if (data.typography && !typography) setTypography(data.typography);
    }
  };

  const handleExtraction = async (body: Record<string, any>) => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-branding', { body });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (hasExistingData) {
        setPendingExtraction(data);
        setShowConfirm(true);
      } else {
        applyExtraction(data, 'replace');
        toast.success('Branding extraído com sucesso!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair branding');
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractFromUrl = () => {
    if (!siteUrl.trim()) return;
    handleExtraction({ url: siteUrl.trim() });
  };

  const handleScreenshotUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      handleExtraction({ image: base64 });
    };
    reader.readAsDataURL(file);
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file, 'logos', projectId!);
      setLogoUrl(url);
      toast.success('Logo enviada');
    } catch { toast.error('Erro ao enviar logo'); }
    finally { setUploading(false); }
  };

  const handlePhotoUpload = async (files: FileList, type: 'general' | 'people') => {
    setUploading(true);
    try {
      const bucket = type === 'people' ? 'people-photos' : 'brand-photos';
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, bucket, projectId!);
        urls.push(url);
      }
      if (type === 'people') {
        setPeoplePhotos(prev => [...prev, ...urls]);
      } else {
        setPhotos(prev => [...prev, ...urls]);
      }
      toast.success('Fotos enviadas');
    } catch { toast.error('Erro ao enviar fotos'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!projectId) return;
    try {
      await upsert.mutateAsync({
        project_id: projectId,
        primary_color: primaryColor || undefined,
        secondary_color: secondaryColor || undefined,
        background_color: backgroundColor || undefined,
        aux_colors: auxColors,
        typography: typography || undefined,
        logo_url: logoUrl || undefined,
        photos,
        people_photos: peoplePhotos,
      });
      toast.success('Brand Kit salvo!');
    } catch { toast.error('Erro ao salvar'); }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Selecione um projeto</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dados já preenchidos</AlertDialogTitle>
            <AlertDialogDescription>
              Já existem cores e tipografia no Brand Kit. Deseja substituir tudo ou mesclar com os dados atuais?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingExtraction(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { applyExtraction(pendingExtraction, 'merge'); setPendingExtraction(null); setShowConfirm(false); toast.success('Dados mesclados!'); }}>
              Mesclar
            </AlertDialogAction>
            <AlertDialogAction onClick={() => { applyExtraction(pendingExtraction, 'replace'); setPendingExtraction(null); setShowConfirm(false); toast.success('Dados substituídos!'); }}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Brand Kit</h2>
        <Button onClick={handleSave} disabled={upsert.isPending} size="sm">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Extract from URL or Screenshot */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Extrair branding</Label>
        <div className="flex gap-2">
          <Input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://exemplo.com.br"
            className="bg-secondary flex-1"
          />
          <Button variant="outline" size="sm" onClick={handleExtractFromUrl} disabled={extracting || !siteUrl.trim()} className="shrink-0">
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            <span className="ml-1">URL</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => screenshotInputRef.current?.click()} disabled={extracting} className="shrink-0">
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
            <span className="ml-1">Screenshot</span>
          </Button>
        </div>
        <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleScreenshotUpload(e.target.files[0])} />
        <p className="text-xs text-muted-foreground">Cole uma URL ou envie um screenshot para a IA extrair cores e tipografia</p>
      </div>

      {/* Categorized Colors */}
      <div className="space-y-3">
        <Label className="text-xs uppercase text-muted-foreground">Cores da Marca</Label>
        <div className="grid grid-cols-3 gap-3">
          <ColorPickerWithHex label="Primária" value={primaryColor} onChange={setPrimaryColor} />
          <ColorPickerWithHex label="Secundária" value={secondaryColor} onChange={setSecondaryColor} />
          <ColorPickerWithHex label="Fundo" value={backgroundColor} onChange={setBackgroundColor} />
        </div>

        {/* Auxiliary colors */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium">Auxiliares</span>
          <div className="flex flex-wrap gap-2">
            {auxColors.map((c, i) => (
              <div key={i} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-1">
                <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: c }} />
                <Input
                  value={c}
                  onChange={(e) => {
                    const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                    const updated = [...auxColors];
                    updated[i] = v;
                    setAuxColors(updated);
                  }}
                  className="bg-transparent border-0 h-5 text-xs font-mono w-20 p-0 focus-visible:ring-0"
                  maxLength={7}
                />
                <button onClick={() => setAuxColors(auxColors.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="color"
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                onChange={(e) => setAuxColors([...auxColors, e.target.value])}
              />
              <span className="text-xs text-muted-foreground">Adicionar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Tipografia</Label>
        <Input value={typography} onChange={(e) => setTypography(e.target.value)} placeholder="Ex: Montserrat, Roboto" className="bg-secondary" />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Logo</Label>
        {logoUrl ? (
          <div className="relative inline-block">
            <img src={logoUrl} alt="Logo" className="h-16 object-contain rounded border border-border bg-secondary p-2" />
            <button onClick={() => setLogoUrl('')} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> Enviar Logo
          </Button>
        )}
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
      </div>

      {/* General Photos */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Fotos Gerais</Label>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative group">
              <img src={p} alt="" className="aspect-square object-cover rounded border border-border" />
              <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button onClick={() => photoInputRef.current?.click()} className="aspect-square rounded border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors" disabled={uploading}>
            <Plus className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handlePhotoUpload(e.target.files, 'general')} />
      </div>

      {/* People Photos */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Fotos de Pessoas</Label>
        <div className="grid grid-cols-3 gap-2">
          {peoplePhotos.map((p, i) => (
            <div key={i} className="relative group">
              <img src={p} alt="" className="aspect-square object-cover rounded border border-border" />
              <button onClick={() => setPeoplePhotos(peoplePhotos.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button onClick={() => peoplePhotoInputRef.current?.click()} className="aspect-square rounded border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors" disabled={uploading}>
            <Plus className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <input ref={peoplePhotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handlePhotoUpload(e.target.files, 'people')} />
      </div>
    </div>
  );
}
