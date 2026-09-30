import { generateImageWithCascade, imageFailurePayload } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { insertCreative, optionFields, resolveTaskId } from "../_shared/creatives.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { EXACT_FORMATS, fitExact } from "../_shared/imageFit.ts";
import { FORMAT_PIXELS, safeZoneRule } from "../_shared/formats.ts";
import { adminClient, imageToBytes, parseStorageUrl, signStorageUrl, uploadGeneratedImage } from "../_shared/storage.ts";

/**
 * Turns an existing image into a new creative. One call = one output image.
 *
 *  operation "resize" → adapt a generated creative to another format (Redimensionar)
 *  operation "unfold" → adapt an uploaded key visual to another format (Desdobramento)
 *  operation "fix"    → edit a creative to fix the issues found by review-creative
 *  operation "variant"→ A/B variation of a creative (new headline/CTA/visual element, same layout)
 *
 * Body: { projectId, operation, targetFormat?, creativeId?, sourceImageUrl?, instructions?, issues?, variant? }
 */

type Operation = "resize" | "unfold" | "fix" | "variant";

interface VariantSpec { nome?: string; hipotese?: string; headline?: string; cta?: string; ajusteVisual?: string }

const FORMAT_HINTS: Record<string, string> = {
  "9:16": "Vertical tela cheia (Stories/Reels/TikTok). Empilhe os elementos verticalmente.",
  "4:5": "Vertical de feed. Aproveite a altura extra: dê respiro entre headline, imagem principal e CTA.",
  "1:1": "Quadrado de feed. Composição equilibrada e centralizada; nada encostado nas bordas.",
  "16:9": "Horizontal (banner, YouTube, display). Distribua os elementos lado a lado: normalmente imagem/pessoa de um lado e textos do outro.",
  "1.91:1": "Banner horizontal de link do Facebook (1200×628). Composição lado a lado: imagem/pessoa de um lado, textos curtos e grandes do outro.",
};

function formatHint(format: string): string {
  const base = FORMAT_HINTS[format] ?? `Proporção ${format}. Recomponha os elementos para ocupar bem este formato.`;
  const safe = safeZoneRule(format);
  return safe ? `${base}
${safe}` : base;
}

const ratioOf = (f: string) => { const [w, h] = f.split(":").map(Number); return w && h ? w / h : 1; };

function sizeLabel(format: string): string {
  const px = FORMAT_PIXELS[format];
  return px ? `${px[0]}×${px[1]} (${format})` : `${format} aspect ratio`;
}

/**
 * How to adapt: OUTPAINT when the new canvas only needs a bit more height (or
 * width) in the same orientation — the original stays untouched in the center,
 * so texts can't be retyped or duplicated. Otherwise RECOMPOSE the layout.
 */
function adaptMode(sourceRatio: number | null, target: string): "outpaint-vertical" | "outpaint-horizontal" | "recompose" {
  if (!sourceRatio || !Number.isFinite(sourceRatio)) return "recompose";
  const tr = ratioOf(target);
  const sameOrientation = (sourceRatio <= 1.05 && tr <= 1.05) || (sourceRatio > 1 && tr > 1);
  if (tr < sourceRatio && sameOrientation && 1 - tr / sourceRatio <= 0.45) return "outpaint-vertical";
  if (tr > sourceRatio && sameOrientation && 1 - sourceRatio / tr <= 0.22) return "outpaint-horizontal";
  return "recompose";
}

function adaptPrompt(targetFormat: string, sourceRatio: number | null, instructions: string | null): string {
  const size = sizeLabel(targetFormat);
  const exact = EXACT_FORMATS[targetFormat];
  const crop = exact ? `\nNote: the image will be generated at ${exact.generateAs} and then cropped to exactly ${exact.width}×${exact.height}: about 4% of the top and 4% of the bottom will be cut, so keep those strips as plain background.` : "";
  const extra = instructions ? `\n\nADDITIONAL INSTRUCTIONS FROM THE DESIGNER (Portuguese; they take priority over the layout rules above):\n"${instructions}"` : "";
  const mode = adaptMode(sourceRatio, targetFormat);

  if (mode !== "recompose") {
    const where = mode === "outpaint-vertical" ? "at the TOP and BOTTOM" : "on the LEFT and RIGHT sides";
    const taller = mode === "outpaint-vertical" ? "taller" : "wider";
    return `Expand this image to ${size} using OUTPAINTING only.

Keep the ENTIRE original image — all text, all graphics, all photos, the logo and the layout — completely UNCHANGED and untouched in the center. Do NOT regenerate, move, rescale, restyle or alter any existing text or element. Preserve every word and pixel of the original exactly as it is. Every text must appear exactly once — never repeat or duplicate a text.

Only ADD new background area ${where} to fill the ${taller} canvas, seamlessly extending the existing background (its color, gradient, texture, shapes and lighting) naturally into the new space, so it blends invisibly with the original. The added areas contain only background continuation — no new text, no new objects, no new graphics.

Keep the original content centered. Result: the same design, unchanged, now in ${size} with naturally extended background. High-resolution, sharp, seamless.${crop}${extra}`;
  }

  const safe = safeZoneRule(targetFormat);
  return `Recreate this design in ${size}, respecting and preserving all the original content.

Keep ALL the original elements: the same texts (exact same wording, same fonts, same typography, same font sizes and styles — do NOT change or substitute the fonts), the same images and people (same faces, hair and clothes), the same logo (complete, same colors and proportions, never redrawn), the same colors and the same overall visual style. Every text must appear exactly once — never repeat, duplicate, add or omit any text. Only rearrange the elements naturally to fit the new layout, adjusting or extending the background as needed to fill the whole canvas seamlessly. Do not just crop or stretch the original.

Keep the same hierarchy: the headline stands out and the call-to-action is clearly visible.

Respect a SAFE MARGIN: keep all important content (texts, logo, key graphics, call-to-action) comfortably away from the edges, with generous padding around the borders so nothing gets cut off or crowded.${safe ? ` ${safe}` : ""}

Preserve the original fonts, palette, branding and content exactly. High-resolution, sharp, clean, balanced composition.${crop}${extra}`;
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

function variantPrompt(format: string, v: VariantSpec, originalPrompt: string | null): string {
  const changes = [
    v.headline && `- HEADLINE: troque a headline principal por exatamente "${v.headline}" — mesma posição, mesma fonte, mesmo peso e tamanho equivalente.`,
    v.cta && `- CTA: o texto do botão passa a ser exatamente "${v.cta}" — mesmo botão, mesma posição.`,
    v.ajusteVisual && `- AJUSTE VISUAL: ${v.ajusteVisual}`,
  ].filter(Boolean).join("\n");
  return `Você é um editor de criativos para testes A/B. A imagem anexada é o criativo CONTROLE. Crie a VARIAÇÃO "${v.nome ?? "B"}"${v.hipotese ? ` (hipótese: ${v.hipotese})` : ""}.

Mude SOMENTE o que está listado abaixo. Todo o resto permanece IDÊNTICO ao controle: layout, fundo, pessoas, produto, logo, cores, tipografia e os demais textos — senão o teste A/B deixa de medir a hipótese.

FORMATO: mantenha ${format}.

MUDANÇAS:
${changes || "- Nenhuma mudança de texto: aplique apenas o ajuste visual."}

Os textos novos devem estar escritos exatamente como acima, sem erros de digitação.${originalPrompt ? `

Contexto do criativo original:
"""
${originalPrompt.slice(0, 1500)}
"""` : ""}`;
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

    if (!["resize", "unfold", "fix", "variant"].includes(operation)) {
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
    } else if (operation === "variant") {
      if (!parent) return jsonResponse({ error: "Variação precisa de um criativo de origem" }, 400);
      targetFormat = parent.format || "1:1";
      const v: VariantSpec = body.variant ?? {};
      if (!v.headline && !v.cta && !v.ajusteVisual) return jsonResponse({ error: "Variação sem mudanças" }, 400);
      promptText = variantPrompt(targetFormat, v, parent.prompt ?? null);
    } else {
      targetFormat = body.targetFormat;
      if (!targetFormat) return jsonResponse({ error: "targetFormat é obrigatório" }, 400);
      const sourceRatio = Number(body.sourceRatio) > 0 ? Number(body.sourceRatio) : (sourceFormat ? ratioOf(sourceFormat) : null);
      promptText = adaptPrompt(targetFormat, sourceRatio, instructions);
      // The project's active brand guide (Criação de KVs writes it into the context):
      // guides what has to be recreated when the layout changes; the piece's texts never change.
      const { data: proj } = await db.from("projects").select("context").eq("id", projectId).maybeSingle();
      const guide = String(proj?.context ?? "").match(/— Diretrizes do manual de marca —[\s\S]*$/)?.[0];
      if (guide) {
        promptText += `\n\nBRAND GUIDE OF THE PROJECT (Portuguese; use it only for colors, typography and style of whatever has to be extended or recreated — NEVER change the texts of the original):\n${guide.slice(0, 1500)}`;
      }
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

    const exact = EXACT_FORMATS[targetFormat];
    const result = await generateImageWithCascade({
      messages: [{ role: "user", content: userContent }],
      aspectRatio: exact?.generateAs ?? targetFormat,
      // adapting an existing piece (Desdobramento/Redimensionar) has its own model cascade
      settingsKey: operation === "unfold" || operation === "resize" ? "image_unfold" : "image_generation",
      track,
      startedAt: START_TS,
    });

    if (!result.ok || !result.image) {
      const failure = imageFailurePayload(result);
      return jsonResponse(failure.body, failure.status, failure.headers);
    }

    let bytes = await imageToBytes(result.image);
    if (exact) {
      try {
        bytes = await fitExact(bytes, exact);
      } catch (e) {
        console.warn(`fitExact(${targetFormat}) failed, keeping the generated size:`, e);
      }
    }
    const imageUrl = await uploadGeneratedImage(db, "generated-creatives", projectId, bytes, `${operation}-`);

    const variant: VariantSpec | null = operation === "variant" ? (body.variant ?? {}) : null;
    const label = operation === "fix" ? "Correção" : operation === "resize" ? "Redimensionado" : operation === "variant" ? `Variação: ${variant?.nome ?? "B"}` : "Desdobramento";
    // Tarefa and banner number: the piece stays in its task with the same Bxx in every format
    // Desdobramento goes to the task being worked on; resize/fix/variant stay in the task of their piece.
    const bodyTask = await resolveTaskId(db, projectId, body.taskId);
    const taskId = operation === "unfold" ? (bodyTask ?? parent?.task_id ?? null) : parent ? (parent.task_id ?? null) : bodyTask;
    const bannerFromBody = Number.isInteger(body.bannerNumber) && body.bannerNumber > 0 ? body.bannerNumber : null;
    const bannerNumber = operation === "variant"
      ? null // a new banner: next number of the task
      : bannerFromBody ?? (parent && parent.task_id === taskId ? (parent.banner_number ?? null) : null);
    const inserted = await insertCreative(db, {
      project_id: projectId,
      task_id: taskId,
      banner_number: taskId ? bannerNumber : null,
      created_by: userId,
      image_url: imageUrl,
      format: targetFormat,
      prompt: variant
        ? `[${label}] ${variant.hipotese ?? ""}\nHeadline: "${variant.headline ?? ""}" · CTA: "${variant.cta ?? ""}"${variant.ajusteVisual ? `\nAjuste visual: ${variant.ajusteVisual}` : ""}${parent?.prompt ? `\n\nOriginal: ${parent.prompt}` : ""}`
        : `[${label} → ${targetFormat}]${instructions ? ` ${instructions}` : ""}${parent?.prompt && operation !== "unfold" ? `\n\nOriginal: ${parent.prompt}` : ""}`,
      // variants keep kind "generate" (no schema change); generation_meta.operation marks them
      kind: operation === "variant" ? "generate" : operation,
      parent_creative_id: parent?.id ?? null,
      // Desdobramento results are grouped by their key visual (peça-mãe).
      source_image_url: operation === "unfold"
        ? (parent ? (parent.source_image_url ?? parent.image_url) : sourceUrl)
        : (parent?.source_image_url ?? null),
      model_used: result.model,
      cost_usd: result.costUsd,
      generation_meta: { operation, sourceFormat, targetFormat, instructions, ...(variant ? { variant } : {}), ...(operation === "unfold" ? optionFields(body) : {}) },
    });

    return jsonResponse({ success: true, creativeId: inserted.id, bannerNumber: inserted.bannerNumber, imageUrl, model: result.model, costUsd: result.costUsd });
  } catch (e) {
    console.error("transform-creative error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
