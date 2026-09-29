# Modo demo

Versão local para testar a interface **sem login e sem IA real**.

```sh
npm install        # só na primeira vez
npm run dev:demo   # abre em http://localhost:8080
```

## O que acontece

- O app entra direto como **"Lucas Demo"**, com papel *owner* (vê tudo, inclusive o Admin).
- Há 3 projetos fictícios (Clínica Sorriso, Academia Pulse, Imobiliária Horizonte) com
  brand kit, contexto, swipe files, criativos, revisões, um desdobramento e 30 dias de
  custos de IA.
- **Gerar, Dinâmica, Redimensionar, Desdobramento, Revisão e Corrigir funcionam**, mas
  devolvem imagens de exemplo depois de ~2 s. Nenhuma chamada sai do navegador.
- Na **Criação de KVs**, o botão **Usar materiais de exemplo (demo)** carrega um
  brandbook em PDF e um logo gerados no navegador — dá para testar o manual inteiro sem
  arquivos do cliente. **Copy do anúncio** e **Variações A/B** também são simulados.
- Tudo o que você fizer fica salvo no navegador (localStorage). Para voltar ao início,
  clique em **recomeçar** no selo amarelo "MODO DEMO" (ou abra `/?reset-demo`).

## Como funciona

`vite --mode demo` troca o módulo `@/integrations/supabase/client` por
`src/demo/demoClient.ts` (alias em `vite.config.ts`). Esse cliente simula:

| Parte | Arquivo |
|---|---|
| Banco (consultas, inserts, updates) e storage em memória | `src/demo/demoClient.ts`, `src/demo/store.ts` |
| Dados iniciais | `src/demo/seed.ts` |
| Edge Functions (mesmas entradas/saídas das reais) | `src/demo/functions.ts` |
| Imagens de exemplo (SVG) | `src/demo/svgArt.ts` |

Nada disso entra no build de produção (`npm run build`): o alias só existe no modo
`demo`, e o código do demo nunca é importado no modo normal.

## Limites

- Não testa a qualidade das imagens nem dos prompts (não há IA).
- Não testa permissões por papel, RLS nem autenticação de verdade.
- Uploads grandes podem não sobreviver a um recarregamento (limite do localStorage).
