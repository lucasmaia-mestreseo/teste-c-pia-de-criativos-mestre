import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callOpenRouterWithCascade,
  generateImageWithCascade,
  imageFailurePayload,
} from "../_shared/openrouter.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, imageToBytes, parseStorageUrl, signProjectStorageUrl, signStorageUrl, uploadGeneratedImage } from "../_shared/storage.ts";
import { requireProjectAccess } from "../_shared/auth.ts";

type Track = { functionName: string; projectId: string; userId: string };

/* ------------------------------------------------------------------ */
/*  Helper: detect if user wants full photo replacement vs face swap  */
/* ------------------------------------------------------------------ */
const PHOTO_REPLACE_KEYWORDS = [
  "substituir a foto",
  "trocar a fotografia",
  "usar exatamente esta foto",
  "usar a foto original",
  "colocar esta foto",
  "usar esta imagem",
  "substituir a imagem",
  "trocar a imagem da pessoa",
  "colocar a foto",
];

function detectPhotoMode(prompt: string): "replace" | "swap" {
  const lower = prompt.toLowerCase();
  for (const kw of PHOTO_REPLACE_KEYWORDS) {
    if (lower.includes(kw)) return "replace";
  }
  return "swap";
}

/* ------------------------------------------------------------------ */
/*  Helper: pre-analyze logo content (texts, structure) via vision AI */
/* ------------------------------------------------------------------ */
async function analyzeLogoContent(logoUrl: string, track: Track): Promise<string | null> {
  try {
    const result = await callOpenRouterWithCascade({
      settingsKey: "vision_analysis",
      track,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this logo image in detail. Return a structured description with:
1. ALL text found in the logo — list each text exactly as written, and its position (top, center, bottom, left, right).
2. Visual structure — describe the layout (e.g. "icon in center, text above, tagline below").
3. Approximate proportions — how much vertical space each part occupies (e.g. "top text: ~15%, icon: ~55%, bottom text: ~30%").

Be precise and exhaustive. Every single character of text must be listed. Answer in Portuguese.`,
            },
            { type: "image_url", image_url: { url: logoUrl } },
          ],
        },
      ],
    });
    if (!result.ok) {
      console.error("Logo analysis failed:", result.status, result.errorBody);
      return null;
    }
    return result.data?.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Logo analysis error:", e);
    return null;
  }
}

/**
 * The logo analysis only depends on the logo file, so it is cached on the brand
 * kit (keyed by storage path) instead of paying a vision call on every generation.
 */
async function getLogoAnalysis(projectId: string, logoUrl: string, track: Track): Promise<string | null> {
  const parsed = parseStorageUrl(logoUrl);
  const cacheKey = parsed ? `${parsed.bucket}/${parsed.path}` : null;
  const db = adminClient();
  if (cacheKey) {
    const { data: kit } = await db
      .from("brand_kits")
      .select("logo_analysis, logo_analysis_source")
      .eq("project_id", projectId)
      .maybeSingle();
    if (kit?.logo_analysis && kit.logo_analysis_source === cacheKey) return kit.logo_analysis;
  }
  const analysis = await analyzeLogoContent(logoUrl, track);
  if (analysis && cacheKey) {
    await db.from("brand_kits")
      .update({ logo_analysis: analysis, logo_analysis_source: cacheKey })
      .eq("project_id", projectId);
  }
  return analysis;
}

/** Keep the project context short so it guides tone and scene without flooding the image prompt. */
function buildContextSection(context: string | null, voiceGuide: string | null): string | null {
  const ctx = (context || "").trim();
  const voice = (voiceGuide || "").trim();
  if (!ctx && !voice) return null;
  const parts = [`═══ SEÇÃO 1B: CONTEXTO DO PROJETO (referência de tom e público) ═══`];
  if (ctx) parts.push(`Sobre o negócio:\n${ctx.slice(0, 2500)}`);
  if (voice) parts.push(`Tom de voz:\n${voice.slice(0, 1200)}`);
  parts.push(`Use este contexto para escolher cenário, pessoas, objetos e estilo coerentes com o negócio e o público.
NÃO escreva na imagem nenhum texto que o usuário não pediu — o contexto orienta o visual, não adiciona copy.`);
  return parts.join("\n\n");
}

/* ------------------------------------------------------------------ */
/*  Helper: build the structured instruction block for user content   */
/* ------------------------------------------------------------------ */
interface BrandKitInput {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  auxColors?: string[] | null;
  typography?: string | null;
  logoUrl?: string | null;
  personPhotoUrl?: string | null;
  personGridUrl?: string | null;
}

interface ElementOverride {
  texts: Record<string, { original: string; value: string; action: 'keep' | 'replace' | 'remove' }>;
  logos: Record<string, { action: 'keep' | 'replace' }>;
  photos: Record<string, { action: 'keep' | 'replace' }>;
}

function buildInstructionBlock(
  userPrompt: string,
  format: string,
  brandKit: BrandKitInput | null,
  hasLogo: boolean,
  hasPersonPhoto: boolean,
  photoMode: "replace" | "swap",
  logoAnalysis: string | null = null,
  elementOverrides: ElementOverride | null = null,
  ignoreBrandKit: boolean = false,
  logoPosition: string | null = null,
  logoSize: string | null = null,
  personPosition: string | null = null,
  contextSection: string | null = null,
): string {
  const sections: string[] = [];

  /* --- 1. OBJETIVO PRINCIPAL --- */
  sections.push(`═══ SEÇÃO 1: OBJETIVO PRINCIPAL ═══
Formato de saída: ${format} (aspect ratio).
Instrução do usuário:
"${userPrompt}"

IMPORTANTE: Tudo que o usuário escreveu acima é uma ORDEM OBRIGATÓRIA. Cada palavra, cada pedido, cada detalhe DEVE ser executado na imagem final. Não ignore nenhuma parte desta instrução.`);

  if (contextSection) sections.push(contextSection);

  /* --- 2. TEXTO OBRIGATÓRIO --- */
  const textRules: string[] = [];
  textRules.push(`═══ SEÇÃO 2: REGRAS DE TEXTO ═══
- Se o usuário especificou qualquer texto (headline, CTA, subtítulo, copy, frase), esse texto DEVE aparecer EXATAMENTE como escrito na imagem final.
- Se o usuário pediu para "trocar", "substituir", "alterar" ou "mudar" qualquer texto da referência, o texto original DEVE ser completamente removido e substituído pelo novo texto solicitado.
- NUNCA invente, modifique ou parafraseie textos que o usuário especificou. Use as palavras EXATAS fornecidas.
- Se o usuário pediu para "manter a estrutura visual" ou "manter o layout", mantenha o posicionamento dos elementos mas aplique os textos e cores solicitados.
- Textos da imagem de referência que NÃO foram mencionados pelo usuário podem ser mantidos, mas devem seguir as regras de cor e tipografia do Brand Kit.
- TODOS os textos DEVEM ser posicionados nos MESMOS locais da imagem de referência, com os MESMOS tamanhos relativos e a MESMA hierarquia visual.
- Mantenha o MESMO espaçamento, alinhamento e proporção entre os textos da referência.`);

  if (ignoreBrandKit) {
    textRules.push(`
⚠️ BRAND KIT IGNORADO — REGRAS DE FIDELIDADE TIPOGRÁFICA:
- Como o Brand Kit foi intencionalmente ignorado, COPIE EXATAMENTE a tipografia (fonte, peso, estilo) visível na imagem de referência.
- NÃO substitua por outra fonte. Use a MESMA fonte que aparece na referência.
- COPIE EXATAMENTE as cores e estilos visuais da imagem de referência.
- O objetivo é replicar o visual da referência o mais fielmente possível.`);
  }

  sections.push(textRules.join("\n"));

  /* --- 3. CORES E TIPOGRAFIA --- */
  if (brandKit) {
    const colorRules: string[] = [];
    colorRules.push(`═══ SEÇÃO 3: MAPA OBRIGATÓRIO DE CORES E TIPOGRAFIA ═══`);
    colorRules.push(`ATENÇÃO: As regras abaixo são OBRIGATÓRIAS independentemente de o logo ou a foto de pessoa estarem ativados. O Brand Kit de cores e tipografia SEMPRE se aplica.`);

    if (brandKit.backgroundColor) {
      colorRules.push(`
🎨 FUNDO DA IMAGEM:
   Cor exata: ${brandKit.backgroundColor}
   - O fundo DEVE ser esta cor sólida.
   - PROIBIDO adicionar gradientes, texturas, padrões, linhas ou formas decorativas ao fundo que não existam na referência original.
   - Se a referência tem um fundo com foto/imagem, mantenha a foto mas ajuste áreas sólidas para esta cor.`);
    }

    if (brandKit.primaryColor) {
      colorRules.push(`
🎨 COR PRIMÁRIA: ${brandKit.primaryColor}
   USAR OBRIGATORIAMENTE em:
   ✓ Headlines / títulos principais
   ✓ Fundo de botões e CTAs
   ✓ Elementos de destaque principais
   ✓ Ícones principais
   ✓ Bordas ou contornos de destaque`);
    }

    if (brandKit.secondaryColor) {
      colorRules.push(`
🎨 COR SECUNDÁRIA: ${brandKit.secondaryColor}
   USAR OBRIGATORIAMENTE em:
   ✓ Subtítulos e textos de apoio
   ✓ Texto dentro de botões/CTAs (quando o fundo do botão for a cor primária)
   ✓ Elementos secundários e complementares
   ✓ Badges, etiquetas, tags
   ✓ Textos descritivos`);
    }

    if (brandKit.auxColors?.length) {
      colorRules.push(`
🎨 CORES AUXILIARES: ${brandKit.auxColors.join(", ")}
   USAR APENAS em:
   ✓ Pequenos detalhes decorativos
   ✓ Separadores ou linhas finas
   ✓ Ícones menores
   ✓ Acentos visuais sutis`);
    }

    if (brandKit.primaryColor || brandKit.secondaryColor) {
      colorRules.push(`
🎨 REGRA ESPECÍFICA PARA BOTÕES E CTAs:
   - Fundo do botão: cor primária ${brandKit.primaryColor ? `(${brandKit.primaryColor})` : ""}
   - Texto do botão: cor secundária ${brandKit.secondaryColor ? `(${brandKit.secondaryColor})` : ""} OU branco — usar o que tiver MELHOR contraste legível
   - NUNCA deixe botões com cores genéricas, cinza, ou fora do brand kit`);
    }

    if (brandKit.typography) {
      colorRules.push(`
🔤 TIPOGRAFIA OBRIGATÓRIA: "${brandKit.typography}"
   - TODOS os textos da imagem DEVEM usar esta fonte ou o equivalente visual mais próximo.
   - NÃO substitua por Arial, Helvetica, sans-serif genérico ou qualquer outra fonte.
   - Mantenha o estilo (bold, regular, italic) conforme a hierarquia do texto.`);
    }

    colorRules.push(`
⛔ PROIBIÇÃO ABSOLUTA DE CORES:
   - NENHUM elemento visual (texto, fundo, botão, CTA, ícone, borda, sombra, forma) pode usar uma cor que NÃO esteja listada acima.
   - Se precisar de uma cor não listada para contraste ou legibilidade, use BRANCO (#FFFFFF) ou PRETO (#000000) como último recurso.
   - Esta regra se aplica SEMPRE, mesmo quando o logo ou a foto de pessoa NÃO estiverem ativados.`);

    sections.push(colorRules.join("\n"));
  }

  /* --- 4. REGRAS DE LOGO --- */
  if (hasLogo) {
    // Build logo size instruction — user-specified logoSize takes priority over reference matching
    let logoSizeInstruction: string;
    if (logoSize === 'small') {
      logoSizeInstruction = `📏 REGRA DE ESCALA (CRÍTICA — DEFINIDA PELO USUÁRIO):
- O logo deve ser DISCRETO e PEQUENO, ocupando no máximo 1.5-2.5% da área total da imagem.
- IGNORE qualquer tamanho de logo que apareça na referência. O tamanho solicitado pelo usuário TEM PRIORIDADE ABSOLUTA.
- NUNCA tornar o logo o elemento visual dominante.`;
    } else if (logoSize === 'large') {
      logoSizeInstruction = `📏 REGRA DE ESCALA (CRÍTICA — DEFINIDA PELO USUÁRIO):
- O logo deve ser BEM VISÍVEL e PROEMINENTE, ocupando ~6-9% da área total da imagem.
- IGNORE qualquer tamanho de logo que apareça na referência. O tamanho solicitado pelo usuário TEM PRIORIDADE ABSOLUTA.
- O logo deve ter presença visual forte e ser facilmente identificável.`;
    } else if (logoSize === 'normal') {
      logoSizeInstruction = `📏 REGRA DE ESCALA (CRÍTICA — DEFINIDA PELO USUÁRIO):
- O logo deve ter tamanho MODERADO, ocupando ~3-4% da área total da imagem.
- IGNORE qualquer tamanho de logo que apareça na referência. O tamanho solicitado pelo usuário TEM PRIORIDADE ABSOLUTA.`;
    } else {
      // No user-specified size — fall back to reference matching
      logoSizeInstruction = `📏 REGRA DE ESCALA (CRÍTICA):
- O novo logo DEVE ter o MESMO tamanho relativo que o logo da referência em relação à área total da imagem.
- Se o logo da referência ocupa aproximadamente 5% da área da imagem, o novo logo DEVE ocupar aproximadamente 5%.
- NUNCA ampliar o logo para um tamanho maior que o da referência.
- NUNCA tornar o logo o elemento visual dominante — ele é um elemento de assinatura, discreto e proporcional.
- Se NÃO houver logo na referência, use um tamanho que ocupe no máximo 5-8% da área total da imagem.`;
    }

    sections.push(`═══ SEÇÃO 4: REGRAS DO LOGO ═══
Uma imagem de LOGO será fornecida separadamente. Regras OBRIGATÓRIAS:

📐 REGRA DE POSIÇÃO (CRÍTICA):
- Analise a imagem de REFERÊNCIA e identifique onde está posicionado o logo original (canto, margem, distância das bordas).
- O novo logo DEVE ser posicionado EXATAMENTE no mesmo local: mesmo canto, mesma margem, mesma distância relativa das bordas da imagem.
- Se o logo da referência está no canto inferior direito com ~3% de margem, o novo logo DEVE estar no canto inferior direito com ~3% de margem.
- Se NÃO houver logo na referência, posicione no canto inferior direito com margem de segurança de ~3-5% das bordas.

${logoSizeInstruction}

🛡️ REGRA DE INTEGRIDADE (CRÍTICA):
- O logo DEVE aparecer 100% COMPLETO — PROIBIDO cortar, recortar ou ocultar qualquer pixel do logo.
- Mantenha uma MARGEM DE SEGURANÇA ao redor do logo para garantir que nenhuma borda seja cortada.
- COPIE o logo EXATAMENTE como fornecido — mesma forma, mesmas cores internas, mesmas proporções.
- NÃO redesenhe, NÃO recrie, NÃO simplifique, NÃO altere as cores internas do logo.
- Mantenha as PROPORÇÕES ORIGINAIS exatas — não distorça horizontalmente ou verticalmente.

🚫 REGRA DE SOBREPOSIÇÃO:
- NENHUM outro elemento (texto, pessoa, forma, decoração) pode sobrepor ou ocultar qualquer parte do logo.
- Se necessário, ajuste outros elementos para evitar sobreposição com o logo.

🎨 REGRA DE FUNDO DO LOGO:
- Se o logo precisa de contraste para ser legível, use um container discreto com opacidade sutil, nunca maior que o necessário.
- NÃO adicione fundos coloridos grandes ou chamativas atrás do logo.

${logoAnalysis ? `📝 CONTEÚDO DO LOGO DETECTADO POR ANÁLISE PRÉVIA:
${logoAnalysis}

- Cada texto listado acima DEVE aparecer LEGÍVEL e COMPLETO no logo final.
- Se o logo tem texto no TOPO, a parte SUPERIOR do logo NÃO pode ser cortada.
- Se o logo tem texto na BASE, a parte INFERIOR do logo NÃO pode ser cortada.
- Use esta descrição para garantir que NENHUMA parte do logo seja omitida ou cortada.
- O logo reproduzido deve conter EXATAMENTE os mesmos textos detectados.` : ""}

${logoPosition ? `📍 POSIÇÃO SOLICITADA PELO USUÁRIO: ${logoPosition.replace('-', ' ')} da imagem.
- Se o usuário especificar algo diferente no prompt, prevalece o prompt.` : ''}

⚠️ COEXISTÊNCIA: Se uma foto de pessoa TAMBÉM foi fornecida, AMBOS devem aparecer na imagem final. O logo NÃO substitui a pessoa. A pessoa NÃO substitui o logo. São assets independentes.`);
  }

  /* --- 5. REGRAS DE PESSOA --- */
  if (hasPersonPhoto) {
    if (photoMode === "replace") {
      sections.push(`═══ SEÇÃO 5: REGRAS DE PESSOA (MODO: SUBSTITUIÇÃO DE FOTO) ═══
Uma foto de PESSOA será fornecida separadamente. O usuário quer SUBSTITUIR a fotografia/imagem existente por esta pessoa.
✓ Use esta pessoa como o sujeito principal da área onde havia uma pessoa na referência
✓ A pessoa final DEVE ser visualmente IDÊNTICA à foto fornecida — mesmo rosto, mesmos traços, mesmo tom de pele, mesmo cabelo
✓ Adapte a pose e enquadramento para se encaixar naturalmente no layout da referência
✓ NÃO gere um rosto inventado ou diferente do fornecido
✓ Se NÃO houver pessoa na referência, posicione esta pessoa de forma harmônica no criativo

${personPosition ? `📍 POSIÇÃO SOLICITADA PELO USUÁRIO: ${personPosition.replace('-', ' ')} da imagem.
- Se o usuário especificar algo diferente no prompt, prevalece o prompt.` : ''}

⚠️ COEXISTÊNCIA: Se um LOGO também foi fornecido, AMBOS devem aparecer. A pessoa NÃO substitui o logo.`);
    } else {
      sections.push(`═══ SEÇÃO 5: REGRAS DE PESSOA (MODO: FACE SWAP) ═══
Uma foto de PESSOA será fornecida separadamente. Regras OBRIGATÓRIAS:
✓ SUBSTITUA a pessoa que aparece na imagem de referência por esta pessoa
✓ MANTENHA a MESMA pose, enquadramento, roupas, cenário e contexto da referência original
✓ Apenas TROQUE o rosto e as características físicas (tom de pele, cabelo, traços faciais) pela pessoa da foto fornecida
✓ A pessoa no criativo final DEVE ser visualmente IDÊNTICA à foto fornecida — mesmo rosto, mesmos traços
✓ NÃO gere um rosto inventado ou diferente
✓ NÃO altere a pose, roupa ou cenário da referência
✓ Se NÃO houver uma pessoa na referência original, posicione a pessoa fornecida de forma natural e harmônica

${personPosition ? `📍 POSIÇÃO SOLICITADA PELO USUÁRIO: ${personPosition.replace('-', ' ')} da imagem.
- Se o usuário especificar algo diferente no prompt, prevalece o prompt.` : ''}

⚠️ COEXISTÊNCIA: Se um LOGO também foi fornecido, AMBOS devem aparecer. A pessoa NÃO substitui o logo. O logo NÃO substitui a pessoa.`);
    }
  }

  /* --- 6. MAPA DE ELEMENTOS DETECTADOS --- */
  if (elementOverrides) {
    const mapLines: string[] = [];
    mapLines.push(`═══ SEÇÃO 6: MAPA DE ELEMENTOS DETECTADOS ═══`);
    mapLines.push(`A imagem de referência foi pré-analisada. O usuário editou os elementos abaixo. Siga CADA instrução:`);
    mapLines.push('');

    for (const [id, ov] of Object.entries(elementOverrides.texts)) {
      if (ov.action === 'remove') {
        mapLines.push(`🔤 ${id}: REMOVER — o texto "${ov.original}" deve ser COMPLETAMENTE REMOVIDO da imagem. Não deixe vestígios.`);
      } else if (ov.action === 'replace') {
        mapLines.push(`🔤 ${id}: SUBSTITUIR — trocar "${ov.original}" → "${ov.value}" (manter mesma posição e estilo).`);
      } else {
        mapLines.push(`🔤 ${id}: MANTER — texto "${ov.original}" deve permanecer como está.`);
      }
    }

    for (const [id, ov] of Object.entries(elementOverrides.logos)) {
      if (ov.action === 'replace') {
        mapLines.push(`🏷️ ${id}: SUBSTITUIR pelo logo do Brand Kit fornecido.`);
      } else {
        mapLines.push(`🏷️ ${id}: MANTER o logo original da referência.`);
      }
    }

    for (const [id, ov] of Object.entries(elementOverrides.photos)) {
      if (ov.action === 'replace') {
        mapLines.push(`📸 ${id}: SUBSTITUIR pela foto de pessoa do Brand Kit fornecida.`);
      } else {
        mapLines.push(`📸 ${id}: MANTER a foto/pessoa original da referência.`);
      }
    }

    sections.push(mapLines.join('\n'));
  }

  /* --- 7. CHECKLIST FINAL --- */
  const checklistItems: string[] = [];
  checklistItems.push("□ O formato de saída está correto (aspect ratio)?");
  checklistItems.push("□ TODOS os textos solicitados pelo usuário aparecem EXATAMENTE como escritos?");
  checklistItems.push("□ Textos que o usuário pediu para remover/substituir foram de fato removidos/substituídos?");
  
  if (brandKit) {
    if (brandKit.backgroundColor) checklistItems.push(`□ O fundo usa a cor ${brandKit.backgroundColor}?`);
    if (brandKit.primaryColor) checklistItems.push(`□ Headlines e botões usam a cor primária ${brandKit.primaryColor}?`);
    if (brandKit.secondaryColor) checklistItems.push(`□ Subtítulos e textos de botão usam a cor secundária ${brandKit.secondaryColor}?`);
    if (brandKit.typography) checklistItems.push(`□ Todos os textos usam a fonte "${brandKit.typography}"?`);
    checklistItems.push("□ NENHUM elemento usa cor fora do brand kit?");
  }
  
  if (hasLogo) {
    if (logoSize) {
      checklistItems.push(`□ O logo está no tamanho solicitado pelo usuário (${logoSize === 'small' ? 'PEQUENO 1.5-2.5%' : logoSize === 'large' ? 'GRANDE 6-9%' : 'MODERADO 3-4%'} da área)?`);
    } else {
      checklistItems.push("□ O logo tem o MESMO tamanho relativo que o logo na referência (não está ampliado)?");
    }
    checklistItems.push("□ O logo está no MESMO local/canto que o logo na referência?");
    checklistItems.push("□ O logo está 100% visível com margem de segurança, sem NENHUM pixel cortado?");
    checklistItems.push("□ As cores internas do logo estão inalteradas?");
    checklistItems.push("□ Nenhum elemento sobrepõe qualquer parte do logo?");
  }
  
  if (hasPersonPhoto) {
    checklistItems.push("□ A pessoa na imagem é visualmente idêntica à foto fornecida?");
    checklistItems.push("□ O rosto NÃO foi inventado ou alterado?");
  }
  
  if (hasLogo && hasPersonPhoto) {
    checklistItems.push("□ AMBOS o logo E a pessoa aparecem na imagem final simultaneamente?");
  }

  if (elementOverrides) {
    checklistItems.push("□ Cada elemento do MAPA DE ELEMENTOS foi tratado conforme a ação especificada (manter/substituir/remover)?");
    checklistItems.push("□ Textos marcados para REMOVER foram completamente apagados?");
    checklistItems.push("□ Textos marcados para SUBSTITUIR aparecem com o novo conteúdo EXATO?");
  }

  sections.push(`═══ SEÇÃO FINAL: CHECKLIST DE FIDELIDADE ═══
Antes de finalizar a imagem, verifique CADA item abaixo. Se qualquer item falhar, REFAÇA a imagem:

${checklistItems.join("\n")}

Se TODOS os itens estiverem verificados, a imagem está pronta.`);

  return sections.join("\n\n");
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */
serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  // Edge-function hard limit is ~150s; every step (logo analysis included) counts.
  const START_TS = Date.now();

  try {
    const bodyRaw = await req.json();
    const { prompt, format, swipeFileId, projectId, elementOverrides, mode, templateId, templateFields, ignoreContext, ignoreBrandKit, logoPosition, logoSize, personPosition } = bodyRaw;

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;
    const authenticatedUserId = authed.userId;
    const track: Track = { functionName: "generate-creative", projectId, userId: authenticatedUserId };

    const creationMode = mode || 'swipe';
    if (!Deno.env.get("OPENROUTER_API_KEY")) throw new Error("OPENROUTER_API_KEY not configured");

    const db = adminClient();

    // Storage buckets are private: make sure every image URL of this project that
    // we hand to the AI provider is signed (attachments, for instance, arrive in
    // public-URL format). Files of other projects are never signed here.
    const sign = (u: string | null | undefined) => signProjectStorageUrl(db, u, projectId);
    const swipeFileUrl = await sign(bodyRaw.swipeFileUrl);
    const attachedImages: string[] = await Promise.all(
      (Array.isArray(bodyRaw.attachedImages) ? bodyRaw.attachedImages : []).map(async (u: string) => (await sign(u)) ?? u),
    );
    const brandKit = bodyRaw.brandKit
      ? {
        ...bodyRaw.brandKit,
        logoUrl: await sign(bodyRaw.brandKit.logoUrl),
        personPhotoUrl: await sign(bodyRaw.brandKit.personPhotoUrl),
        personGridUrl: await sign(bodyRaw.brandKit.personGridUrl),
      }
      : null;

    const hasLogo = !!(brandKit?.logoUrl);
    const hasPersonPhoto = !!(brandKit?.personPhotoUrl);
    const hasPersonGrid = !!(brandKit?.personGridUrl);
    const photoMode = detectPhotoMode(prompt || '');

    let logoAnalysis: string | null = null;
    if (hasLogo) {
      logoAnalysis = await getLogoAnalysis(projectId, brandKit.logoUrl, track);
      console.log("Logo analysis:", logoAnalysis ? "ok" : "failed");
    }

    // Project context & voice guide (the "Usar contexto" toggle used to be ignored here).
    let contextSection: string | null = null;
    if (!ignoreContext) {
      const { data: project } = await db
        .from("projects")
        .select("context, voice_guide")
        .eq("id", projectId)
        .maybeSingle();
      contextSection = buildContextSection(project?.context ?? null, project?.voice_guide ?? null);
    }

    /* ---- Build prompt & content based on creation mode ---- */
    let effectivePrompt = prompt || '';
    let systemPrompt = '';
    let templateBaseImageUrl: string | null = null;
    const userContent: any[] = [];

    if (creationMode === 'templates' && templateId && templateFields) {
      // Fetch template prompt from database
      const { data: tpRow } = await db
        .from("template_prompts")
        .select("prompt, style_prompt, base_image_url")
        .eq("id", templateId)
        .single();

      const compositionPrompt = tpRow?.prompt || '';
      const stylePrompt = tpRow?.style_prompt || '';
      // Sign private-bucket URL for external AI access
      templateBaseImageUrl = await signStorageUrl(db, tpRow?.base_image_url || null);
      const fieldLines = Object.entries(templateFields)
        .filter(([_, v]) => v && (v as string).trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

      effectivePrompt = `COMPOSIÇÃO E LAYOUT:\n${compositionPrompt}\n\nESTILO VISUAL E ESTÉTICA:\n${stylePrompt}\n\nElementos do anúncio:\n${fieldLines}${prompt ? `\n\nInstruções adicionais: ${prompt}` : ''}`;

      systemPrompt = `You are an expert advertising creative designer. You create high-converting ad creatives based on proven ad structures/templates. Generate a professional ad image following the template structure described. Apply all brand kit rules with ZERO deviation.

CRITICAL RULES:
- Every text specified is MANDATORY — reproduce it EXACTLY
- Brand kit colors are MANDATORY for every visual element
- Brand kit typography is MANDATORY for every text element
- Follow the template structure precisely`;

    } else if (creationMode === 'free') {
      systemPrompt = `You are an expert advertising creative designer. You create professional ad creatives from scratch based on the user's description. Apply all brand kit rules with ZERO deviation.

CRITICAL RULES:
- Every text the user specifies is MANDATORY — reproduce it EXACTLY
- Brand kit colors are MANDATORY for every visual element
- Brand kit typography is MANDATORY for every text element
- Logo integrity is ABSOLUTE — never crop, redraw, or recolor
- Person photo fidelity is ABSOLUTE — the face must match exactly`;

    } else {
      systemPrompt = `You are an expert advertising creative designer specializing in pixel-perfect brand compliance. You receive a REFERENCE creative image and a structured instruction block. Your job is to generate a new creative that:

1. FOLLOWS the visual structure and layout of the reference image
2. EXECUTES every instruction in the instruction block as MANDATORY rules
3. APPLIES all brand kit rules (colors, typography, logo, person) with ZERO deviation
4. NEVER ignores any part of the user's request

You process MULTIPLE assets simultaneously. When both a logo AND a person photo are provided, BOTH must appear in the final image. One does NOT replace the other.

CRITICAL RULES:
- Every text the user specifies is MANDATORY — reproduce it EXACTLY
- Brand kit colors are MANDATORY for every visual element — no exceptions
- Brand kit typography is MANDATORY for every text element — no exceptions
- Logo integrity is ABSOLUTE — never crop, redraw, or recolor
- Person photo fidelity is ABSOLUTE — the face must match exactly
- When multiple assets are provided, ALL must be present in the final image`;
    }

    // Build user content based on mode
    if (creationMode === 'swipe') {
      const instructionBlock = buildInstructionBlock(
        effectivePrompt, format, brandKit, hasLogo,
        hasPersonPhoto || hasPersonGrid, photoMode, logoAnalysis,
        elementOverrides || null, !!ignoreBrandKit,
        logoPosition || null, logoSize || null, personPosition || null,
        contextSection,
      );
      userContent.push(
        { type: "text", text: "📎 IMAGEM DE REFERÊNCIA (use como base de layout e estrutura visual):" },
        { type: "image_url", image_url: { url: swipeFileUrl } },
        { type: "text", text: instructionBlock },
      );
    } else {
      const instructionBlock = buildInstructionBlock(
        effectivePrompt, format, brandKit, hasLogo,
        hasPersonPhoto || hasPersonGrid, photoMode, logoAnalysis, null, !!ignoreBrandKit,
        logoPosition || null, logoSize || null, personPosition || null,
        contextSection,
      );
      userContent.push({ type: "text", text: instructionBlock });

      // Template base image
      if (creationMode === 'templates' && templateBaseImageUrl) {
        userContent.push(
          { type: "text", text: "📎 IMAGEM BASE DO MODELO (use como referência visual de estrutura e layout para este tipo de anúncio):" },
          { type: "image_url", image_url: { url: templateBaseImageUrl } },
        );
      }

      if (attachedImages?.length > 0) {
        userContent.push({ type: "text", text: "📎 IMAGENS DE REFERÊNCIA ANEXADAS PELO USUÁRIO:" });
        for (const imgUrl of attachedImages) {
          userContent.push({ type: "image_url", image_url: { url: imgUrl } });
        }
      }
    }

    // Logo asset
    if (hasLogo) {
      const logoLabel = logoAnalysis
        ? `📎 LOGO DA MARCA (asset obrigatório — contém: ${logoAnalysis.substring(0, 200)}... — incluir 100% COMPLETO sem cortes):`
        : "📎 LOGO DA MARCA (asset obrigatório — incluir COMPLETO sem cortes, sem alterar cores internas, sem redesenhar):";
      userContent.push(
        { type: "text", text: logoLabel },
        { type: "image_url", image_url: { url: brandKit.logoUrl } },
      );
    }

    // Person photo or grid
    if (hasPersonGrid) {
      userContent.push(
        { type: "text", text: "📎 GRID MULTI-ÂNGULO DA PESSOA (asset obrigatório):" },
        { type: "image_url", image_url: { url: brandKit.personGridUrl } },
      );
    } else if (hasPersonPhoto) {
      const personLabel = photoMode === "replace"
        ? "📎 FOTO DA PESSOA (asset obrigatório — substituir pessoa existente):"
        : "📎 FOTO DA PESSOA (asset obrigatório — face swap):";
      userContent.push(
        { type: "text", text: personLabel },
        { type: "image_url", image_url: { url: brandKit.personPhotoUrl } },
      );
    }

    // Final coexistence reminder
    if (hasLogo && (hasPersonPhoto || hasPersonGrid)) {
      userContent.push({
        type: "text",
        text: "⚠️ LEMBRETE FINAL: Tanto o LOGO quanto a PESSOA foram fornecidos. AMBOS DEVEM aparecer na imagem final.",
      });
    }

    const result = await generateImageWithCascade({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      aspectRatio: format,
      track,
      startedAt: START_TS,
    });

    if (!result.ok || !result.image) {
      const failure = imageFailurePayload(result);
      return jsonResponse(failure.body, failure.status, failure.headers);
    }

    const imageBytes = await imageToBytes(result.image);
    const publicUrl = await uploadGeneratedImage(db, "generated-creatives", projectId, imageBytes);
    const totalCost = (result.costUsd || 0);

    // Save to database
    const { data: inserted, error: dbError } = await db.from("generated_creatives").insert({
      project_id: projectId,
      swipe_file_id: swipeFileId || null,
      image_url: publicUrl,
      prompt: effectivePrompt,
      format,
      created_by: authenticatedUserId,
      kind: "generate",
      model_used: result.model,
      cost_usd: totalCost,
      generation_meta: {
        mode: creationMode,
        format,
        hasLogo,
        hasPerson: hasPersonPhoto || hasPersonGrid,
        ignoreBrandKit: !!ignoreBrandKit,
        ignoreContext: !!ignoreContext,
        logoSize: logoSize || null,
        logoPosition: logoPosition || null,
        personPosition: personPosition || null,
        attempts: result.attempts,
      },
    }).select("id").single();
    if (dbError) throw dbError;

    return jsonResponse({ success: true, imageUrl: publicUrl, creativeId: inserted.id, model: result.model, costUsd: totalCost });
  } catch (e) {
    console.error("generate-creative error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
