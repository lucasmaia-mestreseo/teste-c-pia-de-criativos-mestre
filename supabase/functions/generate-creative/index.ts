import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, format, swipeFileId, swipeFileUrl, projectId, brandKit } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build strict brand rules with element-specific color assignments
    let brandRules = "";
    if (brandKit) {
      const rules: string[] = [];
      rules.push("\n\n=== REGRAS ABSOLUTAS DO BRAND KIT — CADA ELEMENTO TEM UMA COR ESPECÍFICA ===");
      rules.push("Você DEVE aplicar as cores listadas abaixo a CADA tipo de elemento. Nenhum elemento visual pode usar uma cor que não esteja nesta lista.");
      
      if (brandKit.backgroundColor) {
        rules.push(`\nREGRA 1 — COR DE FUNDO: O fundo da imagem DEVE ser a cor sólida ${brandKit.backgroundColor}. PROIBIDO adicionar linhas, gradientes, texturas, padrões, formas decorativas ou qualquer elemento visual ao fundo que não exista na referência original. O fundo deve ser LIMPO e na cor exata especificada.`);
      }
      if (brandKit.primaryColor) {
        rules.push(`\nREGRA 2 — COR PRIMÁRIA (${brandKit.primaryColor}): Aplique esta cor OBRIGATORIAMENTE em:\n  - Headlines / títulos principais\n  - Fundo de botões e CTAs\n  - Elementos de destaque e ícones principais\n  - Bordas ou contornos de destaque`);
      }
      if (brandKit.secondaryColor) {
        rules.push(`\nREGRA 3 — COR SECUNDÁRIA (${brandKit.secondaryColor}): Aplique esta cor OBRIGATORIAMENTE em:\n  - Subtítulos e textos de apoio\n  - Textos dentro de botões/CTAs (se o fundo do botão for a cor primária)\n  - Elementos secundários e detalhes complementares\n  - Badges ou etiquetas`);
      }
      if (brandKit.auxColors?.length) {
        rules.push(`\nREGRA 4 — CORES AUXILIARES (${brandKit.auxColors.join(", ")}): Use APENAS para:\n  - Pequenos detalhes decorativos\n  - Separadores ou linhas finas\n  - Ícones menores ou acentos visuais`);
      }
      if (brandKit.typography) {
        rules.push(`\nREGRA 5 — TIPOGRAFIA: Use EXATAMENTE a fonte "${brandKit.typography}" para TODOS os textos sem exceção. NÃO substitua por outra fonte.`);
      }
      
      rules.push(`\nREGRA 6 — BOTÕES E CTAs: Todo botão ou CTA no criativo DEVE usar:\n  - Fundo: cor primária${brandKit.primaryColor ? ` (${brandKit.primaryColor})` : ""}\n  - Texto do botão: cor secundária${brandKit.secondaryColor ? ` (${brandKit.secondaryColor})` : ""} ou branco, o que tiver melhor contraste\n  - NUNCA deixe botões com cores genéricas ou fora do brand kit.`);
      
      rules.push("\nPROIBIÇÃO TOTAL: NUNCA use uma cor que não esteja listada acima para QUALQUER elemento visual — textos, fundos, botões, CTAs, ícones, bordas, sombras. TUDO deve vir exclusivamente das cores do brand kit.");
      
      brandRules = rules.join("\n");
    }

    const systemPrompt = `You are an expert advertising creative designer. You will receive a reference creative image and must generate a new creative based on it, following the user's instructions. The output format should be ${format} (aspect ratio). Maintain the visual structure and layout style of the reference but apply the requested modifications.${brandRules}

REGRAS DE FIDELIDADE PARA ASSETS VISUAIS:

LOGO:
- Se uma imagem de LOGO for fornecida: INCLUA O LOGO COMPLETO na imagem final. NÃO corte nenhuma parte do logo.
- Mantenha as proporções originais do logo — não distorça, não redimensione de forma desproporcional.
- Posicione o logo de forma totalmente visível, sem que nenhuma borda ou elemento sobreponha ou corte qualquer parte dele.
- NÃO redesenhe, NÃO recrie, NÃO altere o logo de forma alguma. Copie-o EXATAMENTE como aparece na imagem fornecida — mesma forma, mesmas cores internas, mesmas proporções.
- NUNCA gere um logo diferente do fornecido.

PESSOA / FACE SWAP:
- Se uma foto de PESSOA for fornecida: você deve SUBSTITUIR a pessoa que aparece na imagem de REFERÊNCIA pela pessoa da foto fornecida.
- MANTENHA a MESMA pose, enquadramento, roupas, cenário e contexto da referência original. Apenas TROQUE o rosto e as características físicas (tom de pele, cabelo, traços faciais) pela pessoa da foto fornecida.
- A pessoa no criativo final DEVE ser visualmente idêntica à foto fornecida — mesmo rosto, mesmos traços.
- NÃO gere um rosto inventado. NÃO altere características faciais. NÃO mude a aparência da pessoa fornecida.
- Se NÃO houver uma pessoa na referência original, posicione a pessoa fornecida de forma natural e harmônica no criativo.

PROIBIÇÕES GERAIS:
- PROIBIDO alterar cores internas do logo
- PROIBIDO gerar rostos diferentes dos fornecidos
- PROIBIDO adicionar texturas, gradientes ou padrões ao fundo que não existam na referência
- PROIBIDO usar cores que não estejam no brand kit para qualquer elemento visual
- PROIBIDO cortar qualquer parte do logo`;

    // Build dynamic content array
    const userContent: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: swipeFileUrl } },
    ];

    if (brandKit?.logoUrl) {
      userContent.push(
        { type: "text", text: "⚠️ OBRIGATÓRIO — LOGO DA MARCA: A imagem a seguir é o logo oficial da marca. Você DEVE incluí-lo COMPLETO no criativo, sem cortar NENHUMA parte. Mantenha proporções originais. NÃO redesenhe, NÃO recrie, NÃO gere um logo diferente. Copie-o EXATAMENTE como está — mesma forma, mesmas cores, mesmas proporções. Posicione-o de forma 100% visível:" },
        { type: "image_url", image_url: { url: brandKit.logoUrl } },
      );
    }

    if (brandKit?.personPhotoUrl) {
      userContent.push(
        { type: "text", text: "⚠️ OBRIGATÓRIO — SUBSTITUIÇÃO DE PESSOA: A imagem a seguir é a pessoa que DEVE aparecer no criativo. Se há uma pessoa na imagem de referência, SUBSTITUA-A por esta pessoa mantendo a mesma pose, roupas, enquadramento e cenário. Apenas troque o rosto e características físicas. A pessoa final DEVE ser visualmente idêntica a esta foto — mesmo rosto, mesmos traços. NÃO gere um rosto diferente:" },
        { type: "image_url", image_url: { url: brandKit.personPhotoUrl } },
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("Erro na geração de imagem");
    }

    const aiData = await aiResponse.json();
    const generatedImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error("Nenhuma imagem foi gerada pela IA");
    }

    // Extract base64 data and upload to storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `${projectId}/${crypto.randomUUID()}.png`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: uploadError } = await supabase.storage
      .from("generated-creatives")
      .upload(filePath, imageBytes, { contentType: "image/png" });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("generated-creatives")
      .getPublicUrl(filePath);

    // Save to database
    const { error: dbError } = await supabase.from("generated_creatives").insert({
      project_id: projectId,
      swipe_file_id: swipeFileId,
      image_url: publicUrl,
      prompt,
      format,
    });
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, imageUrl: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-creative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
