const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ORModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string; image?: string };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
}

interface CategorizedModel {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt: number | null; completion: number | null };
  input_modalities: string[];
  output_modalities: string[];
}

function toCat(m: ORModel): CategorizedModel {
  const arch = m.architecture ?? {};
  let input = arch.input_modalities;
  let output = arch.output_modalities;
  // Fallback: parse legacy modality "text+image->text"
  if ((!input || !output) && arch.modality) {
    const [inPart, outPart] = arch.modality.split("->");
    input = input ?? inPart?.split("+").map((s) => s.trim()).filter(Boolean);
    output = output ?? outPart?.split("+").map((s) => s.trim()).filter(Boolean);
  }
  return {
    id: m.id,
    name: m.name ?? m.id,
    context_length: m.context_length ?? null,
    pricing: {
      prompt: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : null,
      completion: m.pricing?.completion ? parseFloat(m.pricing.completion) : null,
    },
    input_modalities: input ?? [],
    output_modalities: output ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`OpenRouter respondeu ${res.status}`);
    }
    const json = await res.json();
    const models: ORModel[] = json.data ?? [];

    const image_generation: CategorizedModel[] = [];
    const vision_analysis: CategorizedModel[] = [];
    const text_reasoning: CategorizedModel[] = [];

    for (const raw of models) {
      const m = toCat(raw);
      const inSet = new Set(m.input_modalities);
      const outSet = new Set(m.output_modalities);
      if (outSet.has("image")) image_generation.push(m);
      if (inSet.has("image") && !outSet.has("image") && outSet.has("text"))
        vision_analysis.push(m);
      if (
        inSet.size > 0 &&
        outSet.size > 0 &&
        !outSet.has("image") &&
        !inSet.has("image") &&
        outSet.has("text")
      )
        text_reasoning.push(m);
    }

    const sortFn = (a: CategorizedModel, b: CategorizedModel) =>
      a.name.localeCompare(b.name);
    image_generation.sort(sortFn);
    vision_analysis.sort(sortFn);
    text_reasoning.sort(sortFn);

    return new Response(
      JSON.stringify({
        image_generation,
        vision_analysis,
        text_reasoning,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
