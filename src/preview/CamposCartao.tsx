/** Módulo 5 - Lista os campos do JSON gerado pela IA (cartao_schema.json), só leitura. */

const ROTULOS: [string, string][] = [
  ['modelo', 'Modelo'],
  ['modelo_incerto', 'Modelo incerto'],
  ['contexto', 'Contexto'],
  ['pergunta', 'Pergunta'],
  ['observacao_pergunta', 'Obs. da pergunta'],
  ['imagem_pergunta', 'Imagem da pergunta'],
  ['resposta', 'Resposta'],
  ['observacao_resposta', 'Obs. da resposta'],
  ['exemplo', 'Exemplo'],
  ['imagem_resposta', 'Imagem da resposta'],
];

const ROTULOS_ITEM: [string, string][] = [
  ['pergunta', 'Pergunta'],
  ['rotulo', 'Rótulo'],
  ['resposta', 'Resposta'],
  ['exemplo', 'Exemplo'],
  ['imagem', 'Imagem'],
];

const texto = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
const preenchido = (v: unknown) => v !== null && v !== undefined && v !== '';

function Linha({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-x-3 py-1.5 border-b border-neutral-600/60 last:border-0">
      <dt className="text-xs text-neutral-400 pt-0.5">{rotulo}</dt>
      <dd className="text-sm text-neutral-100 font-mono whitespace-pre-wrap break-words">{texto(valor)}</dd>
    </div>
  );
}

export function CamposCartao({ json }: { json: Record<string, unknown> | null }) {
  if (!json) return <p className="text-sm text-neutral-400">Este cartão ainda não tem campos gerados.</p>;

  const itens = Array.isArray(json.itens) ? (json.itens as Record<string, unknown>[]) : [];

  return (
    <dl>
      {ROTULOS.filter(([k]) => preenchido(json[k])).map(([k, rotulo]) => (
        <Linha key={k} rotulo={rotulo} valor={json[k]} />
      ))}
      {itens.map((it, n) => (
        <div key={n} className="mt-3 rounded-md bg-neutral-700/60 px-3 py-1">
          <p className="text-xs font-medium text-neutral-300 pt-1.5">Item {n + 1}</p>
          {ROTULOS_ITEM.filter(([k]) => preenchido(it[k])).map(([k, rotulo]) => (
            <Linha key={k} rotulo={rotulo} valor={it[k]} />
          ))}
        </div>
      ))}
    </dl>
  );
}
