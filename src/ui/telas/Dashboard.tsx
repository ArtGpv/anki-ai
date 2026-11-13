import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { listarGrupos, type GrupoComResumo } from '../../services';
import { IconeBaixar, IconeMais } from '../componentes/Icones';
import { TopbarGlobal } from '../componentes/TopbarGlobal';
import { ModalCartao } from '../modais/ModalCartao';
import { ModalGrupo } from '../modais/ModalGrupo';
import { exportarEBaixar, textoExportacao } from '../python';
import { ir } from '../rota';
import { useToast } from '../toast';
import { mensagemDeErro } from '../util';

/** Tela principal: um card por grupo (borda amarela = rascunho, verde = finalizado). */
export function Dashboard() {
  const grupos = useLiveQuery(listarGrupos, []);
  const [novoGrupo, setNovoGrupo] = useState(false);
  const [cartaoEm, setCartaoEm] = useState<string | null>(null);
  const [exportando, setExportando] = useState<string | null>(null);
  const { avisar } = useToast();

  async function exportar(g: GrupoComResumo) {
    setExportando(g.id);
    try {
      avisar(textoExportacao(await exportarEBaixar(g.id)), { tipo: 'ok' });
    } catch (e) {
      avisar(mensagemDeErro(e), { tipo: 'erro' });
    } finally {
      setExportando(null);
    }
  }

  return (
    <>
      <TopbarGlobal />
      <main className="rolagem min-h-0 flex-1 px-4 py-4 pb-28">
        {grupos && grupos.length === 0 && (
          <p className="mx-auto mt-16 max-w-xs text-center text-[var(--texto-suave)]">
            Nenhum grupo formado. Clique no botão '+' para criar seu primeiro baralho
          </p>
        )}
        <ul className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {grupos?.map((g) => {
            const fin = g.resumo.estado === 'finalizado';
            const contador = g.resumo.erros > 0 || g.resumo.enviando > 0 ? `${g.resumo.prontos}/${g.resumo.total}` : null;
            return (
              <li
                key={g.id}
                className="flex overflow-hidden rounded-xl border-2 bg-[var(--card)]"
                style={{ borderColor: fin ? 'var(--verde)' : 'var(--amarelo)' }}
              >
                <button type="button" onClick={() => ir(`/grupo/${g.id}`)} className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-[var(--sel)]">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-lg" title={g.nome}>{g.nome}</span>
                    {contador && <span className="shrink-0 text-xs text-[var(--aviso)]" aria-label={`${g.resumo.prontos} de ${g.resumo.total} prontos`}>{contador}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--texto-suave)]" title={g.baralho}>{g.baralho}</span>
                </button>
                <span className="my-2 w-px bg-[var(--divisor)]" aria-hidden />
                {fin ? (
                  <button
                    type="button"
                    className="flex w-16 items-center justify-center text-[var(--acento)] hover:bg-[var(--sel)] disabled:opacity-50"
                    aria-label={`Baixar .apkg de ${g.nome}`}
                    title="Exportar .apkg"
                    disabled={exportando === g.id}
                    onClick={() => exportar(g)}
                  >
                    <IconeBaixar width={30} height={30} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-16 items-center justify-center text-[var(--acento)] hover:bg-[var(--sel)]"
                    aria-label={`Adicionar cartão em ${g.nome}`}
                    title="Adicionar cartão"
                    onClick={() => setCartaoEm(g.id)}
                  >
                    <IconeMais width={30} height={30} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </main>

      <button type="button" className="fab" style={{ background: 'var(--fab)' }} aria-label="Criar grupo" onClick={() => setNovoGrupo(true)}>
        <IconeMais width={28} height={28} />
      </button>

      {novoGrupo && <ModalGrupo aoFechar={() => setNovoGrupo(false)} aoCriado={(g) => avisar(`Grupo "${g.nome}" criado.`, { tipo: 'ok' })} />}
      {cartaoEm && <ModalCartao grupoId={cartaoEm} aoFechar={() => setCartaoEm(null)} aoSalvo={() => avisar('Cartão adicionado ao grupo.', { tipo: 'ok' })} />}
    </>
  );
}
