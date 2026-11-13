/**
 * Núcleo do motor Python (Pyodide). Não depende de Worker nem de fetch: tudo que muda entre
 * navegador e Node (testes) entra por `DependenciasMotor`.
 */
import type { PyodideInterface } from 'pyodide';

export interface DependenciasMotor {
  loadPyodide: (opcoes: { indexURL: string }) => Promise<PyodideInterface>;
  /** Pasta onde estão os arquivos do Pyodide (com "/" no final no navegador). */
  indexURL: string;
  /** Lê um arquivo relativo à pasta do Pyodide (ex.: "manifest.json", "wheels/genanki.whl"). */
  lerArquivo: (relativo: string) => Promise<Uint8Array>;
  /** Código dos módulos Python do projeto: nome -> conteúdo (inclui "ponte"). */
  modulos: Record<string, string>;
  aoStatus?: (fase: FaseCarga) => void;
}

export type FaseCarga = 'carregando_pyodide' | 'carregando_pacotes' | 'instalando_genanki' | 'copiando_modulos' | 'pronto';

export interface ManifestoPyodide {
  versaoPyodide: string;
  /** Pacotes do repositório do Pyodide (com dependências já baixadas): micropip, pyyaml, sqlite3. */
  pacotesPyodide: string[];
  /** Wheels puros (genanki e dependências) dentro de wheels/. */
  wheels: string[];
}

export interface CartaoPronto {
  baralho: string;
  front: string;
  back: string;
  tags: string[];
}

export interface ResultadoProcessamento {
  ok: boolean;
  /** ok | separar_cartoes | entrada_insuficiente | invalido */
  status: string;
  mensagem: string | null;
  erros: string[];
  cartao: CartaoPronto | null;
  json: Record<string, unknown> | null;
}

export interface ArgsProcessar {
  /** JSON da IA (objeto ou texto, com ou sem cerca ```json). */
  entrada: string | Record<string, unknown>;
  baralho: string;
  tags?: string[];
  delimitador?: 'parenteses' | 'tag';
}

export interface InfoPython {
  tentativas_regeneracao: number;
  delimitador: string;
}

export interface Motor {
  py: PyodideInterface;
  info(): InfoPython;
  processar(args: ArgsProcessar): ResultadoProcessamento;
  /** Devolve os bytes do .apkg. */
  gerarApkg(cartoes: CartaoPronto[]): Uint8Array;
}

const DIR_APP = '/home/pyodide/app';
const DIR_WHEELS = '/tmp/wheels';
const ARQ_APKG = '/tmp/saida.apkg';

export async function iniciarMotor(dep: DependenciasMotor): Promise<Motor> {
  const status = dep.aoStatus ?? (() => {});

  status('carregando_pyodide');
  const manifesto: ManifestoPyodide = JSON.parse(new TextDecoder().decode(await dep.lerArquivo('manifest.json')));
  const py = await dep.loadPyodide({ indexURL: dep.indexURL });

  status('carregando_pacotes');
  await py.loadPackage(manifesto.pacotesPyodide);

  status('instalando_genanki');
  py.FS.mkdirTree(DIR_WHEELS);
  const caminhos: string[] = [];
  for (const nome of manifesto.wheels) {
    py.FS.writeFile(`${DIR_WHEELS}/${nome}`, await dep.lerArquivo(`wheels/${nome}`));
    caminhos.push(`emfs:${DIR_WHEELS}/${nome}`);
  }
  py.globals.set('_wheels_json', JSON.stringify(caminhos));
  // deps=False: tudo já está na lista; evita qualquer consulta à rede (funciona offline).
  await py.runPythonAsync('import json, micropip\nawait micropip.install(json.loads(_wheels_json), deps=False)\ndel _wheels_json');

  status('copiando_modulos');
  py.FS.mkdirTree(DIR_APP);
  for (const [nome, codigo] of Object.entries(dep.modulos)) py.FS.writeFile(`${DIR_APP}/${nome}.py`, codigo);
  py.runPython(`import sys\nif "${DIR_APP}" not in sys.path:\n    sys.path.insert(0, "${DIR_APP}")`);
  const ponte = py.pyimport('ponte');

  status('pronto');
  return {
    py,
    info: () => JSON.parse(ponte.info()),
    processar: ({ entrada, baralho, tags, delimitador }) =>
      JSON.parse(
        ponte.processar_json(
          typeof entrada === 'string' ? entrada : JSON.stringify(entrada),
          baralho,
          tags?.length ? JSON.stringify(tags) : null,
          delimitador ?? null,
        ),
      ),
    gerarApkg: (cartoes) => {
      ponte.gerar_apkg_arquivo(JSON.stringify(cartoes), ARQ_APKG);
      const bytes = py.FS.readFile(ARQ_APKG);
      py.FS.unlink(ARQ_APKG);
      return bytes;
    },
  };
}
