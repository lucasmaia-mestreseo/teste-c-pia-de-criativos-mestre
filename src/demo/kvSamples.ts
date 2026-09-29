/**
 * MODO DEMO — sample client materials for "Criação de KVs": a 3-page brandbook
 * PDF (built by hand, Helvetica + color swatches) and a logo PNG drawn on a
 * canvas. Lets the whole manual flow be tested without real client files.
 */

function buildPdf(pages: string[]): Uint8Array {
  const objs: string[] = [];
  const add = (s: string) => objs.push(s);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesId = 2 + pages.length * 2 + 1;
  const pageIds: number[] = [];
  for (const content of pages) {
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const streamId = objs.length;
    add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Contents ${streamId} 0 R /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> >>`);
    pageIds.push(objs.length);
  }
  add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff);
}

export function sampleBrandbook(): File {
  const bytes = buildPdf([
    `0.043 0.165 0.290 rg 0 0 842 595 re f
1 1 1 rg BT /F2 44 Tf 60 330 Td (Manual da Marca) Tj ET
0.941 0.588 0.180 rg BT /F2 30 Tf 60 280 Td (Horizonte Engenharia) Tj ET
1 1 1 rg BT /F1 14 Tf 60 240 Td (Guia de identidade visual - versao 2026) Tj ET`,
    `0.1 0.1 0.1 rg BT /F2 26 Tf 60 520 Td (Paleta de cores) Tj ET
0.043 0.165 0.290 rg 60 300 160 160 re f
0.105 0.373 0.659 rg 240 300 160 160 re f
0.941 0.588 0.180 rg 420 300 160 160 re f
0.961 0.969 0.980 rg 600 300 160 160 re f
0.2 0.2 0.2 rg BT /F1 13 Tf 60 280 Td (Azul Horizonte #0B2A4A) Tj ET
BT /F1 13 Tf 240 280 Td (Azul Claro #1B5FA8) Tj ET
BT /F1 13 Tf 420 280 Td (Laranja Obra #F0962E) Tj ET
BT /F1 13 Tf 600 280 Td (Off-white #F5F7FA) Tj ET
BT /F1 13 Tf 60 220 Td (O azul domina. O laranja e so para chamadas e destaques. Vermelho nunca.) Tj ET`,
    `0.1 0.1 0.1 rg BT /F2 26 Tf 60 520 Td (Tom de voz e publico) Tj ET
BT /F1 14 Tf 60 470 Td (A Horizonte Engenharia constroi galpoes e obras industriais ha 25 anos.) Tj ET
BT /F1 14 Tf 60 445 Td (Falamos com diretores de industria e gestores de compras: direto, tecnico e seguro.) Tj ET
BT /F1 14 Tf 60 420 Td (Prometemos prazo e seguranca, nunca o menor preco.) Tj ET`,
  ]);
  return new File([bytes], 'brandbook-horizonte (exemplo).pdf', { type: 'application/pdf' });
}

/** A symbol (roof/horizon mark) + wordmark on a white background, like a typical JPG logo. */
export async function sampleLogo(): Promise<File> {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 420;
  const x = c.getContext('2d')!;
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, c.width, c.height);
  // symbol: orange sun over a navy roof line
  x.fillStyle = '#F0962E';
  x.beginPath(); x.arc(200, 190, 70, Math.PI, 0); x.fill();
  x.fillStyle = '#0B2A4A';
  x.beginPath(); x.moveTo(60, 250); x.lineTo(200, 120); x.lineTo(340, 250); x.lineTo(305, 250); x.lineTo(200, 155); x.lineTo(95, 250); x.closePath(); x.fill();
  x.fillRect(60, 270, 280, 26);
  // wordmark
  x.fillStyle = '#0B2A4A';
  x.font = 'bold 118px Arial, Helvetica, sans-serif';
  x.fillText('HORIZONTE', 380, 230);
  x.font = '600 54px Arial, Helvetica, sans-serif';
  x.fillStyle = '#1B5FA8';
  x.fillText('ENGENHARIA', 386, 305);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
  return new File([blob], 'logo-horizonte (exemplo).png', { type: 'image/png' });
}

/** A briefing exported from Google Forms (same questions the agency sends to clients). */
export function sampleBriefingCsv(): File {
  const q = [
    'Carimbo de data/hora', 'Endereço de e-mail',
    'Vocês possuem um manual de identidade visual da marca?',
    'Em caso afirmativo, por favor, enviar o arquivo.',
    'Qual é o principal problema que o seu cliente resolve ao escolher a Horizonte? O que precisamos mostrar nas imagens para que ele sinta que o problema dele será resolvido?',
    'Qual persona decisora este design precisa impactar?',
    'Como os produtos e a tecnologia devem aparecer no criativo?',
    'Escolha até 3 atributos que definem a linguagem visual ideal para as entregas do time de criação:',
    'A Horizonte possui banco de imagens próprio?',
    'Existe alguma restrição de conformidade ou Brand Safety a ser evitada?',
    'Qual referências ativas podem inspirar o estilo visual dos materiais gráficos?',
    'Para os anúncios em banners, é preferível usar:',
    'Há algo que não pode ser executado de nenhuma forma? (Ex: Termos que não devem ser usados, testes anteriores que geraram feedback negativo dos leads?)',
    'Existe alguma cor que NÃO devemos usar de jeito nenhum?',
    'Quais são as características que a marca NÃO busca transmitir?',
    'Há mais alguma observação visual importante (que não mencionamos acima)?',
  ];
  const a = [
    '2026/09/22 10:14:05 AM GMT-3', 'marketing@horizonte.example',
    'Sim, irei enviar abaixo',
    'https://drive.google.com/u/0/open?usp=forms_web&id=EXEMPLO123',
    'Obra industrial atrasada e fora do orçamento. Mostrar canteiro organizado, cronograma cumprido e equipe com EPI.',
    'Diretores industriais e gestores de compras de indústrias médias',
    'Galpões prontos em destaque, com a estrutura metálica aparente; tecnologia como drones de vistoria e BIM',
    'Técnico, confiável, sólido',
    'Não temos fotos próprias em quantidade, preferimos bancos de imagem profissionais',
    'Não mostrar pessoas sem EPI nem trabalho em altura sem linha de vida',
    'Linha de comunicação de grandes construtoras industriais',
    'Mescla de fotos reais e produto em destaque',
    'Não usar "barato" nem "menor preço". Só fazemos anúncios em redes sociais; não temos landing pages.',
    'Vermelho',
    'Improvisado, amador, barato',
    'Temos duas linhas de serviço: Horizonte Galpões e Horizonte Reformas, que usam o mesmo logo com descritor.',
  ];
  const csv = [q, a].map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  return new File([csv], '[Horizonte] Briefing para criação de materiais gráficos (exemplo).csv', { type: 'text/csv' });
}
