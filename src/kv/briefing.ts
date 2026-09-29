/**
 * Criação de KVs — the client's creative briefing.
 *
 * Before a manual is made, the agency sends the client a briefing form
 * (Google Forms). Its answers come back as a CSV export, a PDF, a text file —
 * or are typed straight into the platform. Everything ends up as a Briefing:
 * question/answer pairs the strategy step (`kv-plan`) turns into the
 * structure of the manual.
 */

export interface BriefingAnswer {
  pergunta: string;
  resposta: string;
}

export interface Briefing {
  id: string;
  /** File name, or "Formulário na plataforma". */
  origem: string;
  respondente?: string;
  data?: string;
  respostas: BriefingAnswer[];
  /** Free text (PDF/TXT briefings that aren't question/answer tables). */
  texto?: string;
  /** Links found in the answers (Google Drive attachments the platform can't open). */
  anexos: string[];
}

/** The agency's standard briefing (same questions as the Google Forms). */
export const MESTRE_BRIEFING_QUESTIONS: string[] = [
  'Vocês possuem um manual de identidade visual da marca?',
  'Qual é o principal problema que o seu cliente resolve ao escolher a marca? O que precisamos mostrar nas imagens para que ele sinta que o problema dele será resolvido?',
  'Qual persona decisora este design precisa impactar?',
  'Como os produtos e a tecnologia devem aparecer no criativo?',
  'Escolha até 3 atributos que definem a linguagem visual ideal para as entregas do time de criação.',
  'A marca possui banco de imagens próprio?',
  'Existe alguma restrição de conformidade ou Brand Safety a ser evitada?',
  'Quais referências ativas podem inspirar o estilo visual dos materiais gráficos?',
  'Para os anúncios em banners, é preferível usar: fotos, ilustrações, produto em destaque ou uma mescla?',
  'Há algo que não pode ser executado de nenhuma forma? (Ex.: termos que não devem ser usados, testes anteriores que geraram feedback negativo dos leads)',
  'Existe alguma cor que NÃO devemos usar de jeito nenhum?',
  'Quais são as características que a marca NÃO busca transmitir?',
  'Há mais alguma observação visual importante (que não mencionamos acima)?',
];

let seq = 0;
const nextId = () => `brf${Date.now().toString(36)}${++seq}`;

/* ─── CSV (RFC 4180: quoted fields, "" escapes, line breaks inside quotes) ─── */

export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM
  // Google Sheets/Forms exports use commas; Excel in pt-BR uses semicolons
  const firstLine = src.split(/\r?\n/, 1)[0];
  const sep = count(firstLine, ';') > count(firstLine, ',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

function count(s: string, ch: string) {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

const META_TIME = /carimbo de data|timestamp|data\/hora|^data$/i;
const META_WHO = /nome de usu[aá]rio|endere[cç]o de e-?mail|e-?mail address|^e-?mail$|username/i;
const LINK = /https?:\/\/[^\s;,]+/g;
const DRIVE = /drive\.google\.com|docs\.google\.com/i;

/** Does this CSV look like a form export (a header of questions + answer rows)? */
export function looksLikeFormCsv(text: string): boolean {
  const rows = parseCsv(text.slice(0, 20000));
  if (rows.length < 2) return false;
  const head = rows[0];
  const questions = head.filter((h) => /\?|:$/.test(h.trim()) || h.trim().split(/\s+/).length >= 5).length;
  return head.some((h) => META_TIME.test(h)) || questions >= 3;
}

/** One Briefing per answer row, newest first. */
export function briefingsFromCsv(text: string, origem: string): Briefing[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  const out: Briefing[] = [];
  for (const r of rows.slice(1)) {
    const b: Briefing = { id: nextId(), origem, respostas: [], anexos: [] };
    head.forEach((q, i) => {
      const v = (r[i] ?? '').trim();
      if (!q) return;
      if (META_TIME.test(q)) { b.data = v; return; }
      if (META_WHO.test(q)) { b.respondente = v; return; }
      if (!v) return;
      const links = v.match(LINK) ?? [];
      const onlyLinks = links.length > 0 && v.replace(LINK, '').replace(/[\s;,]/g, '') === '';
      if (links.length) b.anexos.push(...links);
      b.respostas.push({
        pergunta: q,
        resposta: onlyLinks ? `${links.length} arquivo(s) anexado(s)${links.some((l) => DRIVE.test(l)) ? ' no Google Drive' : ''}` : v,
      });
    });
    if (b.respostas.length) out.push(b);
  }
  return out.sort((a, b) => stamp(b.data) - stamp(a.data));
}

/** "2026/08/26 6:03:51 PM GMT-3" and friends → sortable number (0 when unknown). */
function stamp(d?: string): number {
  if (!d) return 0;
  const m = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 0;
  const [y, mo, da] = m[1] ? [m[1], m[2], m[3]] : [m[6], m[5], m[4]];
  const t = d.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  let hh = t ? Number(t[1]) : 0;
  if (t?.[4]) hh = (hh % 12) + (/pm/i.test(t[4]) ? 12 : 0);
  return Number(y) * 1e8 + Number(mo) * 1e6 + Number(da) * 1e4 + hh * 100 + (t ? Number(t[2]) : 0);
}

/**
 * Free-text briefing (PDF, TXT, MD). Lines ending in "?" are read as questions
 * and the text up to the next question as their answer; otherwise the whole
 * text is kept as-is for the AI.
 */
export function briefingFromText(text: string, origem: string): Briefing {
  const clean = text.replace(/\r/g, '').replace(/\[p\.\d+\]\s*/g, '\n').trim();
  const b: Briefing = { id: nextId(), origem, respostas: [], anexos: [...new Set(clean.match(LINK) ?? [])] };
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  let current: BriefingAnswer | null = null;
  for (const l of lines) {
    if (/\?\s*$/.test(l) && l.length < 260) {
      if (current?.resposta) b.respostas.push(current);
      current = { pergunta: l, resposta: '' };
    } else if (current) current.resposta = `${current.resposta ? `${current.resposta}\n` : ''}${l}`;
  }
  if (current?.resposta) b.respostas.push(current);
  if (b.respostas.length < 3) {
    b.respostas = [];
    b.texto = clean.slice(0, 20000);
  }
  return b;
}

export function briefingFromForm(answers: string[], origem = 'Formulário na plataforma'): Briefing {
  return {
    id: nextId(),
    origem,
    data: new Date().toLocaleDateString('pt-BR'),
    respostas: MESTRE_BRIEFING_QUESTIONS.map((q, i) => ({ pergunta: q, resposta: (answers[i] ?? '').trim() })).filter((a) => a.resposta),
    anexos: [],
  };
}

/** The questions as plain text, to paste in an e-mail or a new form. */
export function briefingQuestionsText(): string {
  return MESTRE_BRIEFING_QUESTIONS.map((q, i) => `${i + 1}. ${q}\n`).join('\n');
}

export function answerCount(b: Briefing): number {
  return b.respostas.length || (b.texto ? 1 : 0);
}

/** The briefings as the text block the AI reads. */
export function briefingsToText(list: Briefing[]): string {
  return list.map((b) => {
    const head = [`### Briefing do cliente — ${b.origem}`, b.respondente && `respondido por ${b.respondente}`, b.data && `em ${b.data}`].filter(Boolean).join(', ');
    const body = b.respostas.length
      ? b.respostas.map((a, i) => `${i + 1}. ${a.pergunta}\n→ ${a.resposta}`).join('\n')
      : b.texto ?? '';
    const anexos = b.anexos.length ? `\n(Anexos citados: ${b.anexos.length} link(s) — o conteúdo deles NÃO foi lido, a menos que o arquivo tenha sido enviado nos materiais.)` : '';
    return `${head}\n${body}${anexos}`;
  }).join('\n\n').slice(0, 16000);
}

/** Every answer across the briefings, for the coverage check. */
export function allAnswers(list: Briefing[]): BriefingAnswer[] {
  return list.flatMap((b) => (b.respostas.length ? b.respostas : b.texto ? [{ pergunta: `Documento: ${b.origem}`, resposta: b.texto.slice(0, 400) }] : []));
}
