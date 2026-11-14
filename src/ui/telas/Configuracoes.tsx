import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
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

/** Áreas da tela, na ordem em que aparecem. A barra de atalhos usa esta lista. */
const AREAS = [
  { id: 'cfg-gemini', rotulo: 'Gemini' },
  { id: 'cfg-pesquisa', rotulo: 'Pesquisa' },
  { id: 'cfg-aparencia', rotulo: 'Aparência' },
  { id: 'cfg-privacidade', rotulo: 'Privacidade' },
] as const;

/** Uma área da tela (título + descrição + vários cartões). */
function Grupo({ id, titulo, descricao, children }: { id: string; titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section id={id} data-area className="cfg-grupo" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="cfg-grupo-titulo">{titulo}</h2>
      <p className="cfg-grupo-desc">{descricao}</p>
      <div className="cfg-grupo-corpo">{children}</div>
    </section>
  );
}

/** Cartão dentro de uma área. */
function Secao({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--borda)] bg-[var(--card)] p-4">
      {titulo && <h3 className="mb-3 text-sm font-medium">{titulo}</h3>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Barra({ valor, max }: { valor: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  return (
    <div className="cfg-barra" role="presentation" data-alto={pct >= 90}>
      <span style={{ width: `${pct}%` }} />
    </div>
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
  const corpo = useRef<HTMLElement>(null);

  const [chave, setChave] = useState('');
  const [removerChave, setRemoverChave] = useState(false);
  const [form, setForm] = useState<{ modelo: string; pausa: string; limite: string } | null>(null);
  /** true = caixa seletora em "Outro…" (digitar o código manualmente). */
  const [outro, setOutro] = useState(false);
  const [chaveT, setChaveT] = useState('');
  const [removerChaveT, setRemoverChaveT] = useState(false);
  /** Texto do campo "Limite mensal"; null até as configurações carregarem. */
  const [limiteT, setLimiteT] = useState<string | null>(null);
  /** Área em destaque na barra de atalhos (acompanha a rolagem). */
  const [areaAtual, setAreaAtual] = useState<string>(AREAS[0].id);

  useEffect(() => {
    if (cfg && !form) {
      setForm({ modelo: cfg.modelo, pausa: String(cfg.pausaSegundos), limite: String(cfg.limiteDiario) });
      setOutro(!eSugerido(cfg.modelo));
    }
  }, [cfg, form]);

  useEffect(() => {
    if (cfg && limiteT === null) setLimiteT(String(cfg.limiteMensalTavily));
  }, [cfg, limiteT]);

  // Destaca na barra a área que está no topo da região rolável.
  useEffect(() => {
    const raiz = corpo.current;
    if (!raiz || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAreaAtual(visivel.target.id);
      },
      { root: raiz, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    );
    raiz.querySelectorAll('[data-area]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [cfg]);

  function irPara(areaId: string) {
    setAreaAtual(areaId);
    document.getElementById(areaId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
    <>
      <Topbar
        esquerda={<button type="button" className="icone-btn" aria-label="Voltar" onClick={() => ir('/')}><IconeVoltar /></button>}
        titulo="Configurações"
      />

      <nav className="cfg-nav" aria-label="Áreas das configurações">
        {AREAS.map((a) => (
          <button key={a.id} type="button" className="cfg-chip" aria-current={areaAtual === a.id} onClick={() => irPara(a.id)}>
            {a.rotulo}
          </button>
        ))}
      </nav>

      {/* A rolagem é só desta região; .tela-corpo (ui.css) garante flex:1 + min-height:0 + overflow-y:auto no celular. */}
      <main ref={corpo} className="tela-corpo px-4 py-4 pb-24">
        <div className="mx-auto max-w-xl">
          <Grupo id="cfg-gemini" titulo="Gemini" descricao="A IA que escreve os cartões: chave de acesso, modelo e ritmo de envio.">
            <Secao titulo="Chave da API">
              <p className="text-sm">
                {mascarada ? <>Chave salva: <code className="font-mono">{mascarada}</code></> : 'Nenhuma chave salva.'}
              </p>
              <form onSubmit={guardarChave} className="space-y-2">
                <label htmlFor={`${id}-chave`} className="rotulo">{mascarada ? 'Alterar chave' : 'Adicionar chave'}</label>
                <input id={`${id}-chave`} className="campo font-mono" type="password" autoComplete="off" spellCheck={false} value={chave} onChange={(e) => setChave(e.target.value)} placeholder="Cole a chave aqui" />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-primario" disabled={!chave.trim()}>{mascarada ? 'Alterar' : 'Salvar'}</button>
                  {mascarada && <button type="button" className="btn btn-perigo" onClick={() => setRemoverChave(true)}>Remover chave</button>}
                </div>
              </form>
              <p className="text-xs text-[var(--texto-suave)]">A chave fica só no IndexedDB deste aparelho, sem cifra, e nunca no código do app.</p>
            </Secao>

            <Secao titulo="Modelo e fila de envio">
              {form ? (
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
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                    <div>
                      <label htmlFor={`${id}-pausa`} className="rotulo">Pausa entre cartões (s)</label>
                      <input id={`${id}-pausa`} className="campo" inputMode="decimal" value={form.pausa} onChange={(e) => setForm({ ...form, pausa: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor={`${id}-limite`} className="rotulo">Limite diário de requisições</label>
                      <input id={`${id}-limite`} className="campo" inputMode="numeric" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primario">Salvar</button>
                </form>
              ) : (
                <p className="text-sm text-[var(--texto-suave)]">Carregando…</p>
              )}
            </Secao>

            <Secao titulo="Uso hoje">
              <p className="text-sm">
                Requisições: <strong>{uso ? `${uso.total} / ${uso.limite}` : '…'}</strong>
              </p>
              {uso && <Barra valor={uso.total} max={uso.limite} />}
              <p className="text-xs text-[var(--texto-suave)]">O dia zera à meia-noite do horário do Pacífico, como a cota do Gemini.</p>
            </Secao>
          </Grupo>

          <Grupo id="cfg-pesquisa" titulo="Pesquisa na web" descricao="Opcional. A Tavily busca fontes para o Gemini usar ao escrever os cartões.">
            <Secao>
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
                    Desligado por padrão. O Gemini gera uma consulta, a Tavily busca e os cartões ganham fontes. Exige a chave da Tavily (abaixo).
                    Em grupos com arquivos anexados, a busca é sempre básica e só complementa os arquivos.
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
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-primario" disabled={!chaveT.trim()}>{mascaradaTavily ? 'Alterar chave da Tavily' : 'Salvar chave da Tavily'}</button>
                  {mascaradaTavily && <button type="button" className="btn btn-perigo" onClick={() => setRemoverChaveT(true)}>Remover chave da Tavily</button>}
                </div>
              </form>
              <p className="text-xs text-[var(--texto-suave)]">A chave fica só no IndexedDB deste aparelho, sem cifra, e nunca no código do app.</p>
            </Secao>

            <Secao titulo="Profundidade e créditos">
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

              <div className="space-y-2 border-t border-[var(--divisor)] pt-3">
                <p className="text-sm">
                  Créditos estimados no mês: <strong>{usoTavily ? `${usoTavily.creditos} / ${usoTavily.limite}` : '…'}</strong>
                </p>
                {usoTavily && <Barra valor={usoTavily.creditos} max={usoTavily.limite} />}
                <p className="text-xs text-[var(--texto-suave)]">
                  {usoTavily ? `${usoTavily.buscas} busca(s) neste mês. ` : ''}
                  Contagem local e aproximada (a oficial fica no painel da Tavily); zera na virada do mês (UTC).
                </p>
              </div>

              {limiteT !== null && (
                <form onSubmit={guardarLimiteTavily} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[10rem] flex-1">
                    <label htmlFor={`${id}-limitet`} className="rotulo">Limite mensal de créditos</label>
                    <input id={`${id}-limitet`} className="campo" inputMode="numeric" value={limiteT} onChange={(e) => setLimiteT(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primario">Salvar limite</button>
                </form>
              )}
            </Secao>
          </Grupo>

          <Grupo id="cfg-aparencia" titulo="Aparência" descricao="Como o app se apresenta neste aparelho.">
            <Secao titulo="Tema">
              <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--campo)] p-1">
                {(['claro', 'escuro', 'sistema'] as const satisfies readonly Tema[]).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={cfg?.tema === t} onClick={() => salvarAgora({ tema: t })}
                    className={`rounded-md px-3 py-2 text-sm capitalize ${cfg?.tema === t ? 'bg-[var(--botao)] font-medium text-[var(--botao-texto)]' : 'text-[var(--texto-suave)]'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </Secao>
          </Grupo>

          <Grupo id="cfg-privacidade" titulo="Privacidade" descricao="O que sai do seu aparelho e para onde vai.">
            <Secao titulo="Gemini (Google)">
              <p className="text-sm leading-relaxed">
                No nível gratuito da API do Gemini, o Google pode usar o conteúdo enviado (inclusive arquivos anexados) para melhorar seus
                produtos. Evite enviar dados pessoais ou confidenciais.
              </p>
              <a className="inline-block text-xs text-[var(--acento)] underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer noopener">Termos da API Gemini</a>
            </Secao>
            <Secao titulo="Tavily (pesquisa na web)">
              <p className="text-sm leading-relaxed">
                Ao ativar a pesquisa na web, o app envia à Tavily, serviço de terceiros, uma consulta gerada pelo Gemini a partir do texto que
                você escreveu; ela pode conter trechos dele. Arquivos anexados não são enviados à Tavily, apenas ao Gemini. A Tavily tem termos e
                política de privacidade próprios. Evite incluir dados pessoais ou confidenciais nos seus textos.
              </p>
              <a className="inline-block text-xs text-[var(--acento)] underline" href="https://www.tavily.com/privacy" target="_blank" rel="noreferrer noopener">Política de privacidade da Tavily</a>
            </Secao>
          </Grupo>
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
    </>
  );
}
