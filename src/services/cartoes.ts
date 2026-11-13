/** Módulo 2 - Cartões: salvar informações base, listar, editar (antes do envio), remover e tags. */
import { db, novoId, tags as servicoTags, type Cartao, type EstadoCartao, type ModeloCartao, type ModoCartao } from '../db';
import { cartaoOcupado } from './bloqueio';
import { ErroServico } from './erros';
import { obterGrupo } from './grupos';

export interface NovoCartao {
  grupoId: string;
  modo: ModoCartao;
  /** Modo A: prompt livre. Modo B: Front escrito pelo usuário. */
  inputBase: string;
  /** Obrigatório no Modo B; ignorado (vira null) no Modo A. */
  modelo?: ModeloCartao | null;
  tags?: string[];
}

export type EdicaoCartao = Partial<Pick<NovoCartao, 'modo' | 'inputBase' | 'modelo' | 'tags'>>;

/** Estados em que o input base ainda pode ser alterado (Módulo 3: só antes do envio). */
const EDITAVEIS: EstadoCartao[] = ['rascunho', 'erro'];

async function obterCartaoOuErro(id: string): Promise<Cartao> {
  const c = await db.cartoes.get(id);
  if (!c) throw new ErroServico('CARTAO_NAO_ENCONTRADO', 'Cartão não encontrado.');
  return c;
}

export const obterCartao = obterCartaoOuErro;

/** Garante que cada tag exista no cadastro (cria ancestrais) e devolve os caminhos com a caixa guardada, sem repetição. */
async function resolverTags(entrada: string[] = []): Promise<string[]> {
  const saida: string[] = [];
  for (const t of entrada) {
    const { caminho } = await servicoTags.adicionar(t);
    if (!saida.some((s) => s.toLowerCase() === caminho.toLowerCase())) saida.push(caminho);
  }
  return saida;
}

function validarBase(modo: ModoCartao, inputBase: string, modelo: ModeloCartao | null | undefined) {
  if (!inputBase.trim()) throw new ErroServico('TEXTO_VAZIO', 'Escreva o texto do cartão.');
  if (modo === 'B' && !modelo) {
    throw new ErroServico('MODELO_OBRIGATORIO', 'No Modo B, escolha o modelo do cartão.');
  }
}

export async function criarCartao(dados: NovoCartao): Promise<Cartao> {
  await obterGrupo(dados.grupoId);
  validarBase(dados.modo, dados.inputBase, dados.modelo);
  const cartao: Cartao = {
    id: novoId(),
    grupoId: dados.grupoId,
    modo: dados.modo,
    modelo: dados.modo === 'B' ? (dados.modelo ?? null) : null,
    inputBase: dados.inputBase.trim(),
    tags: await resolverTags(dados.tags),
    estado: 'rascunho',
    mensagemErro: null,
    json: null,
    front: null,
    back: null,
    fontes: [],
    criadoEm: Date.now(),
  };
  await db.cartoes.add(cartao);
  return cartao;
}

/** Cartões do grupo em ordem de criação. */
export async function listarCartoes(grupoId: string, filtro: { estado?: EstadoCartao } = {}): Promise<Cartao[]> {
  const lista = await db.cartoes.where('grupoId').equals(grupoId).sortBy('criadoEm');
  return filtro.estado ? lista.filter((c) => c.estado === filtro.estado) : lista;
}

/**
 * Edita o input base, o modo, o modelo e/ou as tags. Input, modo e modelo só em `rascunho` ou
 * `erro`; as tags podem mudar também em `pronto` (entram no .apkg na exportação).
 */
export async function editarCartao(id: string, mudancas: EdicaoCartao): Promise<Cartao> {
  const atual = await obterCartaoOuErro(id);
  if (atual.estado === 'enviando' || cartaoOcupado(id, atual.grupoId)) {
    throw new ErroServico('ENVIO_EM_ANDAMENTO', 'O cartão está sendo enviado. Aguarde terminar.');
  }
  const mexeNaBase = ['modo', 'inputBase', 'modelo'].some((k) => k in mudancas);
  if (mexeNaBase && !EDITAVEIS.includes(atual.estado)) {
    throw new ErroServico('ESTADO_INVALIDO', 'Cartão já gerado: use Regerar. Ajustes finos ficam a cargo do Anki.');
  }

  const modo = mudancas.modo ?? atual.modo;
  const inputBase = mudancas.inputBase ?? atual.inputBase;
  const modelo = modo === 'B' ? (mudancas.modelo ?? atual.modelo) : null;
  validarBase(modo, inputBase, modelo);

  const novo: Cartao = {
    ...atual,
    modo,
    modelo,
    inputBase: inputBase.trim(),
    tags: mudancas.tags ? await resolverTags(mudancas.tags) : atual.tags,
  };
  await db.cartoes.put(novo);
  return novo;
}

export async function removerCartao(id: string): Promise<void> {
  const c = await obterCartaoOuErro(id);
  if (cartaoOcupado(id, c.grupoId)) {
    throw new ErroServico('ENVIO_EM_ANDAMENTO', 'O cartão está sendo enviado. Aguarde terminar.');
  }
  await db.cartoes.delete(id);
}

/** Associa tags ao cartão (as que faltam no cadastro são criadas). */
export async function associarTags(id: string, tags: string[]): Promise<Cartao> {
  const c = await obterCartaoOuErro(id);
  return editarCartao(id, { tags: [...c.tags, ...tags] });
}

/** Desassocia tags do cartão (sem diferenciar caixa); não apaga as tags do cadastro. */
export async function desassociarTags(id: string, tags: string[]): Promise<Cartao> {
  const c = await obterCartaoOuErro(id);
  const fora = new Set(tags.map((t) => t.trim().replace(/\s*::\s*/g, '::').toLowerCase()));
  const restantes = c.tags.filter((t) => !fora.has(t.toLowerCase()));
  return editarCartao(id, { tags: restantes });
}
