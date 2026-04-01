
-- 1. user_invitations table
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view invitations"
  ON public.user_invitations FOR SELECT TO authenticated
  USING (has_any_admin_role(auth.uid()));

CREATE POLICY "Owner or admin can create invitations"
  ON public.user_invitations FOR INSERT TO authenticated
  WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Owner or admin can delete invitations"
  ON public.user_invitations FOR DELETE TO authenticated
  USING (has_any_admin_role(auth.uid()));

-- 2. design_screenshot_url on brand_kits
ALTER TABLE public.brand_kits ADD COLUMN design_screenshot_url text;

-- 3. voice_guide on projects
ALTER TABLE public.projects ADD COLUMN voice_guide text;

-- 4. Insert template prompts
INSERT INTO public.template_prompts (id, prompt) VALUES
('context-extraction', 'Você é um especialista em marketing digital e branding. Com base no conteúdo do site e na pesquisa sobre a empresa, gere um contexto completo do projeto que inclua:

1. **Sobre a empresa**: O que faz, mercado de atuação, tempo de mercado
2. **Público-alvo**: Quem são os clientes ideais, faixa etária, interesses, dores
3. **Produtos/Serviços**: Principais ofertas, diferenciais competitivos
4. **Posicionamento**: Como a marca se posiciona no mercado
5. **Tom de comunicação**: Como a marca se comunica (formal, informal, técnico, etc.)
6. **Proposta de valor**: O que torna a empresa única
7. **Ofertas e CTAs comuns**: Promoções, chamadas para ação típicas

Seja detalhado e específico. Use as informações reais encontradas no site e na pesquisa.'),

('voice-analysis', 'Atue como um especialista em linguagem, copywriting e psicologia da comunicação. Analise o conteúdo fornecido e gere um "Guia de Voz" completo e acionável.

Analise as seguintes dimensões: (1) Tom Geral — descreva a atitude predominante com 3-5 adjetivos justificados com exemplos do texto; (2) Estrutura da Frase — comprimento médio, variação, uso de frases curtas para impacto, complexidade; (3) Vocabulário — nível de formalidade, jargões, gírias e liste 5-10 palavras ou expressões características que o autor repete; (4) Ritmo e Cadência — tamanho dos parágrafos, transições entre ideias, uso de parágrafos de uma frase para ênfase; (5) Personalidade e Relação com o Leitor — o autor se posiciona como especialista, amigo ou mentor? Usa humor? Faz perguntas diretas?; (6) Formatação — preferência por listas ou prosa, uso de negrito, itálico e outros recursos visuais; (7) Expressão de Opinião — firmeza nas afirmações, uso de qualificadores como "talvez" ou "em alguns casos", como estabelece autoridade.

Após a análise, gere o Guia de Voz com: (A) Resumo da Voz — tom principal e personalidade em poucas frases; (B) Características Centrais — síntese de cada uma das 7 dimensões com exemplos extraídos do texto; (C) Lista Proibida — frases e padrões genéricos que matam a autenticidade dessa voz (ex: "No cenário atual..."); (D) Prompt de Replicação — um comando pronto que eu possa usar no futuro para escrever novos textos nesse mesmo estilo.'),

('dynamic-conservative', 'Você é um copywriter sênior especialista em marketing de performance e conversão. Crie um criativo CONSERVADOR com foco em:

- Linguagem direta e clara
- Provas sociais (números, depoimentos, cases)
- Benefícios concretos e mensuráveis
- Segurança e confiabilidade
- CTAs tradicionais e eficazes

O criativo deve transmitir profissionalismo e credibilidade. Use dados e fatos sempre que possível.'),

('dynamic-innovative', 'Você é um diretor criativo de uma agência premiada. Crie um criativo INOVADOR com foco em:

- Abordagens novas e surpreendentes
- Metáforas visuais impactantes
- Tom surpreendente que quebra expectativas
- Storytelling incomum e envolvente
- Conexão emocional forte

O criativo deve se destacar no feed, mas ainda manter relevância comercial e foco em conversão.'),

('dynamic-radical', 'Você é um gênio criativo disruptivo. Crie um criativo FORA DA CAIXA (radicalmente criativo) com foco em:

- Ideias disruptivas e provocativas
- Potencial viral
- Formatos não convencionais
- Provocações inteligentes
- Ruptura de padrões visuais e textuais

O criativo deve chocar positivamente, gerar compartilhamentos e criar buzz. Mesmo sendo ousado, deve ter estratégia de conversão por trás.')
ON CONFLICT (id) DO NOTHING;
