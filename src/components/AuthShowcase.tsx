import { BookOpenCheck, FlaskConical, Layers, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Zap, title: 'Geração de criativos', text: 'Prompt livre, modelos e swipe files — sempre no brand kit do cliente.' },
  { icon: Layers, title: 'Desdobramento', text: 'Uma peça-mãe vira stories, feed e banner em minutos.' },
  { icon: BookOpenCheck, title: 'Criação de KVs', text: 'Brandbook e logo viram o manual de comunicação de 38 páginas.' },
  { icon: ShieldCheck, title: 'Revisão automática', text: 'A IA confere texto, logo e cores antes de você aprovar.' },
  { icon: FlaskConical, title: 'Copy e variações A/B', text: 'Texto do anúncio por plataforma e variações para testar.' },
];

/** Mock creative tile drawn with CSS (no external images). */
function Tile({ className, style, dark, title }: { className?: string; style?: React.CSSProperties; dark?: boolean; title: string }) {
  return (
    <div className={`absolute rounded-xl shadow-2xl overflow-hidden border border-white/10 ${className ?? ''}`} style={style}>
      <div className={`h-full w-full p-3 flex flex-col justify-between ${dark ? 'bg-[#141414]' : 'bg-primary'}`}>
        <div className={`text-[11px] font-bold leading-tight ${dark ? 'text-primary' : 'text-[#111]'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</div>
        <div className={`mx-auto h-10 w-10 rounded-full ${dark ? 'bg-white/10' : 'bg-black/15'}`} />
        <div className={`h-4 w-16 rounded-full ${dark ? 'bg-primary' : 'bg-[#111]'}`} />
      </div>
    </div>
  );
}

export default function AuthShowcase() {
  return (
    <div className="relative hidden lg:flex flex-col justify-center overflow-hidden border-l bg-gradient-to-br from-[#161616] via-background to-[#1d1c0d] p-14">
      <div aria-hidden className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-primary/15 blur-[110px]" />
      <div aria-hidden className="absolute -left-20 bottom-0 h-[300px] w-[300px] rounded-full bg-primary/10 blur-[100px]" />

      {/* floating mock creatives */}
      <div aria-hidden className="relative h-[260px] mb-10">
        <Tile title="Seu sorriso sem medo" className="auth-float left-4 top-6 w-[130px] h-[230px]" style={{ animationDelay: '0s' }} dark />
        <Tile title="Oferta de verão" className="auth-float left-[170px] top-0 w-[170px] h-[170px] rotate-3" style={{ animationDelay: '1.2s' }} />
        <Tile title="Primeira semana grátis" className="auth-float left-[180px] top-[150px] w-[220px] h-[124px] -rotate-2" style={{ animationDelay: '0.6s' }} dark />
        <Tile title="Vista mar" className="auth-float left-[370px] top-[40px] w-[120px] h-[150px] rotate-6" style={{ animationDelay: '1.8s' }} />
        <div className="auth-float absolute left-[330px] top-[190px] rounded-full bg-card border px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 shadow-xl" style={{ animationDelay: '0.9s' }}>
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Aprovado na revisão · 94
        </div>
      </div>

      <div className="relative max-w-md space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> Plataforma de criação da Agência Mestre
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-tight">
            Criativos no padrão da marca,<br />em minutos.
          </h2>
        </div>
        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-3 animate-in fade-in slide-in-from-right-3 duration-500" style={{ animationDelay: `${150 + i * 90}ms`, animationFillMode: 'both' }}>
              <span className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-none"><Icon className="h-4 w-4" /></span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
