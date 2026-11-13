import { criarServicoArvore } from './arvore';
import { ErroPersistencia } from './erros';
import { db } from './db';

/** Máximo de níveis de um baralho: "A" (1) e "A::B" (2). Ajuste aqui se a interpretação mudar. */
export const MAX_NIVEIS_BARALHO = 2;

/** Baralho usado por algum grupo não pode ser apagado (nem por cascata). */
export const baralhos = criarServicoArvore(db.baralhos, {
  maxNiveis: MAX_NIVEIS_BARALHO,
  tabelasExtras: [db.grupos],
  aoRemover: async (removidos) => {
    const emUso = await db.grupos.where('baralho').anyOf(removidos).toArray();
    if (emUso.length) {
      throw new ErroPersistencia(
        'BARALHO_EM_USO',
        'Há grupos usando este baralho; ele não pode ser apagado.',
        emUso.map((g) => g.nome),
      );
    }
  },
});
