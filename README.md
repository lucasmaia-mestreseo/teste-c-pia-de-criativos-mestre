# Teste - Cópia de Criativos Mestre

Vamos construir este sistema utilizando o Lovable e, especificamente, vamos contar com o Lovable Cloud para a conexão com banco de dados e APIs de geração de imagens.

Este sistema tem como objetivo ser um centro de geração de criativos em imagens para anúncios. Ele deve clonar outros criativos, modificando alguns aspectos.

Seu nome será "Clonador Mestre".

E nossas imagens vão utilizar o Nano Banana 2, que é o melhor modelo de IA para geração de imagens.

Alguns requisitos do nosso sistema:

Precisa permitir projetos diferentes

Para cada projeto, preciso permitir um conjunto de atribuições gráficas (Cores, tipografia, logo, fotos da empresa e pessoas) como se fosse o seu brand kit

Acervo de criativos base ou, o famoso “swipe file”, onde guardo todas as inspirações do projeto

Tela de upload para subir criativos originais, guardando na pasta de swipe file

Tela para gerar novos criativos, baseado sempre em um criativo existente no swipe file. Nesta tela, fazer uma espécie de chat, onde posso entrar com um prompt específico, também vou ter um seletor para escolher o tamanho do criativo (9:16, 4:5, 1:1, 16:9)

Sempre ao gerar um novo criativo, devo respeitar o brand kit da marca, com cores, tipografia, logo da empresa e fotos, caso seja especificado para uso.

Galeria de resultados para exibir os criativos gerados no projeto, com a opção de download individual ou ainda exclusão

Histórico, onde salvo todos os criativos gerados no banco de dados para consulta futura

## Modo demo (sem login, sem IA)

Para testar as telas localmente sem conta e sem gastar créditos:

```sh
npm install
npm run dev:demo
```

Abra http://localhost:8080. O app entra logado como um dono fictício, com projetos e criativos de exemplo; as "gerações" devolvem imagens de exemplo. Detalhes em [docs/MODO-DEMO.md](docs/MODO-DEMO.md).

## Documentação técnica

- [Arquitetura](docs/ARQUITETURA.md) — como a plataforma funciona (telas, Edge Functions, IA, banco).
- [Melhorias 2026-09](docs/MELHORIAS-2026-09.md) — Ferramentas, Redimensionar, Desdobramento, Revisão, Custos e correções; inclui o passo a passo de publicação.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8086dc90-7c79-4cf3-955d-6f63c8bb5d5b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
