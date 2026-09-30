/**
 * Ferramentas exibidas na tela inicial (hub). Para adicionar uma ferramenta nova:
 *  1. crie a ilustração em src/components/ToolArt.tsx (chave = id);
 *  2. adicione um item aqui;
 *  3. se ela não for um painel de projeto, crie a rota em src/App.tsx.
 */

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** Route to open directly. */
  path?: string;
  /** Tools that work inside a project open /project/:id/:panel after picking a project. */
  projectPanel?: string;
  /** Shows the "Novo" tag on the card. */
  novo?: boolean;
  /** false = card shown as "Em breve" and not clickable. */
  available?: boolean;
}

/**
 * Edição de Vídeo runs only in the demo for now: the real version needs the
 * transcription key and a render server (FFmpeg). See docs/EDICAO-DE-VIDEO.md.
 */
export const VIDEO_ENABLED = import.meta.env.MODE === 'demo';

export const TOOLS: ToolDefinition[] = [
  {
    id: 'creatives',
    title: 'Geração de Criativos',
    description: 'Crie anúncios a partir de prompt livre, modelos ou swipe files, sempre com o brand kit e o contexto do cliente.',
    tags: ['Prompt livre', 'Swipe', 'Dinâmica', 'Variações A/B', 'Copy'],
    projectPanel: 'generate',
  },
  {
    id: 'unfold',
    title: 'Desdobramento',
    description: 'Suba uma ou várias peças aprovadas e gere cada uma em todos os formatos — stories, feed e banners — com textos e logo preservados.',
    tags: ['Em lote', '9:16', '4:5', '1:1', '16:9', '1200×628'],
    projectPanel: 'unfold',
    novo: true,
  },
  {
    id: 'kv',
    title: 'Criação de KVs',
    description: 'Briefing, brandbook, logo e peças do cliente: a IA lê tudo, molda a estrutura e você aprova o manual de comunicação digital.',
    tags: ['Manual de marca', 'Briefing', 'PDF'],
    projectPanel: 'kv',
    novo: true,
  },
  {
    id: 'video',
    title: 'Edição de Vídeo',
    description: 'Solte a gravação: a IA transcreve, corta silêncios e vícios de linguagem, trata imagem e áudio e gera as legendas. Com a assistente Astra.',
    tags: ['Cortes automáticos', 'Legendas', 'Astra'],
    projectPanel: 'video',
    novo: true,
    available: VIDEO_ENABLED,
  },
];
