import { useEffect, useState, useRef } from 'react';
import { useBrandKit, useUpsertBrandKit } from '@/hooks/useBrandKit';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, X, Upload, Save, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface BrandKitPanelProps {
  projectId: string | null;
}

export default function BrandKitPanel({ projectId }: BrandKitPanelProps) {
  const { data: kit, isLoading } = useBrandKit(projectId);
  const upsert = useUpsertBrandKit();
  const [colors, setColors] = useState<string[]>([]);
  const [typography, setTypography] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (kit) {
      setColors(kit.colors ?? []);
      setTypography(kit.typography ?? '');
      setLogoUrl(kit.logo_url ?? '');
      setPhotos(kit.photos ?? []);
    } else {
      setColors([]);
      setTypography('');
      setLogoUrl('');
      setPhotos([]);
    }
  }, [kit]);

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

  const handlePhotoUpload = async (files: FileList) => {
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, 'brand-photos', projectId!);
        urls.push(url);
      }
      setPhotos(prev => [...prev, ...urls]);
      toast.success('Fotos enviadas');
    } catch { toast.error('Erro ao enviar fotos'); }
    finally { setUploading(false); }
  };

  const handleExtractFromUrl = async () => {
    if (!siteUrl.trim()) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-branding', {
        body: { url: siteUrl.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.colors?.length) setColors(prev => [...prev, ...data.colors]);
      if (data.typography) setTypography(data.typography);
      toast.success('Branding extraído com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao extrair branding');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!projectId) return;
    try {
      await upsert.mutateAsync({
        project_id: projectId,
        colors,
        typography: typography || undefined,
        logo_url: logoUrl || undefined,
        photos,
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Brand Kit</h2>
        <Button onClick={handleSave} disabled={upsert.isPending} size="sm">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Extract from URL */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Extrair de um site</Label>
        <div className="flex gap-2">
          <Input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://exemplo.com.br"
            className="bg-secondary flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtractFromUrl}
            disabled={extracting || !siteUrl.trim()}
            className="shrink-0"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            <span className="ml-1">{extracting ? 'Extraindo...' : 'Extrair'}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">A IA vai analisar o site e preencher cores e tipografia automaticamente</p>
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Cores da Marca</Label>
        <div className="flex flex-wrap gap-2">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-1">
              <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: c }} />
              <span className="text-xs">{c}</span>
              <button onClick={() => setColors(colors.filter((_, j) => j !== i))}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="color"
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              onChange={(e) => setColors([...colors, e.target.value])}
            />
            <span className="text-xs text-muted-foreground">Adicionar</span>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Tipografia</Label>
        <Input
          value={typography}
          onChange={(e) => setTypography(e.target.value)}
          placeholder="Ex: Montserrat, Roboto"
          className="bg-secondary"
        />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Logo</Label>
        {logoUrl ? (
          <div className="relative inline-block">
            <img src={logoUrl} alt="Logo" className="h-16 object-contain rounded border bg-secondary p-2" />
            <button
              onClick={() => setLogoUrl('')}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground"
            >
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

      {/* Photos */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Fotos da Marca</Label>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative group">
              <img src={p} alt="" className="aspect-square object-cover rounded border" />
              <button
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => photoInputRef.current?.click()}
            className="aspect-square rounded border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors"
            disabled={uploading}
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)} />
      </div>
    </div>
  );
}
