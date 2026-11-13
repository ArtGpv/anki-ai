/** Módulo 2 - Grupos: criar, listar (com resumo de estados), trocar baralho e remover. */
import { baralhos, db, normalizarCaminho, novoId, type Cartao, type Grupo } from '../db';
import { grupoOcupado } from './bloqueio';
import { ErroServico } from './erros';

/**
 * O estado do grupo não é gravado (Módulo 3): `finalizado` = há cartões e todos estão `pronto`.
 * Grupo vazio ou com qualquer cartão fora de `pronto` é `rascunho` (borda amarela/laranja).
 */
export type EstadoGrupo = 'rascunho' | 'finalizado';

export interface ResumoGrupo {
  total: number;
  prontos: number;
  erros: number;
  rascunhos: number;
  enviando: number;
  estado: EstadoGrupo;
}

export interface GrupoComResumo extends Grupo {
  resumo: ResumoGrupo;
}

export function resumirCartoes(cartoes: Pick<Cartao, 'estado'>[]): ResumoGrupo {
  const conta = (e: Cartao['estado']) => cartoes.filter((c) => c.estado === e).length;
  const prontos = conta('pronto');
  return {
    total: cartoes.length,
    prontos,
    erros: conta('erro'),
    rascunhos: conta('rascunho'),
    enviando: conta('enviando'),
    estado: cartoes.length > 0 && prontos === cartoes.length ? 'finalizado' : 'rascunho',
  };
}

/** Confere se o baralho existe (sem diferenciar caixa) e devolve o caminho com a caixa guardada. */
async function resolverBaralho(entrada: string): Promise<string> {
  const pedido = normalizarCaminho(entrada);
  const achado = (await baralhos.listar()).find((b) => b.toLowerCase() === pedido.toLowerCase());
  if (!achado) {
    throw new ErroServico('BARALHO_INEXISTENTE', `O baralho "${pedido}" não existe. Crie-o na modal de Baralhos.`);
  }
  return achado;
}

export async function criarGrupo(dados: { nome: string; baralho: string }): Promise<Grupo> {
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  if (!nome) throw new ErroServico('NOME_VAZIO', 'Informe o nome do grupo.');
  const grupo: Grupo = { id: novoId(), nome, baralho: await resolverBaralho(dados.baralho), criadoEm: Date.now() };
  await db.grupos.add(grupo);
  return grupo;
}

export async function obterGrupo(id: string): Promise<Grupo> {
  const g = await db.grupos.get(id);
  if (!g) throw new ErroServico('GRUPO_NAO_ENCONTRADO', 'Grupo não encontrado.');
  return g;
}

export async function obterResumoGrupo(id: string): Promise<ResumoGrupo> {
  return resumirCartoes(await db.cartoes.where('grupoId').equals(id).toArray());
}

/** Dashboard: grupos do mais novo para o mais antigo, cada um com o resumo (ex.: "8/10"). */
export async function listarGrupos(): Promise<GrupoComResumo[]> {
  const [grupos, cartoes] = await Promise.all([db.grupos.toArray(), db.cartoes.toArray()]);
  const porGrupo = new Map<string, Cartao[]>();
  for (const c of cartoes) porGrupo.set(c.grupoId, [...(porGrupo.get(c.grupoId) ?? []), c]);
  return grupos
    .sort((a, b) => b.criadoEm - a.criadoEm)
    .map((g) => ({ ...g, resumo: resumirCartoes(porGrupo.get(g.id) ?? []) }));
}

/** Associa (ou altera) o baralho do grupo; o baralho precisa existir. */
export async function alterarBaralhoDoGrupo(grupoId: string, baralho: string): Promise<Grupo> {
  const g = await obterGrupo(grupoId);
  const novo = await resolverBaralho(baralho);
  await db.grupos.update(g.id, { baralho: novo });
  return { ...g, baralho: novo };
}

export async function renomearGrupo(grupoId: string, nome: string): Promise<void> {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (!limpo) throw new ErroServico('NOME_VAZIO', 'Informe o nome do grupo.');
  await obterGrupo(grupoId);
  await db.grupos.update(grupoId, { nome: limpo });
}

/** Remove o grupo, seus cartões e seus arquivos anexados. Devolve quantos cartões foram apagados. */
export async function removerGrupo(grupoId: string): Promise<number> {
  await obterGrupo(grupoId);
  if (grupoOcupado(grupoId)) {
    throw new ErroServico('ENVIO_EM_ANDAMENTO', 'Este grupo está sendo enviado. Aguarde terminar para apagá-lo.');
  }
  return db.transaction('rw', db.grupos, db.cartoes, db.arquivos, async () => {
    const apagados = await db.cartoes.where('grupoId').equals(grupoId).delete();
    await db.arquivos.where('grupoId').equals(grupoId).delete();
    await db.grupos.delete(grupoId);
    return apagados;
  });
}
