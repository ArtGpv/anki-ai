/**
 * Módulo 2 - Busca aproximada de cartões (Fuse.js) por texto do input e por tags.
 * Requer: npm i fuse.js
 */
import Fuse from 'fuse.js';
import { db, ehDescendente, type Cartao, type EstadoCartao } from '../db';

export interface FiltroBusca {
  /** Limita a um grupo. */
  grupoId?: string;
  /** Tags escolhidas na modal (Módulo 4): o cartão entra se tiver ao menos uma delas ou uma subtag. */
  tags?: string[];
  estado?: EstadoCartao;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const semHtml = (s: unknown) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, ' ') : '');

interface Doc {
  cartao: Cartao;
  entrada: string;
  campos: string;
  tags: string;
}

/** Texto gerado pela IA (contexto, pergunta, itens) também entra na busca, quando o cartão já foi gerado. */
function textoGerado(c: Cartao): string {
  const j = c.json;
  if (!j) return '';
  const itens = Array.isArray(j.itens) ? (j.itens as { pergunta?: unknown }[]).map((i) => semHtml(i?.pergunta)) : [];
  return [semHtml(j.contexto), semHtml(j.pergunta), ...itens].join(' ');
}

function temAlgumaTag(c: Cartao, escolhidas: string[]): boolean {
  const alvo = escolhidas.map((t) => t.trim().replace(/\s*::\s*/g, '::').toLowerCase());
  return c.tags.some((t) => {
    const tl = t.toLowerCase();
    return alvo.some((a) => tl === a || ehDescendente(tl, a));
  });
}

export function buscarEmCartoes(cartoes: Cartao[], texto: string, filtro: FiltroBusca = {}): Cartao[] {
  let base = cartoes;
  if (filtro.grupoId) base = base.filter((c) => c.grupoId === filtro.grupoId);
  if (filtro.estado) base = base.filter((c) => c.estado === filtro.estado);
  if (filtro.tags?.length) base = base.filter((c) => temAlgumaTag(c, filtro.tags!));

  const consulta = semAcento(texto).trim();
  if (!consulta) return [...base].sort((a, b) => b.criadoEm - a.criadoEm);

  const docs: Doc[] = base.map((cartao) => ({
    cartao,
    entrada: semAcento(cartao.inputBase),
    campos: semAcento(textoGerado(cartao)),
    tags: semAcento(cartao.tags.join(' ').replace(/::/g, ' ')),
  }));
  const fuse = new Fuse(docs, {
    keys: [
      { name: 'entrada', weight: 2 },
      { name: 'campos', weight: 1.5 },
      { name: 'tags', weight: 1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  return fuse.search(consulta).map((r) => r.item.cartao);
}

/** Busca nos cartões salvos no IndexedDB. Texto vazio devolve todos (filtrados), do mais novo ao mais antigo. */
export async function buscarCartoes(texto: string, filtro: FiltroBusca = {}): Promise<Cartao[]> {
  return buscarEmCartoes(await db.cartoes.toArray(), texto, filtro);
}
