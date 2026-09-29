/**
 * Mini-illustrations for the tools hub: a yellow Mestre tile with a simple
 * dark pictogram that hints at what the tool does.
 */

const INK = 'hsl(var(--primary-foreground))';

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-16 w-16 rounded-2xl shadow-lg shadow-primary/10 flex items-center justify-center"
      style={{ background: 'linear-gradient(145deg, hsl(var(--primary)) 0%, hsl(50 100% 52%) 100%)' }}
    >
      <svg viewBox="0 0 48 48" className="h-11 w-11" aria-hidden="true">{children}</svg>
    </div>
  );
}

function CreativesArt() {
  // An ad card: image, headline, body line and CTA — plus a spark.
  return (
    <Tile>
      <rect x="7" y="6" width="30" height="36" rx="4" fill={INK} />
      <rect x="11" y="10" width="22" height="13" rx="2" fill="hsl(var(--primary))" opacity="0.85" />
      <circle cx="16" cy="15" r="2.2" fill={INK} />
      <path d="M11 23 L18 17 L23 21 L27 18 L33 23 Z" fill={INK} opacity="0.55" />
      <rect x="11" y="26" width="18" height="3" rx="1.5" fill="hsl(var(--primary))" />
      <rect x="11" y="31" width="13" height="2" rx="1" fill="hsl(var(--primary))" opacity="0.55" />
      <rect x="11" y="35.5" width="10" height="3.5" rx="1.75" fill="hsl(var(--primary))" />
      <path d="M39 5 L40.6 9.4 L45 11 L40.6 12.6 L39 17 L37.4 12.6 L33 11 L37.4 9.4 Z" fill={INK} />
    </Tile>
  );
}

function UnfoldArt() {
  // One piece, three proportions: 9:16, 1:1 and 16:9.
  return (
    <Tile>
      <rect x="5" y="7" width="15" height="27" rx="2.5" fill={INK} />
      <rect x="23" y="7" width="20" height="20" rx="2.5" fill={INK} opacity="0.8" />
      <rect x="15" y="31" width="28" height="12" rx="2.5" fill={INK} opacity="0.6" />
      <rect x="8" y="11" width="9" height="2.5" rx="1.25" fill="hsl(var(--primary))" />
      <rect x="26" y="11" width="11" height="2.5" rx="1.25" fill="hsl(var(--primary))" />
      <rect x="19" y="35" width="11" height="2.5" rx="1.25" fill="hsl(var(--primary))" />
    </Tile>
  );
}

function KvArt() {
  // An open brand manual: logo page on the left, swatches + type on the right.
  return (
    <Tile>
      <path d="M5 11 Q14 8 23 11 L23 41 Q14 38 5 41 Z" fill={INK} />
      <path d="M25 11 Q34 8 43 11 L43 41 Q34 38 25 41 Z" fill={INK} opacity="0.85" />
      <circle cx="14" cy="21" r="4.5" fill="hsl(var(--primary))" />
      <rect x="9" y="29" width="10" height="2.4" rx="1.2" fill="hsl(var(--primary))" opacity="0.7" />
      <rect x="28.5" y="15" width="5" height="5" rx="1" fill="hsl(var(--primary))" />
      <rect x="35" y="15" width="5" height="5" rx="1" fill="hsl(var(--primary))" opacity="0.6" />
      <rect x="28.5" y="22" width="5" height="5" rx="1" fill="hsl(var(--primary))" opacity="0.35" />
      <text x="35" y="27" fontFamily="Space Grotesk, Arial" fontWeight="700" fontSize="6.5" fill="hsl(var(--primary))">Aa</text>
      <rect x="28.5" y="31" width="11.5" height="2" rx="1" fill="hsl(var(--primary))" opacity="0.6" />
      <path d="M40 3 L41.4 6.6 L45 8 L41.4 9.4 L40 13 L38.6 9.4 L35 8 L38.6 6.6 Z" fill={INK} />
    </Tile>
  );
}

function VideoArt() {
  // A player with a cut timeline underneath: play button, captions and a cut marker.
  return (
    <Tile>
      <rect x="5" y="6" width="38" height="25" rx="3.5" fill={INK} />
      <path d="M20.5 12.5 L29.5 18.5 L20.5 24.5 Z" fill="hsl(var(--primary))" />
      <rect x="13" y="27" width="22" height="2" rx="1" fill="hsl(var(--primary))" opacity="0.7" />
      <rect x="5" y="35" width="38" height="8" rx="2.5" fill={INK} opacity="0.85" />
      <path d="M8 39h2M11 37.5v3M13 38.5v1M15 37v4M17 38v2M27 37.5v3M29 38.5v1M31 37v4M33 38v2M35 37.5v3M38 38.5v1" stroke="hsl(var(--primary))" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="19" y="35" width="6" height="8" fill="hsl(var(--primary))" opacity="0.35" />
      <path d="M40 2 L41.4 5.6 L45 7 L41.4 8.4 L40 12 L38.6 8.4 L35 7 L38.6 5.6 Z" fill={INK} />
    </Tile>
  );
}

const ART: Record<string, () => JSX.Element> = {
  creatives: CreativesArt,
  unfold: UnfoldArt,
  kv: KvArt,
  video: VideoArt,
};

export default function ToolArt({ id }: { id: string }) {
  const Art = ART[id];
  return Art ? <Art /> : <Tile><circle cx="24" cy="24" r="10" fill={INK} /></Tile>;
}
