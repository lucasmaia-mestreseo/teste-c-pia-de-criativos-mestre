import { callOpenRouterWithCascade, parseToolCall } from "../_shared/openrouter.ts";
import { requireProjectAccess } from "../_shared/auth.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { adminClient, signStorageUrl } from "../_shared/storage.ts";
import { safeZoneRule } from "../_shared/formats.ts";

/**
 * Automatic quality review of a generated creative (vision model).
 * Checks the finished image against what was requested — texts, logo, brand
 * colors, people, format, and (for resize/unfold/fix) fidelity to the source —
 * and stores the verdict in generated_creatives.review / review_status.
 *
 * Body: { projectId, creativeId }
 */

interface ReviewIssue {
  severity: "alta" | "media" | "baixa";
  category: "texto" | "logo" | "cores" | "pessoa" | "layout" | "formato" | "fidelidade" | "outro";
  description: string;
  fix_instruction: string;
}

interface ReviewResult {
  approved: boolean;
  score: number;
  summary: string;
  issues: ReviewIssue[];
}

const REVIEW_TOOL = {
  type: "function",
  function: {
    name: "report_review",
    description: "Report the quality review of the ad creative",
    parameters: {
      type: "object",
      properties: {
        approved: { type: "boolean", description: "true if the creative can be published as is (no high-severity issue)" },
        score: { type: "number", description: "Overall quality 0-100" },
        summary: { type: "string", description: "One-sentence verdict in Portuguese" },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["alta", "media", "baixa"] },
              category: { type: "string", enum: ["texto", "logo", "cores", "pessoa", "layout", "formato", "fidelidade", "outro"] },
              description: { type: "string", description: "What is wrong, in Portuguese" },
              fix_instruction: { type: "string", description: "Concrete instruction, in Portuguese, for an image editor to fix it" },
            },
            required: ["severity", "category", "description", "fix_instruction"],
            additionalProperties: false,
          },
        },
      },
      required: ["approved", "score", "summary", "issues"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  // Only set once the caller is proven to have access to this creative.
  let verifiedCreativeId: string | undefined;
  const db = adminClient();
  try {
    const body = await req.json();
    const creativeId: string | undefined = body.creativeId;
    const projectId: string = body.projectId;
    if (!creativeId) return jsonResponse({ error: "creativeId é obrigatório" }, 400);

    const authed = await requireProjectAccess(req, projectId, corsHeaders);
    if (authed instanceof Response) return authed;

    const { data: creative } = await db
      .from("generated_creatives")
      .select("*") // "*" keeps working even before the new columns exist
      .eq("id", creativeId)
      .maybeSingle();
    if (!creative || creative.project_id !== projectId) return jsonResponse({ error: "Criativo não encontrado" }, 404);

    verifiedCreativeId = creativeId;
    await db.from("generated_creatives").update({ review_status: "pending" }).eq("id", creativeId);

    const meta = (creative.generation_meta ?? {}) as Record<string, any>;
    const useBrandKit = !meta.ignoreBrandKit;
    const { data: kit } = useBrandKit
      ? await db.from("brand_kits").select("primary_color, secondary_color, background_color, aux_colors, typography").eq("project_id", projectId).maybeSingle()
      : { data: null };

    // Reference image for adaptations/fixes: the parent creative or the uploaded key visual.
    let referenceUrl: string | null = null;
    if (creative.parent_creative_id) {
      const { data: parent } = await db.from("generated_creatives").select("image_url").eq("id", creative.parent_creative_id).maybeSingle();
      referenceUrl = parent?.image_url ?? null;
    } else if (creative.source_image_url) {
      referenceUrl = creative.source_image_url;
    }

    const [imageUrl, signedReference] = await Promise.all([
      signStorageUrl(db, creative.image_url),
      signStorageUrl(db, referenceUrl),
    ]);

    const checks: string[] = [
      `FORMATO: a imagem deve estar em ${creative.format}. Verifique se a composição está adequada ao formato e se nada importante foi cortado pelas bordas.${safeZoneRule(creative.format) ? ` ${safeZoneRule(creative.format)} Texto, logo ou CTA dentro dessas faixas é problema de severidade "alta" (categoria "formato").` : ""}`,
      "TEXTO: procure erros de ortografia, letras deformadas, palavras duplicadas, texto ilegível ou texto sem sentido (\"texto de IA\").",
    ];
    if (creative.kind === "dynamic" && creative.briefing) {
      const b = creative.briefing as Record<string, string>;
      checks.push(`TEXTOS ESPERADOS: a headline deve ser "${b.titulo ?? ""}"${b.copy ? ` e o texto de apoio deve corresponder a "${b.copy}"` : ""}.`);
    } else if (creative.kind === "generate") {
      checks.push(`PEDIDO ORIGINAL (verifique se foi atendido, especialmente os textos pedidos entre aspas):\n"""\n${(creative.prompt || "").slice(0, 2500)}\n"""`);
    }
    if (meta.hasLogo) {
      checks.push("LOGO: deve haver um logo da marca, completo, sem cortes, legível, sem ser redesenhado, e nada pode sobrepô-lo.");
    }
    if (meta.hasPerson) {
      checks.push("PESSOA: deve haver uma pessoa com rosto natural (sem deformações nas mãos, olhos ou dentes).");
    }
    if (kit && (kit.primary_color || kit.secondary_color)) {
      checks.push(`CORES DA MARCA: primária ${kit.primary_color ?? "—"}, secundária ${kit.secondary_color ?? "—"}${kit.background_color ? `, fundo ${kit.background_color}` : ""}${kit.aux_colors?.length ? `, auxiliares ${kit.aux_colors.join(", ")}` : ""}. Aponte apenas desvios evidentes (ex.: botão numa cor fora da paleta).`);
    }
    if (kit?.typography) {
      checks.push(`TIPOGRAFIA: a marca usa "${kit.typography}". Aponte só se a fonte for claramente de outro estilo.`);
    }
    if (signedReference) {
      checks.push("FIDELIDADE À PEÇA-MÃE (segunda imagem): os textos devem ser os MESMOS da peça-mãe, com o mesmo logo, as mesmas pessoas/produtos e a mesma identidade visual. Aponte textos faltando, trocados ou com erro.");
    }

    const content: any[] = [
      {
        type: "text",
        text: `Você é um revisor sênior de criativos para anúncios. Revise o criativo (primeira imagem) com rigor, mas sem implicância: aponte apenas problemas reais que um cliente notaria.

Verifique:
${checks.map((c, i) => `${i + 1}. ${c}`).join("\n\n")}

Severidade: "alta" = impede a publicação (texto errado, logo cortado, rosto deformado, formato errado); "media" = incomoda mas publicável; "baixa" = detalhe.
approved = true somente se não houver nenhum problema de severidade alta.
Para cada problema, escreva uma fix_instruction objetiva que um editor de imagem consiga executar (ex.: "Corrigir a headline para 'Compre agora' mantendo a mesma fonte e posição").
Responda em português usando a ferramenta.`,
      },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
    if (signedReference) {
      content.push(
        { type: "text", text: "PEÇA-MÃE (referência):" },
        { type: "image_url", image_url: { url: signedReference } },
      );
    }

    const result = await callOpenRouterWithCascade({
      settingsKey: "vision_analysis",
      track: { functionName: "review-creative", projectId, userId: authed.userId },
      messages: [{ role: "user", content }],
      tools: [REVIEW_TOOL],
      toolChoice: { type: "function", function: { name: "report_review" } },
    });

    if (!result.ok) {
      await db.from("generated_creatives").update({ review_status: "error" }).eq("id", creativeId);
      const status = result.status === 402 || result.status === 429 ? result.status : 502;
      return jsonResponse({ error: "Não foi possível revisar o criativo agora." }, status);
    }

    const parsed = parseToolCall<ReviewResult>(result.data);
    if (!parsed) {
      await db.from("generated_creatives").update({ review_status: "error" }).eq("id", creativeId);
      return jsonResponse({ error: "A IA não retornou uma revisão válida." }, 502);
    }

    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    // Enforce the rule even if the model contradicts itself.
    const approved = !issues.some((i) => i.severity === "alta");
    const review = {
      approved,
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      summary: parsed.summary || "",
      issues,
      model: result.modelUsed,
      cost_usd: result.costUsd ?? 0,
      reviewed_at: new Date().toISOString(),
    };

    await db.from("generated_creatives")
      .update({ review, review_status: approved ? "approved" : "issues" })
      .eq("id", creativeId);

    return jsonResponse({ success: true, review });
  } catch (e) {
    console.error("review-creative error:", e);
    if (verifiedCreativeId) {
      await db.from("generated_creatives").update({ review_status: "error" }).eq("id", verifiedCreativeId);
    }
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
