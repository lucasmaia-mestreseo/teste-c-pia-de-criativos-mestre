# Edição de Vídeo (Astra)

Nova ferramenta no hub, integrada a partir do editor local feito pelo time
("Editor de Vídeo · Astra": Node + Express + FFmpeg + OpenAI). A estrutura foi mantida
e a interface foi adaptada à identidade da plataforma.

**Status: disponível só no modo demo** (`npm run dev:demo`). Em produção o card aparece como
**Em breve** e a aba "Vídeo" do projeto fica oculta (`VIDEO_ENABLED` em `src/lib/tools.ts`).

## Como usar (demo)

1. Ferramentas → **Edição de Vídeo** → escolher o projeto (ou aba **Vídeo** dentro do projeto).
2. Soltar um vídeo (MP4, MOV, MKV, WEBM) ou **Gerar vídeo de exemplo (demo)** (grava 15 s na hora).
3. **Analisar** → transcrição + cortes sugeridos.
4. Ajustar nas abas: **Transcrição** (clique na palavra corta/devolve), **Cortes** (por motivo ou
   um a um, parâmetros de detecção), **Imagem**, **Áudio**, **Legendas** e **Astra** (pedidos em
   português). Na timeline: clique para ir ao ponto, arraste para selecionar e **Cortar seleção**.
5. **Renderizar** → prévia final sem os cortes, com o tratamento e as legendas; **Baixar .SRT**.

Atalhos: espaço toca/pausa, ← → anda 1 s (Shift: 5 s).

## O que é real e o que é simulado no demo

| Parte | No demo |
|---|---|
| Waveform e detecção de silêncio | **Real** — o áudio do arquivo é decodificado no navegador |
| Sugestão de balanço de branco | **Real** — média de cor de quadros do vídeo (mesma fórmula do original) |
| Cortes por palavra (vícios, repetições, gagueiras) | **Real** — lógica portada; roda sobre a transcrição |
| Prévia pulando cortes, legendas ao vivo, "antes × depois" | **Real** (a imagem é uma aproximação em CSS dos filtros do FFmpeg) |
| .SRT | **Real** |
| Transcrição (Whisper) | Simulada: um roteiro com vícios/repetições é encaixado nos trechos de fala reais |
| Astra (LLM) | Simulada por regras: entende pedidos comuns ("legenda menor", "corta de 12 a 14 s", "imagem amarelada", "tira os vícios") |
| Render do MP4 (FFmpeg) | Simulado: mostra as etapas e a prévia final; o MP4 não é gerado |

## Onde está o código

- `src/video/engine.ts` — porta de `server/cuts.js`, `subtitles.js`, trechos de `ffmpeg.js`
  (faixas mantidas, mapa de tempo) e do `applyOperations` do Astra, com os mesmos limites.
- `src/video/media.ts` — o que o servidor fazia com ffprobe/ffmpeg para a prévia: probe,
  picos da waveform, envelope para silêncio, cor média dos quadros.
- `src/components/video/` — `VideoStudio` (palco, abas, render), `VideoPanels`, `VideoTimeline`.
- `src/demo/videoDemo.ts` — transcrição e Astra simuladas + vídeo de exemplo.
- Testes: `src/test/video.test.ts`.

## Para ir para produção

1. **Transcrição**: Edge Function `video-transcribe` chamando o Whisper (`whisper-1` com
   `timestamp_granularities=word` — é o que devolve tempo por palavra). Precisa de uma chave da
   OpenAI nos secrets (a OpenRouter não oferece o Whisper). O áudio pode ser extraído no navegador
   e enviado leve (mono, 16 kHz) para não subir o vídeo inteiro.
2. **Astra**: Edge Function `video-astra` via OpenRouter com o prompt original (`server/astra.js`)
   e a mesma lista de operações; o front já aplica o plano com `applyOperations`.
3. **Render**: o FFmpeg não roda em Edge Function. Opções: um serviço de render (container com
   FFmpeg — o `server/ffmpeg.js` original já é o render pronto) ou FFmpeg.wasm no navegador para
   vídeos curtos. O servidor também gera a prévia H.264 de arquivos HEVC (câmera/iPhone), que o
   navegador não toca.
4. Ligar `VIDEO_ENABLED` para produção e salvar os projetos de vídeo (cortes/ajustes) no banco.
