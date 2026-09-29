import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColorPickerWithHex from '@/components/ColorPickerWithHex';
import { AlertTriangle, ArrowLeft, Check, Crosshair, Info, Plus, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ManualSpec, PaletteColor } from '@/kv/spec';
import { buildTokens } from '@/kv/fillTemplate';
import { contrast } from '@/kv/color';
import { loadPreviewFont, POPULAR_FONTS, WEB_SAFE_FONTS } from '@/kv/fonts';
import { monoVariant, type Box } from '@/kv/imageTools';
import type { LogoSet, PhotoCandidate } from '@/kv/pipeline';

interface Props {
  spec: ManualSpec;
  onSpecChange: (s: ManualSpec) => void;
  logoSet: LogoSet | null;
  photos: PhotoCandidate[];
  selectedPhotos: string[];
  onSelectedPhotosChange: (ids: string[]) => void;
  onPhotoFocus: (id: string, foco: { x: number; y: number }) => void;
  vectorizeLogos: boolean;
  onVectorizeChange: (v: boolean) => void;
  onBack: () => void;
  onApprove: () => void;
  building: boolean;
  symbolBox?: Box;
}

export default function KvReviewStep(p: Props) {
  const { spec } = p;
  const update = (fn: (draft: ManualSpec) => void) => {
    const next = structuredClone(spec);
    fn(next);
    p.onSpecChange(next);
  };
  const tk = useMemo(() => buildTokens(spec), [spec]);

  useEffect(() => {
    void loadPreviewFont(spec.tipografia.primaria);
    if (spec.tipografia.secundaria) void loadPreviewFont(spec.tipografia.secundaria);
  }, [spec.tipografia.primaria, spec.tipografia.secundaria]);

  // live logo variants (PNG) for the preview
  const logos = useMemo(() => {
    if (!p.logoSet) return null;
    const url = (c?: HTMLCanvasElement) => c?.toDataURL('image/png');
    return {
      cor: url(p.logoSet.cor),
      branco: url(monoVariant(p.logoSet.cor, '#FFFFFF')),
      navy: url(monoVariant(p.logoSet.cor, tk.brand900)),
      apoio: url(monoVariant(p.logoSet.cor, tk.brand600)),
      preto: url(monoVariant(p.logoSet.cor, '#111111')),
      simbolo: url(p.logoSet.simbolo),
    };
  }, [p.logoSet, tk.brand900, tk.brand600]);

  const ctaWhite = contrast('#FFFFFF', tk.accent700);

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border bg-gradient-to-br from-card to-secondary/40 p-5 grid md:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="space-y-2">
          <Input value={spec.marca} onChange={(e) => update((d) => { d.marca = e.target.value; })}
            className="text-2xl font-bold h-auto py-1 px-2 -ml-2 border-transparent bg-transparent hover:border-border focus-visible:border-border" />
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <Summary label="Direção visual" value={spec.resumo.direcaoVisual} />
            <Summary label="Tom de voz" value={spec.resumo.tomDeVoz} />
            <Summary label="Público" value={spec.resumo.publico} />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[tk.brand950, tk.brand900, tk.brand600, tk.accent700, tk.brand200, tk.brand050].map((c, i) => (
            <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * i }}
              className="h-12 w-8 rounded-md shadow-inner border border-white/10" style={{ background: c }} title={c} />
          ))}
        </div>
      </motion.div>

      {(spec.inferencias.length > 0 || spec.pendencias.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {spec.inferencias.length > 0 && (
            <Notice icon={<Info className="h-4 w-4" />} tone="info" title="O que a IA inferiu (confira)">
              {spec.inferencias.map((t, i) => <li key={i}>{t}</li>)}
            </Notice>
          )}
          {spec.pendencias.length > 0 && (
            <Notice icon={<AlertTriangle className="h-4 w-4" />} tone="warn" title="Pendências para pedir ao cliente">
              {spec.pendencias.map((t, i) => <li key={i}>{t}</li>)}
            </Notice>
          )}
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Cores */}
        <Section title="Cores" subtitle="Papéis da paleta. Os tons derivados são calculados a partir destas cores.">
          <div className="grid sm:grid-cols-3 gap-4">
            {(['principal', 'apoio', 'acento'] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <ColorPickerWithHex label={{ principal: 'Principal (domina)', apoio: 'Apoio', acento: 'Acento / CTA' }[k]}
                  value={spec.cores[k].hex} onChange={(v) => update((d) => { d.cores[k].hex = v.toUpperCase(); })} />
                <Input value={spec.cores[k].nome} onChange={(e) => update((d) => { d.cores[k].nome = e.target.value; })}
                  className="h-7 text-xs bg-secondary" placeholder="Nome da cor" />
              </div>
            ))}
          </div>
          <div className={cn('text-[11px] rounded-md px-2.5 py-1.5 flex items-center gap-2', ctaWhite >= 4.5 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: tk.accent700, color: tk.ctaInk }}>CTA</span>
            Texto do botão: {tk.ctaInk === '#FFFFFF' ? 'branco' : 'escuro'} · contraste {tk.ctaRatio.toFixed(1)}:1
            {ctaWhite < 4.5 && ' (branco reprova — o manual usa texto escuro)'}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Paleta oficial (p.09)</span>
              {spec.cores.paleta.length < 8 && (
                <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1"
                  onClick={() => update((d) => { d.cores.paleta.push({ hex: '#CCCCCC', nome: 'Nova cor', uso: '' }); })}>
                  <Plus className="h-3 w-3" /> cor
                </Button>
              )}
            </div>
            {spec.cores.paleta.length === 0 && <p className="text-[11px] text-muted-foreground">Sem paleta extra: o manual mostra as 4 cores principais.</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {spec.cores.paleta.map((c, i) => (
                <PaletteRow key={i} c={c}
                  onChange={(nc) => update((d) => { d.cores.paleta[i] = nc; })}
                  onRemove={() => update((d) => { d.cores.paleta.splice(i, 1); })} />
              ))}
            </div>
          </div>
          <Field label="Nota de cores (p.09)">
            <Textarea value={spec.cores.nota} onChange={(e) => update((d) => { d.cores.nota = e.target.value; })} className="min-h-[60px] text-xs bg-secondary" />
          </Field>
        </Section>

        {/* Tipografia */}
        <Section title="Tipografia" subtitle="Famílias do Google Fonts; as auxiliares substituem em e-mail e Office.">
          <div className="grid sm:grid-cols-2 gap-4">
            {(['primaria', 'secundaria'] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">{k === 'primaria' ? 'Primária' : 'Secundária'}</span>
                <Input list="kv-fonts" value={spec.tipografia[k]} onChange={(e) => update((d) => { d.tipografia[k] = e.target.value; })} className="h-8 text-xs bg-secondary" />
                <div className="rounded-lg border bg-background p-3 leading-tight" style={{ fontFamily: `"${spec.tipografia[k]}", sans-serif` }}>
                  <div className="text-2xl font-bold">Aa Bb 123</div>
                  <div className="text-xs text-muted-foreground mt-1">{spec.headlinePrincipal || 'A marca fala com clareza.'}</div>
                </div>
              </div>
            ))}
            {(['auxiliarPrimaria', 'auxiliarSecundaria'] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">{k === 'auxiliarPrimaria' ? 'Auxiliar da primária' : 'Auxiliar da secundária'}</span>
                <Select value={spec.tipografia[k]} onValueChange={(v) => update((d) => { d.tipografia[k] = v; })}>
                  <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...new Set([spec.tipografia[k], ...WEB_SAFE_FONTS])].map((f) => <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: f }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <datalist id="kv-fonts">{POPULAR_FONTS.map((f) => <option key={f} value={f} />)}</datalist>
          <Field label="Nota de tipografia (aparece como nota para aprovação)">
            <Textarea value={spec.tipografia.nota} onChange={(e) => update((d) => { d.tipografia.nota = e.target.value; })} className="min-h-[50px] text-xs bg-secondary" placeholder="Vazio = sem divergências" />
          </Field>
        </Section>

        {/* Logos */}
        <Section title="Logotipo" subtitle="Fundo removido, recorte justo e versões monocromáticas geradas automaticamente."
          action={
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <Switch checked={p.vectorizeLogos} onCheckedChange={p.onVectorizeChange} /> Vetorizar (SVG)
            </label>
          }>
          {logos ? (
            <div className="grid grid-cols-3 gap-2">
              <LogoTile src={logos.cor} bg="#FFFFFF" label="Cor" />
              <LogoTile src={logos.branco} bg={tk.brand900} label="Negativo" />
              <LogoTile src={logos.navy} bg="#FFFFFF" label="Institucional" />
              <LogoTile src={logos.apoio} bg="#FFFFFF" label="Apoio" />
              <LogoTile src={logos.preto} bg="#FFFFFF" label="Preto" />
              {logos.simbolo
                ? <LogoTile src={logos.simbolo} bg="#FFFFFF" label="Símbolo" />
                : <div className="rounded-lg border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center p-2">Sem símbolo separado: o manual usa a assinatura</div>}
            </div>
          ) : (
            <Notice icon={<AlertTriangle className="h-4 w-4" />} tone="warn" title="Nenhum logotipo identificado">
              <li>Volte e marque uma imagem como "Logotipo" — sem ele as páginas de marca ficam vazias.</li>
            </Notice>
          )}
          {p.logoSet && (
            <p className="text-[11px] text-muted-foreground">
              Proporção {p.logoSet.razaoLogo.toFixed(2)}:1{p.logoSet.razaoLogo < 2.2 ? ' — marca quase quadrada: o manual reduz as larguras para não estourar as páginas' : ''}.
              {p.logoSet.negativo && ' O arquivo enviado era a versão negativa; a colorida foi reconstruída na cor principal.'}
            </p>
          )}
        </Section>

        {/* Fotos */}
        <Section title="Fotografias" subtitle="Escolha até 3, na ordem. Clique numa foto escolhida para marcar o ponto de foco (rosto/assunto).">
          {p.photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma fotografia encontrada nos materiais. O manual sai com as áreas de foto vazias — envie fotos ou peças para completar.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {p.photos.map((ph) => {
                const idx = p.selectedPhotos.indexOf(ph.id);
                return (
                  <PhotoTile key={ph.id} photo={ph} index={idx}
                    onToggle={() => {
                      if (idx >= 0) p.onSelectedPhotosChange(p.selectedPhotos.filter((x) => x !== ph.id));
                      else if (p.selectedPhotos.length < 3) p.onSelectedPhotosChange([...p.selectedPhotos, ph.id]);
                    }}
                    onFocus={(f) => p.onPhotoFocus(ph.id, f)} />
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Foto 1: landing page e imagem de referência · Foto 2: pessoas (colunas e Facebook) · Foto 3: story e tile.</p>
        </Section>

        {/* Textos */}
        <Section title="Textos da marca" subtitle="Usados nos criativos de exemplo e na landing page do manual.">
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Slogan" value={spec.slogan} onChange={(v) => update((d) => { d.slogan = v; })} />
            <TextField label="Produto / serviço" value={spec.produto} onChange={(v) => update((d) => { d.produto = v; })} />
            <TextField label="Headline principal" value={spec.headlinePrincipal} onChange={(v) => update((d) => { d.headlinePrincipal = v; })} max={60} />
            <TextField label="Headline secundária" value={spec.headlineSecundaria} onChange={(v) => update((d) => { d.headlineSecundaria = v; })} max={50} />
            <TextField label="Headline terceira" value={spec.headlineTerceira} onChange={(v) => update((d) => { d.headlineTerceira = v; })} max={60} />
            <TextField label="Posicionamento (título da LP)" value={spec.posicionamento} onChange={(v) => update((d) => { d.posicionamento = v; })} max={45} />
          </div>
          <TextField label="Texto de apoio" value={spec.textoDeApoio} onChange={(v) => update((d) => { d.textoDeApoio = v; })} max={110} />
          <div className="grid sm:grid-cols-3 gap-3">
            {(['institucional', 'principal', 'secundario', 'material', 'demo', 'solucoes'] as const).map((k) => (
              <TextField key={k} label={`CTA ${{ institucional: 'institucional', principal: 'principal', secundario: 'secundário', material: 'material', demo: 'sobre cor', solucoes: 'navegação' }[k]}`}
                value={spec.cta[k]} onChange={(v) => update((d) => { d.cta[k] = v.toUpperCase(); })} max={28} />
            ))}
          </div>
        </Section>

        {/* LP */}
        <Section title="Landing page do manual" subtitle="Páginas 26–38.">
          <TextField label="Subtítulo do hero" value={spec.lp.subtituloHero} onChange={(v) => update((d) => { d.lp.subtituloHero = v; })} />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Título da seção 1" value={spec.lp.tituloSecao1} onChange={(v) => update((d) => { d.lp.tituloSecao1 = v; })} />
            <TextField label="Título da seção 2" value={spec.lp.tituloSecao2} onChange={(v) => update((d) => { d.lp.tituloSecao2 = v; })} />
          </div>
          <TextField label="Texto da seção 2" value={spec.lp.textoSecao2} onChange={(v) => update((d) => { d.lp.textoSecao2 = v; })} />
          <div className="grid sm:grid-cols-3 gap-2">
            {spec.lp.cards.map((c, i) => (
              <div key={i} className="rounded-lg border p-2 space-y-1.5">
                <Input value={c.titulo} onChange={(e) => update((d) => { d.lp.cards[i].titulo = e.target.value; })} className="h-7 text-xs bg-secondary font-semibold" placeholder={`Card ${i + 1}`} />
                <Textarea value={c.texto} onChange={(e) => update((d) => { d.lp.cards[i].texto = e.target.value; })} className="min-h-[54px] text-[11px] bg-secondary resize-none" />
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Menu (4 itens separados por vírgula)" value={spec.lp.menu.join(', ')}
              onChange={(v) => update((d) => { d.lp.menu = v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 4); })} />
            <TextField label="Links do rodapé" value={spec.lp.rodapeLinks} onChange={(v) => update((d) => { d.lp.rodapeLinks = v; })} />
          </div>
        </Section>

        {/* Listas */}
        <Section title="Direção de imagem (p.12)" subtitle="Uma instrução por linha.">
          <div className="grid sm:grid-cols-2 gap-3">
            <ListField label="Fazer" tone="good" items={spec.imagens.fazer} onChange={(v) => update((d) => { d.imagens.fazer = v; })} />
            <ListField label="Não fazer" tone="bad" items={spec.imagens.naoFazer} onChange={(v) => update((d) => { d.imagens.naoFazer = v; })} />
          </div>
        </Section>
        <Section title="Criativos de exemplo (p.23–25)" subtitle="Como cada peça aplica a marca. Uma instrução por linha.">
          <div className="grid sm:grid-cols-3 gap-3">
            {['01 · Feed', '02 · Story', '03 · Facebook'].map((label, i) => (
              <ListField key={i} label={label} items={spec.criativos[i] ?? []} onChange={(v) => update((d) => { d.criativos[i] = v; })} />
            ))}
          </div>
        </Section>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-gradient-to-t from-background via-background to-background/0 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={p.onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Materiais</Button>
        <Button onClick={p.onApprove} disabled={p.building || !spec.marca.trim()} className="h-11 px-6 gap-2 font-semibold">
          {p.building ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
          {p.building ? 'Montando o manual…' : 'Aprovar e criar manual'}
        </Button>
      </div>
    </div>
  );
}

/* ─── small building blocks ─── */

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="leading-snug mt-0.5">{value || '—'}</div>
    </div>
  );
}

function Notice({ icon, tone, title, children }: { icon: ReactNode; tone: 'info' | 'warn'; title: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border p-3 text-xs', tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5' : 'border-sky-500/30 bg-sky-500/5')}>
      <div className={cn('flex items-center gap-1.5 font-semibold mb-1.5', tone === 'warn' ? 'text-amber-500' : 'text-sky-400')}>{icon}{title}</div>
      <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">{children}</ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><span className="text-xs text-muted-foreground font-medium">{label}</span>{children}</div>;
}

function TextField({ label, value, onChange, max }: { label: string; value: string; onChange: (v: string) => void; max?: number }) {
  const over = max !== undefined && value.length > max;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        {max !== undefined && <span className={cn('text-[10px] tabular-nums', over ? 'text-amber-500' : 'text-muted-foreground/60')}>{value.length}/{max}</span>}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className={cn('h-8 text-xs bg-secondary', over && 'border-amber-500/60')} />
    </div>
  );
}

function ListField({ label, items, onChange, tone }: { label: string; items: string[]; onChange: (v: string[]) => void; tone?: 'good' | 'bad' }) {
  const [text, setText] = useState(items.join('\n'));
  useEffect(() => { setText(items.join('\n')); }, [items]);
  return (
    <div className="space-y-1">
      <span className={cn('text-xs font-semibold', tone === 'good' && 'text-emerald-500', tone === 'bad' && 'text-rose-400')}>{label}</span>
      <Textarea value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6))}
        className="min-h-[150px] text-[11px] leading-relaxed bg-secondary" />
    </div>
  );
}

function PaletteRow({ c, onChange, onRemove }: { c: PaletteColor; onChange: (c: PaletteColor) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-1.5">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#cccccc'} onChange={(e) => onChange({ ...c, hex: e.target.value.toUpperCase() })}
        className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-none" />
      <div className="flex-1 min-w-0 space-y-1">
        <Input value={c.nome} onChange={(e) => onChange({ ...c, nome: e.target.value })} className="h-6 text-[11px] bg-secondary px-1.5" />
        <Input value={c.uso} onChange={(e) => onChange({ ...c, uso: e.target.value })} className="h-6 text-[10px] bg-secondary px-1.5" placeholder="uso" />
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function LogoTile({ src, bg, label }: { src?: string; bg: string; label: string }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="h-20 flex items-center justify-center p-3" style={{ background: bg }}>
        {src && <img src={src} alt={label} className="max-h-full max-w-full object-contain" />}
      </div>
      <div className="text-[10px] text-center py-1 text-muted-foreground bg-card">{label}</div>
    </div>
  );
}

function PhotoTile({ photo, index, onToggle, onFocus }: { photo: PhotoCandidate; index: number; onToggle: () => void; onFocus: (f: { x: number; y: number }) => void }) {
  const selected = index >= 0;
  return (
    <div className={cn('relative rounded-lg overflow-hidden border-2 transition-all aspect-square group', selected ? 'border-primary shadow-lg shadow-primary/10' : 'border-transparent hover:border-primary/40')}>
      <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" style={{ objectPosition: `${photo.foco.x * 100}% ${photo.foco.y * 100}%` }}
        onClick={(e) => {
          if (!selected) { onToggle(); return; }
          const r = (e.target as HTMLElement).getBoundingClientRect();
          onFocus({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        }} />
      {selected && (
        <>
          <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
          <Crosshair className="absolute h-5 w-5 text-primary drop-shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${photo.foco.x * 100}%`, top: `${photo.foco.y * 100}%` }} />
          <button onClick={onToggle} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
        </>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-[9px] text-white px-1.5 py-1 truncate">{photo.label}</div>
    </div>
  );
}
