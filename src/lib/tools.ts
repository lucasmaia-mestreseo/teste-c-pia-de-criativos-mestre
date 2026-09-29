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
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'creatives',
    title: 'Geração de Criativos',
    description: 'Crie anúncios a partir de prompt livre, modelos ou swipe files, sempre com o brand kit e o contexto do cliente.',
    tags: ['Prompt livre', 'Modelos', 'Swipe', 'Dinâmica'],
    path: '/criativos',
  },
  {
    id: 'unfold',
    title: 'Desdobramento',
    description: 'Suba uma peça-mãe e gere a mesma peça em todos os formatos — stories, feed e banner — com textos e logo preservados.',
    tags: ['9:16', '4:5', '1:1', '16:9'],
    projectPanel: 'unfold',
  },
  {
    id: 'kv',
    title: 'Criação de KVs',
    description: 'Suba brandbook, logo e peças do cliente: a IA analisa, você aprova o resumo e sai o manual de comunicação digital de 38 páginas.',
    tags: ['Manual de marca', 'Vetorização', 'PDF'],
    projectPanel: 'kv',
  },
];
