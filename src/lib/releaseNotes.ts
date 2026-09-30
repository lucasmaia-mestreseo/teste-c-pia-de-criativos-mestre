/**
 * Notas de versão — what changed in the platform, shown in the header button
 * and (once per release) in a pop-up after login.
 *
 * To publish a new release: add an entry at the TOP of RELEASES with a new `id`.
 * Everyone sees the pop-up once and the dot on the button until they open it.
 * Keep items short: one sentence each, written for the people who use the tool.
 */

export type NoteKind = 'novo' | 'melhoria' | 'correcao' | 'previa';

export interface NoteItem {
  kind: NoteKind;
  title: string;
  text: string;
}

export interface NoteSection {
  title: string;
  items: NoteItem[];
}

export interface Release {
  /** Unique and increasing — it's what marks the release as seen. */
  id: string;
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  /** 2–4 lines for the pop-up. */
  highlights: string[];
  sections: NoteSection[];
}

export const KIND_LABELS: Record<NoteKind, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  correcao: 'Correção',
  previa: 'Prévia',
};

export const RELEASES: Release[] = [
  {
    id: '2026-09-30',
    version: '2.0',
    date: '2026-09-30',
    title: 'Novas ferramentas e uma Geração de Criativos mais completa',
    highlights: [
      'Nova tela de Ferramentas e projetos organizados: crie direto de qualquer ferramenta e ache os seus em "Meus projetos".',
      'Desdobramento (várias peças de uma vez, com o banner 1200×628) e Criação de KVs, que vira o guia de marca do projeto.',
      'Geração de Criativos com Redimensionar, Revisão automática, Copy do anúncio e Variações A/B.',
    ],
    sections: [
      {
        title: 'Novas ferramentas',
        items: [
          { kind: 'novo', title: 'Tela de Ferramentas', text: 'A plataforma agora abre num painel com todas as ferramentas e os projetos em que você trabalhou por último.' },
          { kind: 'novo', title: 'Desdobramento', text: 'Suba uma ou várias peças aprovadas (até 10) e receba cada uma em 9:16, 4:5, 1:1, 16:9 e no banner 1200×628 do Facebook, com textos, logo e pessoas preservados.' },
          { kind: 'novo', title: 'Criação de KVs', text: 'Briefing, brandbook, logo e peças do cliente viram o manual de comunicação digital. A IA molda a estrutura pelo briefing, mostra onde cada resposta foi aplicada e o manual aprovado alimenta a identidade do cliente.' },
          { kind: 'previa', title: 'Edição de Vídeo', text: 'Cortes automáticos de silêncios e vícios de linguagem, tratamento de imagem e áudio, legendas e a assistente Astra. Chega em breve.' },
        ],
      },
      {
        title: 'Projetos',
        items: [
          { kind: 'novo', title: 'Criar projeto de qualquer ferramenta', text: 'Ao abrir Gerar, Desdobramento ou KVs, crie um projeto novo ali mesmo ou escolha um existente.' },
          { kind: 'novo', title: 'Últimos editados, Meus projetos e Todos', text: 'Na tela inicial e no seletor: os que você abriu por último, os que você criou e todos os projetos da agência.' },
          { kind: 'novo', title: 'Guia de marca ativo', text: 'O manual salvo em Criação de KVs vira o guia do projeto — um por campanha. Gerar e Desdobramento seguem o guia ativo, indicado no topo de cada ferramenta.' },
        ],
      },
      {
        title: 'Geração de Criativos',
        items: [
          { kind: 'novo', title: 'Redimensionar', text: 'Gere o mesmo criativo em outros formatos direto da visualização.' },
          { kind: 'novo', title: 'Revisão automática', text: 'Cada criativo é conferido pela IA (texto, logo, cortes). O resultado aparece na miniatura e dá para corrigir com um clique.' },
          { kind: 'novo', title: 'Copy do anúncio', text: 'Textos prontos por plataforma para cada criativo.' },
          { kind: 'novo', title: 'Variações A/B', text: 'Variações que testam uma hipótese de cada vez, com comparação lado a lado.' },
          { kind: 'melhoria', title: 'Identidade do cliente', text: 'O manual aprovado na Criação de KVs leva cores, fontes e regras visuais para a geração de criativos.' },
          { kind: 'melhoria', title: 'Formatos mais fiéis', text: 'O formato escolhido é enviado ao modelo de imagem como parâmetro, e não só no texto do pedido.' },
          { kind: 'melhoria', title: 'Interface mais leve', text: 'Visual revisto, animações suaves, miniaturas melhores e navegação mais clara.' },
        ],
      },
      {
        title: 'Administração',
        items: [
          { kind: 'novo', title: 'Custos de IA', text: 'Painel com o gasto por projeto, por funcionalidade e por modelo.' },
          { kind: 'novo', title: 'Modelos para manuais de marca', text: 'Categoria própria de modelo de IA para a Criação de KVs, configurável em Modelos de IA.' },
        ],
      },
      {
        title: 'Correções',
        items: [
          { kind: 'correcao', title: 'Permissões', text: 'Quem não é administrador volta a conseguir gerar: os botões não ficam mais desativados por engano.' },
          { kind: 'correcao', title: '"Usar contexto"', text: 'O botão da aba Gerar voltou a preencher o pedido com o contexto do projeto.' },
          { kind: 'correcao', title: 'Aba Dinâmica', text: 'Respeita o formato, inclui o logo, salva o briefing completo e não estoura mais o tempo em lotes grandes.' },
          { kind: 'correcao', title: 'Novas tentativas', text: 'Uma falha não multiplica mais o custo de uma geração.' },
          { kind: 'correcao', title: 'Imagens dos projetos', text: 'Exibidas com links seguros, do armazenamento privado.' },
          { kind: 'correcao', title: 'Extração de marca por site', text: 'Usa uma captura real da página.' },
          { kind: 'correcao', title: 'Navegação', text: 'O botão voltar do navegador volta para o painel, e as permissões valem em todos os botões da aba Dinâmica.' },
        ],
      },
    ],
  },
];

export const LATEST = RELEASES[0];

const key = (kind: 'seen' | 'popup', userId: string) => `cm-release-${kind}:${userId}`;

function read(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function write(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* private mode: the dot just shows again */ }
}

/** The dot stays until the person opens the notes. */
export const hasUnseen = (userId: string) => !!LATEST && read(key('seen', userId)) !== LATEST.id;
export const markSeen = (userId: string) => LATEST && write(key('seen', userId), LATEST.id);
/** The pop-up shows once per release. */
export const shouldPopup = (userId: string) => !!LATEST && read(key('popup', userId)) !== LATEST.id;
export const markPopupShown = (userId: string) => LATEST && write(key('popup', userId), LATEST.id);

export function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}
