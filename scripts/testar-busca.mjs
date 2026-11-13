// Diagnóstico da busca do Google no Gemini, com a SUA chave (fora do app).
// Uso (PowerShell):  $env:GEMINI_API_KEY="SUA_CHAVE"; node scripts/testar-busca.mjs [modelo]
// Uso (bash):        GEMINI_API_KEY="SUA_CHAVE" node scripts/testar-busca.mjs [modelo]
// Faz 4 chamadas pequenas (conta 4 requisições na sua cota), com 3 s entre elas.
import { GoogleGenAI } from '@google/genai';

const chave = process.env.GEMINI_API_KEY;
if (!chave) {
  console.error('Defina a variável GEMINI_API_KEY antes de rodar.');
  process.exit(1);
}
const modelo = process.argv[2] ?? 'gemini-3.6-flash';
const ai = new GoogleGenAI({ apiKey: chave });
const pergunta = 'Defina a transformada de Laplace em uma frase.';
const schema = { type: 'object', properties: { definicao: { type: 'string' } }, required: ['definicao'] };

const testes = [
  ['1. sem ferramentas (base)', {}],
  ['2. só googleSearch (como o exemplo do AI Studio)', { tools: [{ googleSearch: {} }] }],
  ['3. googleSearch + saída JSON (como o app, estratégia "combinada")', { tools: [{ googleSearch: {} }], responseMimeType: 'application/json', responseJsonSchema: schema }],
  ['4. googleSearch + pensamento mínimo', { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: 'MINIMAL' } }],
];

console.log(`Modelo: ${modelo}\n`);
for (const [nome, config] of testes) {
  try {
    const r = await ai.models.generateContent({ model: modelo, contents: pergunta, config });
    const fontes = r.candidates?.[0]?.groundingMetadata?.groundingChunks?.length ?? 0;
    console.log(`OK   ${nome}\n     fontes: ${fontes} | ${String(r.text).slice(0, 90).replace(/\s+/g, ' ')}\n`);
  } catch (e) {
    console.log(`ERRO ${nome}\n     ${e.status ?? ''} ${String(e.message).slice(0, 500)}\n`);
  }
  await new Promise((res) => setTimeout(res, 3000));
}
