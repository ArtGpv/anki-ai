/** Chaves da API (Gemini e Tavily) e demais configurações. Chaves guardadas só no IndexedDB, sem cifrar (decisão do Módulo 3). */
import { db } from './db';
import { ErroPersistencia } from './erros';

const CHAVE_API = 'chaveApi';
const CHAVE_TAVILY = 'chaveTavily';
const RESERVADAS = [CHAVE_API, CHAVE_TAVILY];

async function guardar(nome: string, chave: string, msgVazia: string): Promise<void> {
  const limpa = chave.trim();
  if (!limpa) throw new ErroPersistencia('CHAVE_VAZIA', msgVazia);
  await db.config.put({ chave: nome, valor: limpa });
}

async function ler(nome: string): Promise<string | null> {
  return ((await db.config.get(nome))?.valor as string | undefined) ?? null;
}

// --- Gemini ---

export const definirChave = (chave: string): Promise<void> => guardar(CHAVE_API, chave, 'Informe a chave da API.');
export const obterChave = (): Promise<string | null> => ler(CHAVE_API);

export async function removerChave(): Promise<void> {
  await db.config.delete(CHAVE_API);
}

// --- Tavily (v4) ---

export const definirChaveTavily = (chave: string): Promise<void> =>
  guardar(CHAVE_TAVILY, chave, 'Informe a chave da API da Tavily.');
export const obterChaveTavily = (): Promise<string | null> => ler(CHAVE_TAVILY);

export async function removerChaveTavily(): Promise<void> {
  await db.config.delete(CHAVE_TAVILY);
}

/** Ex.: "AIzaSyABC123" -> "AIza••••••••"; "tvly-abc123" -> "tvly••••••••". */
export function mascararChave(chave: string): string {
  return chave.length <= 4 ? '•'.repeat(8) : chave.slice(0, 4) + '•'.repeat(8);
}

export async function obterChaveMascarada(): Promise<string | null> {
  const k = await obterChave();
  return k ? mascararChave(k) : null;
}

export async function obterChaveTavilyMascarada(): Promise<string | null> {
  const k = await obterChaveTavily();
  return k ? mascararChave(k) : null;
}

/** Configurações genéricas (modelo, pausa, tema...). Os valores padrão ficam a cargo de quem chama. */
export async function obterConfig<T>(chave: string, padrao: T): Promise<T> {
  const item = await db.config.get(chave);
  return item ? (item.valor as T) : padrao;
}

export async function definirConfig(chave: string, valor: unknown): Promise<void> {
  if (RESERVADAS.includes(chave)) throw new Error(`Use as funções de chave para "${chave}".`);
  await db.config.put({ chave, valor });
}
