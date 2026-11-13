import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { MODELOS_SUGERIDOS } from '../../ia';
import { chaveApi, chaveTavily, lerConfiguracoes, lerUsoDoDia, lerUsoTavily, salvarConfiguracoes, type Tema } from '../../services';
import { Confirmacao } from '../componentes/Confirmacao';
import { IconeVoltar } from '../componentes/Icones';
import { Topbar } from '../componentes/Topbar';
import { ir } from '../rota';
import { useToast } from '../toast';
import { mensagemDeErro } from '../util';

const OUTRO = '__outro__';
const eSugerido = (m: string) => (MODELOS_SUGERIDOS as readonly string[]).includes(m);

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--borda)] bg-[var(--card)] p-4">
      <h2 className="mb-3 text-sm font-medium">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Configuracoes() {
  const cfg = useLiveQuery(lerConfiguracoes, []);
  const mascarada = useLiveQuery(() => chaveApi.mascarada(), []);
  const uso = useLiveQuery(lerUsoDoDia, []);
  const mascaradaTavily = useLiveQuery(() => chaveTavily.mascarada(), []);
  const usoTavily = useLiveQuery(lerUsoTavily, []);
  const { avisar } = useToast();
  const id = useId();

  const [chave, setChave] = useState('');
  const [removerChave, setRemoverChave] = useState(false);
  const [form, setForm] = useState<{ modelo: string; pausa: string; limite: string } | null>(null);
  /** true = caixa seletora em "Outro…" (digitar o código manualmente). */
  const [outro, setOutro] = useState(false);
  const [chaveT, setChaveT] = useState('');
  const [removerChaveT, setRemoverChaveT] = useState(false);
  /** Texto do campo "Limite mensal"; null até as configurações carregarem. */
  const [limiteT, setLimiteT] = useState<string | null>(null);

  useEffect(() => {
    if (cfg && !form) {
      setForm({ modelo: cfg.modelo, pausa: String(cfg.pausaSegundos), limite: String(cfg.limiteDiario) });
      setOutro(!eSugerido(cfg.modelo));
    }
  }, [cfg, form]);

  useEffect(() => {
    if (cfg && limiteT === null) setLimiteT(String(cfg.limiteMensalTavily));
  }, [cfg, limiteT]);

  async function guardarChave(ev: FormEvent) {
    ev.preventDefault();
    try {
      await chaveApi.definir(chave);
      setChave('');
      avisar('Chave salva neste aparelho.', { tipo: 'ok' });
    } catch (e) {
      avisar(mensagemDeErro(e), { tipo: 'erro' });
    }
  }

  async function guardarChaveTavily(ev: FormEvent) {
    ev.preventDefault();
    try {
      await chaveTavily.definir(chaveT);
      setChaveT('');
      avisar('Chave da Tavily salva neste aparelho.', { tipo: 'ok' });
    } catch (e) {
      avisar(mensagemDeErro(e), { tipo: 'erro' });
    }
  }

  async function guardarLimiteTavily(ev: FormEvent) {
    ev.preventDefault();
    try {
      await salvarConfiguracoes({ limiteMensalTavily: Number(limiteT) });
      avisar('Limite mensal da Tavily salvo.', { tipo: 'ok' });
    } catch (e) {
      avisar(mensagemDeErro(e), { tipo: 'erro' });
    }
  }

  async function guardarIA(ev: FormEvent) {
    ev.preventDefault();
    if (!form) return;
    try {
      await salvarConfiguracoes({ modelo: form.modelo, pausaSegundos: Number.parseFloat(form.pausa), limiteDiario: Number(form.limite) });
      avisar('Configurações salvas.', { tipo: 'ok' });
    } catch (e) {
      avisar(mensagemDeErro(e), { tipo: 'erro' });
    }
  }

  async function salvarAgora(mudanca: Parameters<typeof salvarConfiguracoes>[0]) {
    try {
      await salvarConfiguracoes(mudanca);
    } catch (e) {
      avisar(mensagemDeErro(e), { tipo: 'erro' });
    }
  }

  function escolherModelo(valor: string) {
    if (!form) return;
    if (valor === OUTRO) {
      setOutro(true);
      setForm({ ...form, modelo: eSugerido(form.modelo) ? '' : form.modelo });
    } else {
      setOutro(false);
      setForm({ ...form, modelo: valor });
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Topbar
        esquerda={<button type="button" className="icone-btn" aria-label="Voltar" onClick={() => ir('/')}><IconeVoltar /></button>}
        titulo="Configurações"
      />
      <main className="rolagem min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-24">
        <div className="mx-auto max-w-xl space-y-4">
          <Secao titulo="Chave da API do Gemini">
            <p className="text-sm">
              {mascarada ? <>Chave salva: <code className="font-mono">{mascarada}</code></> : 'Nenhuma chave salva.'}
            </p>
            <form onSubmit={guardarChave} className="space-y-2">
              <label htmlFor={`${id}-chave`} className="rotulo">{mascarada ? 'Alterar chave' : 'Adicionar chave'}</label>
              <input id={`${id}-chave`} className="campo font-mono" type="password" autoComplete="off" spellCheck={false} value={chave} onChange={(e) => setChave(e.target.value)} placeholder="Cole a chave aqui" />
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primario" disabled={!chave.trim()}>{mascarada ? 'Alterar' : 'Salvar'}</button>
                {mascarada && <button type="button" className="btn btn-perigo" onClick={() => setRemoverChave(true)}>Remover chave</button>}
              </div>
            </form>
            <p className="text-xs text-[var(--texto-suave)]">A chave fica só no IndexedDB deste aparelho, sem cifra, e nunca no código do app.</p>
          </Secao>

          <Secao titulo="IA e fila de envio">
            {form && (
              <form onSubmit={guardarIA} className="space-y-3">
                <div>
                  <label htmlFor={`${id}-modelo`} className="rotulo">Modelo de IA</label>
                  <select id={`${id}-modelo`} className="campo" value={outro ? OUTRO : form.modelo} onChange={(e) => escolherModelo(e.target.value)}>
                    {MODELOS_SUGERIDOS.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value={OUTRO}>Outro (digitar manualmente)…</option>
                  </select>
                  {outro && (
                    <input
                      className="campo mt-2 font-mono"
                      aria-label="Código do modelo"
                      autoFocus
                      spellCheck={false}
                      autoCapitalize="none"
                      value={form.modelo}
                      onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                      placeholder="gemini-3.5-flash"
                    />
                  )}
                  <p className="mt-1 text-xs text-[var(--texto-suave)]">
                    Use o código do modelo (minúsculas, com hífens), não o nome de exibição. Confira no AI Studio quais estão gratuitos.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`${id}-pausa`} className="rotulo">Pausa entre cartões (s)</label>
                    <input id={`${id}-pausa`} className="campo" inputMode="decimal" value={form.pausa} onChange={(e) => setForm({ ...form, pausa: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`${id}-limite`} className="rotulo">Limite diário de requisições</label>
                    <input id={`${id}-limite`} className="campo" inputMode="numeric" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
                  </div>
                </div>
                <p className="text-sm">
                  Requisições hoje: <strong>{uso ? `${uso.total} / ${uso.limite}` : '…'}</strong>
                  <span className="block text-xs text-[var(--texto-suave)]">O dia zera à meia-noite do horário do Pacífico, como a cota do Gemini.</span>
                </p>
                <button type="submit" className="btn btn-primario">Salvar</button>
              </form>
            )}
          </Secao>

          <Secao titulo="Pesquisa na web">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={cfg?.buscaWeb ?? false}
                disabled={!cfg}
                onChange={(e) => salvarAgora({ buscaWeb: e.target.checked })}
              />
              <span className="text-sm">
                Pesquisar na web ao gerar cartões
                <span className="mt-1 block text-xs text-[var(--texto-suave)]">
                  Desligado por padrão. Usa a Tavily e exige a chave da Tavily (seção abaixo): o Gemini gera uma consulta, a Tavily
                  busca e os cartões ganham fontes. Em grupos com arquivos anexados, a busca é sempre básica e só complementa os arquivos.
                </span>
              </span>
            </label>
            {cfg?.buscaWeb && mascaradaTavily === null && (
              <p role="alert" className="rounded-md bg-[var(--perigo-fundo)] px-3 py-2 text-xs text-[var(--perigo)]">
                A pesquisa está ligada, mas falta a chave da Tavily. Informe-a abaixo ou desligue a pesquisa.
              </p>
            )}
          </Secao>

          <Secao titulo="Chave da API da Tavily">
            <p className="text-sm">
              {mascaradaTavily ? <>Chave salva: <code className="font-mono">{mascaradaTavily}</code></> : 'Nenhuma chave da Tavily salva.'}
            </p>
            <form onSubmit={guardarChaveTavily} className="space-y-2">
              <label htmlFor={`${id}-chavet`} className="rotulo">{mascaradaTavily ? 'Alterar chave da Tavily' : 'Adicionar chave da Tavily'}</label>
              <input id={`${id}-chavet`} className="campo font-mono" type="password" autoComplete="off" spellCheck={false} value={chaveT} onChange={(e) => setChaveT(e.target.value)} placeholder="Cole a chave aqui (tvly-…)" />
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primario" disabled={!chaveT.trim()}>{mascaradaTavily ? 'Alterar chave da Tavily' : 'Salvar chave da Tavily'}</button>
                {mascaradaTavily && <button type="button" className="btn btn-perigo" onClick={() => setRemoverChaveT(true)}>Remover chave da Tavily</button>}
              </div>
            </form>
            <p className="text-xs text-[var(--texto-suave)]">A chave fica só no IndexedDB deste aparelho, sem cifra, e nunca no código do app.</p>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={cfg?.tavilyAvancado ?? false}
                disabled={!cfg}
                onChange={(e) => salvarAgora({ tavilyAvancado: e.target.checked })}
              />
              <span className="text-sm">
                Usar pesquisa avançada
                <span className="mt-1 block text-xs text-[var(--texto-suave)]">
                  Pesquisa com mais profundidade e gasta mais créditos por busca (2 em vez de 1). Com arquivos anexados ao grupo, a busca continua básica.
                </span>
              </span>
            </label>

            <p className="text-sm">
              Créditos estimados no mês: <strong>{usoTavily ? `${usoTavily.creditos} / ${usoTavily.limite}` : '…'}</strong>
              <span className="block text-xs text-[var(--texto-suave)]">
                {usoTavily ? `${usoTavily.buscas} busca(s) neste mês. ` : ''}
                Contagem local e aproximada (a oficial fica no painel da Tavily); zera na virada do mês (UTC).
              </span>
            </p>
            {limiteT !== null && (
              <form onSubmit={guardarLimiteTavily} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor={`${id}-limitet`} className="rotulo">Limite mensal de créditos</label>
                  <input id={`${id}-limitet`} className="campo" inputMode="numeric" value={limiteT} onChange={(e) => setLimiteT(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primario">Salvar limite</button>
              </form>
            )}
          </Secao>

          <Secao titulo="Aparência">
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--campo)] p-1">
              {(['claro', 'escuro', 'sistema'] as const satisfies readonly Tema[]).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={cfg?.tema === t} onClick={() => salvarAgora({ tema: t })}
                  className={`rounded-md px-3 py-2 text-sm capitalize ${cfg?.tema === t ? 'bg-[var(--botao)] font-medium text-[var(--botao-texto)]' : 'text-[var(--texto-suave)]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Secao>

          <Secao titulo="Aviso de privacidade">
            <p className="text-sm leading-relaxed">
              No nível gratuito da API do Gemini, o Google pode usar o conteúdo enviado (inclusive arquivos anexados) para melhorar seus
              produtos. Evite enviar dados pessoais ou confidenciais.
            </p>
            <p className="text-sm leading-relaxed">
              Ao ativar a pesquisa na web, o app envia à Tavily, serviço de terceiros, uma consulta gerada pelo Gemini a partir do texto que
              você escreveu; ela pode conter trechos dele. Arquivos anexados não são enviados à Tavily, apenas ao Gemini. A Tavily tem termos e
              política de privacidade próprios. Evite incluir dados pessoais ou confidenciais nos seus textos.
            </p>
            <p className="text-xs text-[var(--texto-suave)]">
              Confira o texto atual dos termos:{' '}
              <a className="text-[var(--acento)] underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer noopener">termos da API Gemini</a>
              {' · '}
              <a className="text-[var(--acento)] underline" href="https://www.tavily.com/privacy" target="_blank" rel="noreferrer noopener">política de privacidade da Tavily</a>.
            </p>
          </Secao>
        </div>
      </main>

      {removerChaveT && (
        <Confirmacao
          titulo="Remover chave da Tavily"
          perigo
          rotuloConfirmar="Remover"
          mensagem="Remover a chave da Tavily deste aparelho? A pesquisa na web não funcionará até você informá-la de novo."
          aoCancelar={() => setRemoverChaveT(false)}
          aoConfirmar={async () => {
            await chaveTavily.remover();
            setRemoverChaveT(false);
            avisar('Chave da Tavily removida.');
          }}
        />
      )}
      {removerChave && (
        <Confirmacao
          titulo="Remover chave"
          perigo
          rotuloConfirmar="Remover"
          mensagem="Remover a chave da API deste aparelho? Você precisará informá-la de novo para gerar cartões."
          aoCancelar={() => setRemoverChave(false)}
          aoConfirmar={async () => {
            await chaveApi.remover();
            setRemoverChave(false);
            avisar('Chave removida.');
          }}
        />
      )}
    </div>
  );
}
