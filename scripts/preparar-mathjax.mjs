// Copia o MathJax 3 (saída SVG, arquivo único) para public/mathjax/, para o app funcionar offline.
// Uso: npm run mathjax:preparar   (depois de: npm i mathjax@3)
import { cp, mkdir, readFile, stat } from 'node:fs/promises';

const ORIGEM = 'node_modules/mathjax/es5/tex-svg.js';
const DESTINO = 'public/mathjax';

try {
  await stat(ORIGEM);
} catch {
  throw new Error('MathJax não encontrado. Rode "npm i mathjax@3" antes.');
}
const versao = JSON.parse(await readFile('node_modules/mathjax/package.json', 'utf8')).version;
if (!versao.startsWith('3.')) throw new Error(`Esperava MathJax 3.x, encontrei ${versao}. Rode "npm i mathjax@3".`);

await mkdir(DESTINO, { recursive: true });
await cp(ORIGEM, `${DESTINO}/tex-svg.js`);
console.log(`MathJax ${versao} copiado para ${DESTINO}/tex-svg.js`);
