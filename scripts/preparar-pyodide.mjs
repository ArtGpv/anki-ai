// Prepara public/pyodide/ para o app funcionar offline (sem CDN).
// Uso: npm run pyodide:preparar   (precisa de internet e de python/pip; rode 1x e em CI antes do build)
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DESTINO = 'public/pyodide';
const PACOTES_PYODIDE = ['micropip', 'pyyaml']; // do repositório do Pyodide (têm código nativo ou são do núcleo)
const WHEELS_PUROS = ['genanki', 'cached-property', 'chevron', 'frozendict']; // pure Python, via pip

const versao = JSON.parse(await readFile('node_modules/pyodide/package.json', 'utf8')).version;
console.log(`Pyodide ${versao}`);

await rm(DESTINO, { recursive: true, force: true });
await mkdir(join(DESTINO, 'wheels'), { recursive: true });
await cp('node_modules/pyodide', DESTINO, { recursive: true }); // núcleo: asm.js, wasm, stdlib, lock...

// Resolve as dependências dos pacotes do Pyodide pelo pyodide-lock.json e baixa os arquivos.
const lock = JSON.parse(await readFile(join(DESTINO, 'pyodide-lock.json'), 'utf8'));
const precisa = new Set();
const visitar = (nome) => {
  const chave = nome.toLowerCase();
  const pkg = lock.packages[chave];
  if (!pkg) throw new Error(`Pacote "${nome}" não existe no pyodide-lock.json da versão ${versao}.`);
  if (precisa.has(chave)) return;
  precisa.add(chave);
  (pkg.depends ?? []).forEach(visitar);
};
PACOTES_PYODIDE.forEach(visitar);

for (const chave of precisa) {
  const arq = lock.packages[chave].file_name;
  const alvo = join(DESTINO, arq);
  try { await stat(alvo); continue; } catch {}
  const url = `https://cdn.jsdelivr.net/pyodide/v${versao}/full/${arq}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar ${url}: ${r.status}`);
  await writeFile(alvo, Buffer.from(await r.arrayBuffer()));
  console.log('  baixado', arq);
}

// Wheels puros (genanki e dependências), instalados depois com micropip a partir do disco.
const pasta = join(DESTINO, 'wheels');
execFileSync(
  process.platform === 'win32' ? 'python' : 'python3',
  ['-m', 'pip', 'download', ...WHEELS_PUROS, '--no-deps', '--only-binary=:all:', '--platform', 'any', '-d', pasta],
  { stdio: 'inherit' },
);
const wheels = (await readdir(pasta)).filter((f) => f.endsWith('.whl'));
for (const esperado of WHEELS_PUROS) {
  const base = esperado.replace(/-/g, '_').toLowerCase();
  if (!wheels.some((w) => w.toLowerCase().startsWith(base + '-'))) {
    throw new Error(`Wheel de "${esperado}" não encontrado (sem wheel py3-none-any no PyPI?).`);
  }
}

await writeFile(
  join(DESTINO, 'manifest.json'),
  JSON.stringify({ versaoPyodide: versao, pacotesPyodide: PACOTES_PYODIDE, wheels }, null, 2),
);
console.log(`Pronto: ${DESTINO}/ (${wheels.length} wheels puros).`);
