/**
 * MODO DEMO — fictitious data the demo starts with.
 */
import { adArt, logoArt } from './svgArt';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Tables = Record<string, Row[]>;

export const DEMO_USER = {
  id: '00000000-0000-4000-8000-00000000d3e0',
  email: 'demo@criativosmestre.local',
  user_metadata: { name: 'Lucas Demo' },
};

export const STORAGE_BASE = 'https://demo.criativosmestre.local';
export const storagePublicUrl = (bucket: string, path: string) => `${STORAGE_BASE}/storage/v1/object/public/${bucket}/${path}`;

const PROJECTS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Clínica Sorriso',
    primary: '#2EC4B6', secondary: '#FFFFFF', background: '#0B2A33', typography: 'Poppins',
    context: 'Clínica odontológica em Curitiba focada em implantes e clareamento. Público: adultos de 30 a 55 anos, classe B, que adiam o dentista por medo ou falta de tempo. Diferenciais: atendimento sem dor, parcelamento em 18x e horários à noite.',
    voice: 'Acolhedor e confiante. Frases curtas, sem jargão técnico. Evita promessas milagrosas; reforça segurança e conforto.',
    titles: ['Seu sorriso sem medo de dentista', 'Implante em até 18x', 'Clareamento que dura', 'Atendimento até as 21h'],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Academia Pulse',
    primary: '#FF4D2E', secondary: '#111111', background: '#141414', typography: 'Montserrat',
    context: 'Rede de academias com 4 unidades em São Paulo. Público: 20 a 40 anos, iniciantes que desistiram de outras academias. Diferenciais: aulas em grupo, app de treino e plano sem fidelidade.',
    voice: 'Energético e direto, com humor leve. Usa "você" e verbos de ação.',
    titles: ['Sem fidelidade. Só resultado.', 'Primeira semana grátis', 'Treino em grupo vicia', 'Volta pro treino hoje'],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Imobiliária Horizonte',
    primary: '#E9C46A', secondary: '#1D1D1D', background: '#1F2A36', typography: 'Playfair Display',
    context: 'Imobiliária de alto padrão em Florianópolis. Público: famílias e investidores buscando imóveis acima de R$ 1,5 mi.',
    voice: 'Sofisticado, sereno e preciso. Valoriza exclusividade e localização.',
    titles: ['Vista mar, sem pressa', 'Lançamento no Jurerê', 'Seu próximo endereço'],
  },
];

const FORMATS = ['9:16', '4:5', '1:1', '16:9'];
const MODELS = {
  image: ['openai/gpt-5.4-image-2', 'google/gemini-3.1-flash-image-preview'],
  text: ['google/gemini-3-flash-preview'],
  vision: ['google/gemini-2.5-flash'],
};

export function createSeed(): { tables: Tables; storage: Record<string, string> } {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const day = 86400000;
  const storage: Record<string, string> = {};
  const store = (bucket: string, path: string, dataUrl: string) => {
    storage[`${bucket}/${path}`] = dataUrl;
    return storagePublicUrl(bucket, path);
  };
  let n = 0;
  const id = () => `demo-${(++n).toString().padStart(4, '0')}-${Math.random().toString(36).slice(2, 8)}`;

  const tables: Tables = {
    profiles: [{ id: id(), user_id: DEMO_USER.id, name: DEMO_USER.user_metadata.name, email: DEMO_USER.email, approved: true, created_at: iso(90 * day), updated_at: iso(1 * day) }],
    user_roles: [{ id: id(), user_id: DEMO_USER.id, role: 'owner' }],
    role_permissions: [],
    user_project_access: [],
    user_invitations: [],
    user_downloads: [],
    error_logs: [],
    app_settings: [],
    template_prompts: [],
    creative_formats: FORMATS.map((label, i) => ({ id: id(), label, sort_order: i + 1, active: true })),
    projects: [],
    brand_kits: [],
    swipe_files: [],
    generated_creatives: [],
    ai_usage: [],
  };

  for (const role of ['owner', 'admin', 'manager', 'analyst']) {
    for (const permission of ['create_project', 'delete_project', 'edit_project', 'generate_creative', 'delete_creative', 'download_creative', 'manage_brand_kit', 'manage_swipe_files', 'favorite_creative']) {
      tables.role_permissions.push({ id: id(), role, permission, enabled: role !== 'analyst' || !permission.startsWith('delete') });
    }
  }

  PROJECTS.forEach((p, pi) => {
    tables.projects.push({
      id: p.id, name: p.name, active: true, onboarding_completed: true, description: null,
      context: p.context, voice_guide: p.voice, created_at: iso((60 - pi * 10) * day), updated_at: iso(day),
    });
    const initials = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
    tables.brand_kits.push({
      id: id(), project_id: p.id,
      primary_color: p.primary, secondary_color: p.secondary, background_color: p.background,
      aux_colors: ['#FFFFFF'], colors: null, typography: p.typography,
      logo_url: store('logos', `${p.id}/logo.svg`, logoArt(initials, p.primary)),
      photos: [], people_photos: [], person_grid_url: null, design_screenshot_url: null,
      logo_analysis: null, logo_analysis_source: null,
      created_at: iso(50 * day), updated_at: iso(day),
    });

    // Swipe files
    for (let s = 0; s < 2; s++) {
      const fmt = s === 0 ? '4:5' : '1:1';
      tables.swipe_files.push({
        id: id(), project_id: p.id, name: `Referência ${s + 1}`, width: null, height: null,
        image_url: store('swipe-files', `${p.id}/swipe-${s}.svg`, adArt({ format: fmt, title: s === 0 ? 'Oferta imperdível de verão' : 'Agende sua avaliação', cta: 'Quero agora', variant: s })),
        analysis: null, created_at: iso((40 - s) * day),
      });
    }

    // Generated creatives
    p.titles.forEach((title, ti) => {
      const format = FORMATS[(ti + pi) % FORMATS.length];
      const kind = ti === 2 ? 'dynamic' : 'generate';
      const approved = (ti + pi) % 3 !== 1;
      const cid = id();
      tables.generated_creatives.push({
        id: cid, project_id: p.id, swipe_file_id: null, created_by: DEMO_USER.id,
        image_url: store('generated-creatives', `${p.id}/${cid}.svg`, adArt({ format, title, primary: p.primary, secondary: p.secondary, background: p.background, variant: ti })),
        prompt: kind === 'dynamic' ? `[innovative] ${title}` : `Criativo com a headline "${title}" e CTA "Saiba mais", foco em ${p.name}.`,
        format, favorite: ti === 0, kind,
        parent_creative_id: null, source_image_url: null,
        model_used: MODELS.image[ti % 2], cost_usd: 0.03 + ((ti * 7 + pi * 3) % 5) / 100,
        briefing: kind === 'dynamic' ? { type: 'innovative', titulo: title, copy: 'Texto de apoio persuasivo de exemplo.', proposta_imagem: 'Pessoa sorrindo em ambiente claro.', objetivo_estrategico: 'Gerar cliques' } : null,
        generation_meta: { mode: 'free', format, hasLogo: true, hasPerson: true },
        review: approved
          ? { approved: true, score: 88 + ti, summary: 'Pronto para publicar: textos corretos e marca bem aplicada.', issues: [], model: MODELS.vision[0], reviewed_at: iso(ti * day) }
          : { approved: false, score: 64, summary: 'Boa composição, mas o CTA está ilegível e o logo encosta na borda.', issues: [
            { severity: 'alta', category: 'texto', description: 'O texto do botão está distorcido.', fix_instruction: 'Reescrever o CTA "Saiba mais" com letras nítidas, mantendo a cor e a posição.' },
            { severity: 'media', category: 'logo', description: 'Logo muito próximo da borda direita.', fix_instruction: 'Afastar o logo ~4% da borda, sem cortar.' },
          ], model: MODELS.vision[0], reviewed_at: iso(ti * day) },
        review_status: approved ? 'approved' : 'issues',
        created_at: iso((ti * 3 + pi) * day + ti * 3600000),
      });
    });
  });

  // One Desdobramento group for the first project
  const p0 = PROJECTS[0];
  const sourceUrl = store('generated-creatives', `${p0.id}/sources/kv-primavera.svg`, adArt({ format: '4:5', title: 'Semana do Sorriso: avaliação grátis', cta: 'Agendar', primary: p0.primary, secondary: p0.secondary, background: p0.background }));
  ['9:16', '1:1', '16:9'].forEach((format, i) => {
    const cid = id();
    tables.generated_creatives.push({
      id: cid, project_id: p0.id, swipe_file_id: null, created_by: DEMO_USER.id,
      image_url: store('generated-creatives', `${p0.id}/unfold-${cid}.svg`, adArt({ format, title: 'Semana do Sorriso: avaliação grátis', cta: 'Agendar', primary: p0.primary, secondary: p0.secondary, background: p0.background, badge: 'Desdobramento' })),
      prompt: `[Desdobramento → ${format}]`, format, favorite: false, kind: 'unfold',
      parent_creative_id: null, source_image_url: sourceUrl,
      model_used: MODELS.image[0], cost_usd: 0.045, briefing: null,
      generation_meta: { operation: 'unfold', sourceFormat: '4:5', targetFormat: format },
      review: { approved: true, score: 91, summary: 'Fiel à peça-mãe.', issues: [] }, review_status: 'approved',
      created_at: iso(2 * day + i * 60000),
    });
  });

  // 30 days of AI usage for the cost panel
  const fns: [string, 'image' | 'text' | 'vision', number][] = [
    ['generate-creative', 'image', 0.045], ['generate-creative', 'image', 0.045], ['generate-creative', 'vision', 0.001],
    ['generate-dynamic-creative', 'text', 0.002], ['generate-dynamic-creative', 'image', 0.04],
    ['transform-creative:resize', 'image', 0.042], ['transform-creative:unfold', 'image', 0.042],
    ['review-creative', 'vision', 0.0015], ['review-creative', 'vision', 0.0015],
    ['analyze-swipe', 'vision', 0.001], ['suggest-texts', 'text', 0.0008], ['extract-context', 'text', 0.003],
  ];
  for (let i = 0; i < 260; i++) {
    const [fn, kind, base] = fns[i % fns.length];
    const models = MODELS[kind];
    tables.ai_usage.push({
      id: id(), created_at: iso(((i * 37) % 30) * day + (i % 24) * 3600000),
      function_name: fn, settings_key: kind === 'image' ? 'image_generation' : kind === 'text' ? 'text_reasoning' : 'vision_analysis',
      model: models[i % models.length], project_id: PROJECTS[i % 3].id, user_id: DEMO_USER.id,
      success: i % 29 !== 0, status_code: i % 29 !== 0 ? 200 : 502,
      prompt_tokens: 1200 + (i % 7) * 150, completion_tokens: 300 + (i % 5) * 80,
      cost_usd: i % 29 !== 0 ? +(base * (0.8 + ((i * 13) % 10) / 20)).toFixed(6) : 0,
      duration_ms: kind === 'image' ? 25000 + (i % 9) * 3000 : 1500 + (i % 5) * 400,
    });
  }

  return { tables, storage };
}
