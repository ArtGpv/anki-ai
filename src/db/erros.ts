export type CodigoErro =
  | 'CAMINHO_INVALIDO'
  | 'NIVEL_EXCEDIDO'
  | 'CONFIRMACAO_NECESSARIA'
  | 'BARALHO_EM_USO'
  | 'CHAVE_VAZIA';

/** Erro de regra de negócio; `detalhes` traz dados para a interface (ex.: itens afetados). */
export class ErroPersistencia extends Error {
  constructor(
    public readonly codigo: CodigoErro,
    mensagem: string,
    public readonly detalhes: string[] = [],
  ) {
    super(mensagem);
    this.name = 'ErroPersistencia';
  }
}
