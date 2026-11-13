import { criarServicoArvore } from './arvore';
import { db } from './db';

/** Tags: hierarquia ilimitada. Apagar uma tag a remove também dos cartões. */
export const tags = criarServicoArvore(db.tags, {
  maxNiveis: Number.POSITIVE_INFINITY,
  tabelasExtras: [db.cartoes],
  aoRemover: async (removidos) => {
    const set = new Set(removidos);
    await db.cartoes
      .where('tags')
      .anyOf(removidos)
      .modify((c) => {
        c.tags = c.tags.filter((t) => !set.has(t));
      });
  },
});
