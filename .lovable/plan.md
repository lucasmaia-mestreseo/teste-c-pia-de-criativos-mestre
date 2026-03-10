

# Clonador Mestre — Plano de Implementação

## Visão Geral
Uma bancada de trabalho digital para clonagem e remix de criativos publicitários, usando IA (Nano Banana 2) e respeitando o brand kit de cada projeto. Interface escura, monocromática, com destaque amarelo (#FFF85B) — tudo em uma única visão coesa, sem navegação por páginas.

---

## 1. Infraestrutura (Lovable Cloud)

### Banco de Dados
- **projects** — nome, descrição, criado_em
- **brand_kits** — cores (array), tipografia, logo_url, fotos (array de URLs), vinculado ao projeto
- **swipe_files** — imagem_url, nome, dimensões, projeto_id
- **generated_creatives** — imagem_url, prompt, formato (9:16, 4:5, 1:1, 16:9), criativo_base_id, projeto_id, criado_em
- **Storage buckets** — logos, swipe-files, generated-creatives

### Edge Functions
- **generate-creative** — recebe prompt, imagem base, brand kit e formato; chama Nano Banana 2 (google/gemini-3.1-flash-image-preview) via Lovable AI Gateway; salva resultado no storage e no banco

---

## 2. Layout & Interface (Tela Única)

### A Viga (barra superior fixa)
- Seletor de projeto (dropdown) — trocar projeto recarrega tudo abaixo
- Acesso ao **Brand Kit** e **Histórico** do projeto ativo (à direita)

### Coluna Esquerda (35%) — Swipe File
- Grade densa de miniaturas dos criativos-base
- Scroll infinito
- Drag-and-drop para upload direto (sem modal)
- Seleção com borda amarela (#FFF85B)

### Coluna Direita (65%) — Área de Geração + Galeria
- **Topo:** Criativo selecionado em destaque
- **Meio:** Campo de prompt (chat-like) + seletor de formato (9:16, 4:5, 1:1, 16:9) + botão "Gerar" amarelo
- **Abaixo:** Galeria de resultados gerados, com scroll próprio — cada item com opções de download e exclusão

### Brand Kit (substitui coluna direita quando ativo)
- Campos para cores, tipografia, upload de logo e fotos
- Sem modal — abre inline na coluna direita

### Histórico (substitui coluna direita quando ativo)
- Lista cronológica de todos os criativos gerados no projeto
- Exibe prompt, formato, miniatura e data

---

## 3. Fluxo de Geração (Signature Moment)

1. Usuário seleciona um criativo no swipe file
2. Escreve o prompt e escolhe o formato
3. Clica em "Gerar"
4. Container vazio aparece na galeria com borda amarela pulsante e efeito glitch (2-3s)
5. Imagem final "estala" no lugar
6. Resultado salvo automaticamente no banco (histórico) e storage

---

## 4. Estilo Visual

- Fundo base: #111111, superfícies: #1C1C1C
- Texto: #EAEAEA (principal), #888888 (secundário)
- Destaque único: #FFF85B (botões primários, seleções, inputs ativos)
- Tipografia: **Space Grotesk** para títulos, **Inter** para UI
- Sem modais, sem paginação, sem animações de transição (exceto o signature moment)
- Ícones sempre com rótulo de texto ou tooltip

