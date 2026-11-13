/** Módulo 2 - Erros de regra de negócio da camada de serviços (mensagens em português para a interface). */

export type CodigoErroServico =
  | 'NOME_VAZIO'
  | 'TEXTO_VAZIO'
  | 'MODELO_OBRIGATORIO'
  | 'BARALHO_INEXISTENTE'
  | 'GRUPO_NAO_ENCONTRADO'
  | 'CARTAO_NAO_ENCONTRADO'
  | 'ESTADO_INVALIDO'
  | 'ENVIO_EM_ANDAMENTO'
  | 'SEM_CARTOES_PRONTOS'
  | 'CONFIG_INVALIDA';

export class ErroServico extends Error {
  constructor(
    public readonly codigo: CodigoErroServico,
    mensagem: string,
    public readonly detalhes: string[] = [],
  ) {
    super(mensagem);
    this.name = 'ErroServico';
  }
}
