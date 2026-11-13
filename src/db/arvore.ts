/**
 * Serviço genérico para itens hierárquicos guardados como caminho completo.
 * Tags e baralhos usam a mesma implementação (como na modal única do Módulo 4),
 * mudando apenas as opções.
 */
import type { Table } from 'dexie';
import { ancestrais, construirArvore, ehDescendente, nivel, normalizarCaminho, SEP, type NoArvore } from './caminhos';
import { ErroPersistencia } from './erros';
import type { ItemArvore } from './tipos';

export interface OpcoesArvore {
  maxNiveis: number;
  /** Tabelas extras que `aoRemover` precisa acessar (entram na mesma transação). */
  tabelasExtras?: Table<any, any>[];
  /** Roda dentro da transação, antes de apagar. Lance erro para bloquear ou faça a cascata. */
  aoRemover?: (removidos: string[]) => Promise<void>;
}

export interface PreviaRemocao {
  /** Itens escolhidos que existem. */
  selecionados: string[];
  /** Descendentes que também seriam apagados e não foram escolhidos. */
  filhosExtras: string[];
  /** Tudo que será apagado. */
  todos: string[];
}

export function criarServicoArvore(tabela: Table<ItemArvore, string>, op: OpcoesArvore) {
  const chaveBusca = (c: string) => c.toLowerCase(); // Anki trata tags/baralhos sem diferenciar caixa

  /**
   * Adiciona o caminho e os ancestrais que faltarem. Se algum segmento já existe com outra
   * caixa, reaproveita a caixa existente. Devolve o caminho final e o que foi criado.
   */
  async function adicionar(entrada: string): Promise<{ caminho: string; criados: string[] }> {
    const pedido = normalizarCaminho(entrada);
    if (nivel(pedido) > op.maxNiveis) {
      throw new ErroPersistencia('NIVEL_EXCEDIDO', `No máximo ${op.maxNiveis} nível(is) de hierarquia.`);
    }
    return tabela.db.transaction('rw', tabela, async () => {
      const existentes = new Map((await tabela.toArray()).map((i) => [chaveBusca(i.caminho), i.caminho]));
      const criados: string[] = [];
      let atual = '';
      for (const seg of pedido.split(SEP)) {
        const tentativa = atual ? atual + SEP + seg : seg;
        const ja = existentes.get(chaveBusca(tentativa));
        if (ja) {
          atual = ja;
        } else {
          await tabela.add({ caminho: tentativa, criadoEm: Date.now() });
          existentes.set(chaveBusca(tentativa), tentativa);
          criados.push(tentativa);
          atual = tentativa;
        }
      }
      return { caminho: atual, criados };
    });
  }

  async function listar(): Promise<string[]> {
    return (await tabela.toCollection().primaryKeys()).sort((a, b) =>
      a.localeCompare(b, 'pt', { sensitivity: 'base' }),
    );
  }

  async function arvore(): Promise<NoArvore[]> {
    return construirArvore(await listar());
  }

  /** Filtro em tempo real da modal: mantém itens cujo caminho contém o texto, mais seus ancestrais. */
  async function buscar(texto: string): Promise<string[]> {
    const alvo = texto.trim().toLowerCase();
    const todos = await listar();
    if (!alvo) return todos;
    const achados = todos.filter((c) => c.toLowerCase().includes(alvo));
    return [...new Set(achados.flatMap((c) => [...ancestrais(c), c]))].sort();
  }

  async function previaRemocao(caminhos: string[]): Promise<PreviaRemocao> {
    const todosItens = await tabela.toCollection().primaryKeys();
    const pedidos = new Set(caminhos.map((c) => chaveBusca(normalizarCaminho(c))));
    const selecionados = todosItens.filter((c) => pedidos.has(chaveBusca(c)));
    const filhosExtras = todosItens.filter(
      (c) => !selecionados.includes(c) && selecionados.some((s) => ehDescendente(c, s)),
    );
    return { selecionados, filhosExtras, todos: [...selecionados, ...filhosExtras] };
  }

  /**
   * Apaga os itens escolhidos. Se houver filhos não escolhidos, exige `confirmarFilhos: true`
   * (senão lança CONFIRMACAO_NECESSARIA com os filhos em `detalhes`).
   */
  async function remover(caminhos: string[], { confirmarFilhos = false } = {}): Promise<string[]> {
    return tabela.db.transaction('rw', [tabela, ...(op.tabelasExtras ?? [])], async () => {
      const { filhosExtras, todos } = await previaRemocao(caminhos);
      if (filhosExtras.length && !confirmarFilhos) {
        throw new ErroPersistencia(
          'CONFIRMACAO_NECESSARIA',
          'Os itens selecionados têm filhos, que também serão apagados.',
          filhosExtras,
        );
      }
      await op.aoRemover?.(todos);
      await tabela.bulkDelete(todos);
      return todos;
    });
  }

  return { adicionar, listar, arvore, buscar, previaRemocao, remover };
}
