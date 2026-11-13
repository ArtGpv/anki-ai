/** Módulo 1 - Contadores de uso: requisições do dia (Gemini) e buscas/créditos do mês (Tavily). */
import { db, definirConfig } from '../db';
import {
  CHAVES,
  CREDITOS_TAVILY_AVANCADO,
  CREDITOS_TAVILY_BASICO,
  LIMITE_DIA_PADRAO,
  LIMITE_MES_TAVILY_PADRAO,
} from './config-ia';
import { ErroIA } from './erros-ia';

interface Registro {
  dia: string;
  total: number;
}

/** A cota diária do Gemini zera à meia-noite do Pacífico; o contador segue o mesmo relógio. */
export function diaDeReset(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora); // YYYY-MM-DD
}

export async function lerContador(agora: Date = new Date()) {
  const dia = diaDeReset(agora);
  const reg = (await db.config.get(CHAVES.contador))?.valor as Registro | undefined;
  const limite = ((await db.config.get(CHAVES.limiteDia))?.valor as number | undefined) ?? LIMITE_DIA_PADRAO;
  return { dia, total: reg?.dia === dia ? reg.total : 0, limite };
}

/** Reserva 1 requisição antes da chamada (atômico). Lança LIMITE_DIARIO se a cota acabou. */
export async function reservarRequisicao(agora: Date = new Date()): Promise<number> {
  return db.transaction('rw', db.config, async () => {
    const { dia, total, limite } = await lerContador(agora);
    if (total >= limite) {
      throw new ErroIA('LIMITE_DIARIO', `Limite diário de ${limite} requisições atingido. Aumente o limite nas Configurações ou tente amanhã.`);
    }
    await db.config.put({ chave: CHAVES.contador, valor: { dia, total: total + 1 } satisfies Registro });
    return total + 1;
  });
}

export async function definirLimiteDiario(limite: number): Promise<void> {
  if (!Number.isInteger(limite) || limite < 1) throw new Error('O limite diário deve ser um inteiro maior que 0.');
  await definirConfig(CHAVES.limiteDia, limite);
}

// --- Tavily (v4): contagem local e aproximada; a oficial fica no painel da Tavily ---

interface RegistroTavily {
  mes: string;
  buscas: number;
  creditos: number;
}

/** Os créditos da Tavily renovam no dia 1 de cada mês; o contador usa o mês civil em UTC (YYYY-MM). */
export function mesDeReset(agora: Date = new Date()): string {
  return agora.toISOString().slice(0, 7);
}

export const custoBuscaTavily = (avancado: boolean): number =>
  avancado ? CREDITOS_TAVILY_AVANCADO : CREDITOS_TAVILY_BASICO;

export interface UsoTavily {
  mes: string;
  buscas: number;
  /** Créditos estimados: básica = 1, avançada = 2. */
  creditos: number;
  /** Limite mensal de créditos (editável). */
  limite: number;
}

export async function lerContadorTavily(agora: Date = new Date()): Promise<UsoTavily> {
  const mes = mesDeReset(agora);
  const reg = (await db.config.get(CHAVES.contadorTavily))?.valor as RegistroTavily | undefined;
  const limite =
    ((await db.config.get(CHAVES.limiteMesTavily))?.valor as number | undefined) ?? LIMITE_MES_TAVILY_PADRAO;
  const atual = reg?.mes === mes;
  return { mes, buscas: atual ? reg.buscas : 0, creditos: atual ? reg.creditos : 0, limite };
}

/**
 * Reserva uma busca antes da chamada (atômico), como o contador do Gemini: a busca conta mesmo
 * se falhar depois. Lança TAVILY_LIMITE (que interrompe a fila) se os créditos do mês acabariam.
 */
export async function reservarBuscaTavily(avancado: boolean, agora: Date = new Date()): Promise<UsoTavily> {
  return db.transaction('rw', db.config, async () => {
    const uso = await lerContadorTavily(agora);
    const custo = custoBuscaTavily(avancado);
    if (uso.creditos + custo > uso.limite) {
      throw new ErroIA(
        'TAVILY_LIMITE',
        `Limite mensal de ${uso.limite} créditos da Tavily atingido (${uso.creditos} usados). Aumente o limite nas Configurações ou espere o mês virar.`,
      );
    }
    const novo: UsoTavily = { ...uso, buscas: uso.buscas + 1, creditos: uso.creditos + custo };
    await db.config.put({
      chave: CHAVES.contadorTavily,
      valor: { mes: novo.mes, buscas: novo.buscas, creditos: novo.creditos } satisfies RegistroTavily,
    });
    return novo;
  });
}

export async function definirLimiteMensalTavily(limite: number): Promise<void> {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error('O limite mensal da Tavily deve ser um inteiro maior que 0.');
  }
  await definirConfig(CHAVES.limiteMesTavily, limite);
}
