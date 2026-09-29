import { generateImageWithCascade, imageFailurePayload } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { insertCreative } from "../_shared/creatives.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, imageToBytes, parseStorageUrl, signStorageUrl, uploadGeneratedImage } from "../_shared/storage.ts";

/**
 * Turns an existing image into a new creative. One call = one output image.
 *
 *  operation "resize" → adapt a generated creative to another format (Redimensionar)
 *  operation "unfold" → adapt an uploaded key visual to another format (Desdobramento)
 *  operation "fix"    → edit a creative to fix the issues found by review-creative
 *
 * Body: { projectId, operation, targetFormat?, creativeId?, sourceImageUrl?, instructions?, issues? }
 */

type Operation = "resize" | "unfold" | "fix";

const FORMAT_HINTS: Record<string, string> = {
  "9:16": "Vertical tela cheia (Stories/Reels/TikTok). Mantenha textos, logo e rosto FORA dos ~14% superiores e ~20% inferiores (zonas cobertas pela interface do app). Empilhe os elementos verticalmente.",
  "4:5": "Vertical de feed. Aproveite a altura extra: dê respiro entre headline, imagem principal e CTA.",
  "1:1": "Quadrado de feed. Composição equilibrada e centralizada; nada encostado nas bordas.",
  "16:9": "Horizontal (banner, YouTube, display). Distribua os elementos lado a lado: normalmente imagem/pessoa de um lado e textos do outro.",
  "1.91:1": "Horizontal de link/anúncio. Composição lado a lado com textos curtos e grandes.",
};

function formatHint(format: string): string {
  return FORMAT_HINTS[format] ?? `Proporção ${format}. Recomponha os elementos para ocupar bem este formato.`;
}

function adaptPrompt(targetFormat: string, sourceFormat: string | null, instructions: string | null): string {
  return `Você é um diretor de arte especialista em DESDOBRAMENTO de peças publicitárias.

A imagem anexada é a PEÇA-MÃE${sourceFormat ? ` (formato ${sourceFormat})` : ""}. Crie a versão desta MESMA peça no formato ${targetFormat}.

FORMATO DE SAÍDA: ${targetFormat} (aspect ratio). ${formatHint(targetFormat)}

REGRAS OBRIGATÓRIAS:
1. MESMA PEÇA: é uma adaptação, não um criativo novo. Mesmo conceito, mesma identidade visual, mesma paleta de cores, mesma tipografia, mesmo estilo de imagem.
2. TEXTOS IDÊNTICOS: todos os textos da peça-mãe (headline, subtítulo, CTA, selos, preços, rodapé legal) devem aparecer EXATAMENTE com as mesmas palavras, sem erros de digitação, sem inventar textos novos e sem omitir nenhum.
3. LOGO: se houver logo, ele deve aparecer COMPLETO, com as mesmas cores e proporções, sem cortes e sem ser redesenhado.
4. PESSOAS E PRODUTOS: mesmas pessoas (mesmo rosto, cabelo, roupa) e mesmos produtos. Não troque, não deforme.
5. RECOMPOSIÇÃO INTELIGENTE: NÃO apenas corte nem estique a imagem. Reorganize os elementos para o novo formato, estendendo o fundo/cenário de forma natural quando precisar de mais área.
6. HIERARQUIA: mantenha a mesma ordem de importância (headline em destaque, CTA claramente visível).
7. Nenhum elemento importante pode ficar cortado pelas bordas; mantenha margem de segurança de ~5%.
${instructions ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO (prioridade sobre as regras de layout acima):\n"${instructions}"` : ""}`;
}

function fixPrompt(format: string, originalPrompt: string | null, issues: string[], instructions: string | null): string {
  return `Você é um editor de imagens publicitárias. A imagem anexada é um criativo que passou por revisão e tem problemas específicos.

EDITE a imagem corrigindo APENAS os problemas listados. Todo o resto deve permanecer IDÊNTICO (layout, cores, pessoas, textos corretos, estilo).

FORMATO: mantenha ${format}.

PROBLEMAS A CORRIGIR:
${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}
${instructions ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n"${instructions}"` : ""}
${originalPrompt ? `\nPara referência, este era o pedido original do criativo (use para saber os textos corretos):\n"""\n${originalPrompt.slice(0, 3000)}\n"""` : ""}`;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  const START_TS = Date.now();

  try {
    const body = await req.json();
    const { projectId, creativeId } = body;
    const operation: Operation = body.operation;
    const instructions: string | null = typeof body.instructions === "string" && body.instructions.trim() ? body.instructions.trim().slice(0, 2000) : null;

    if (!["resize", "unfold", "fix"].includes(operation)) {
      return jsonResponse({ error: "operation inválida" }, 400);
    }

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;
    const userId = authed.userId;
    const track = { functionName: `transform-creative:${operation}`, projectId, userId };
    const db = adminClient();

    // ── Resolve the source image ──
    let parent: any = null;
    let sourceUrl: string | null = null;
    if (creativeId) {
      const { data } = await db
        .from("generated_creatives")
        .select("*") // "*" keeps working even before the new columns exist
        .eq("id", creativeId)
        .maybeSingle();
      if (!data || data.project_id !== projectId) return jsonResponse({ error: "Criativo não encontrado" }, 404);
      parent = data;
      sourceUrl = data.image_url;
    } else if (typeof body.sourceImageUrl === "string") {
      // Uploaded key visual: must live in this project's folder of our storage.
      const parsed = parseStorageUrl(body.sourceImageUrl);
      if (!parsed || parsed.bucket !== "generated-creatives" || !parsed.path.startsWith(`${projectId}/`)) {
        return jsonResponse({ error: "Imagem de origem inválida" }, 400);
      }
      sourceUrl = body.sourceImageUrl;
    }
    if (!sourceUrl) return jsonResponse({ error: "Informe creativeId ou sourceImageUrl" }, 400);

    const signedSource = await signStorageUrl(db, sourceUrl);
    const sourceFormat: string | null = parent?.format ?? (typeof body.sourceFormat === "string" ? body.sourceFormat : null);

    // ── Build prompt ──
    let targetFormat: string;
    let promptText: string;
    if (operation === "fix") {
      targetFormat = parent?.format || body.targetFormat || "1:1";
      const issues: string[] = Array.isArray(body.issues)
        ? body.issues.filter((i: unknown) => typeof i === "string" && i.trim()).slice(0, 10)
        : [];
      if (!issues.length && !instructions) return jsonResponse({ error: "Nada para corrigir" }, 400);
      promptText = fixPrompt(targetFormat, parent?.prompt ?? null, issues, instructions);
    } else {
      targetFormat = body.targetFormat;
      if (!targetFormat) return jsonResponse({ error: "targetFormat é obrigatório" }, 400);
      promptText = adaptPrompt(targetFormat, sourceFormat, instructions);
    }

    const userContent: any[] = [
      { type: "text", text: operation === "fix" ? "📎 CRIATIVO A CORRIGIR:" : "📎 PEÇA-MÃE:" },
      { type: "image_url", image_url: { url: signedSource } },
      { type: "text", text: promptText },
    ];

    // Logo issues need the real logo as reference.
    if (operation === "fix" && Array.isArray(body.issues) && body.includeLogo) {
      const { data: kit } = await db.from("brand_kits").select("logo_url").eq("project_id", projectId).maybeSingle();
      const logo = await signStorageUrl(db, kit?.logo_url ?? null);
      if (logo) {
        userContent.push(
          { type: "text", text: "📎 LOGO CORRETO DA MARCA (use exatamente este):" },
          { type: "image_url", image_url: { url: logo } },
        );
      }
    }

    const result = await generateImageWithCascade({
      messages: [{ role: "user", content: userContent }],
      aspectRatio: targetFormat,
      track,
      startedAt: START_TS,
    });

    if (!result.ok || !result.image) {
      const failure = imageFailurePayload(result);
      return jsonResponse(failure.body, failure.status, failure.headers);
    }

    const bytes = await imageToBytes(result.image);
    const imageUrl = await uploadGeneratedImage(db, "generated-creatives", projectId, bytes, `${operation}-`);

    const label = operation === "fix" ? "Correção" : operation === "resize" ? "Redimensionado" : "Desdobramento";
    const inserted = await insertCreative(db, {
      project_id: projectId,
      created_by: userId,
      image_url: imageUrl,
      format: targetFormat,
      prompt: `[${label} → ${targetFormat}]${instructions ? ` ${instructions}` : ""}${parent?.prompt && operation !== "unfold" ? `\n\nOriginal: ${parent.prompt}` : ""}`,
      kind: operation,
      parent_creative_id: parent?.id ?? null,
      // Desdobramento results are grouped by their key visual (peça-mãe).
      source_image_url: operation === "unfold"
        ? (parent ? (parent.source_image_url ?? parent.image_url) : sourceUrl)
        : (parent?.source_image_url ?? null),
      model_used: result.model,
      cost_usd: result.costUsd,
      generation_meta: { operation, sourceFormat, targetFormat, instructions },
    });

    return jsonResponse({ success: true, creativeId: inserted.id, imageUrl, model: result.model, costUsd: result.costUsd });
  } catch (e) {
    console.error("transform-creative error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
