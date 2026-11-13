import { useEffect } from 'react';
import { registrarServiceWorker } from '../pwa';
import { recuperarEnviosInterrompidos } from '../services';
import { iniciarPython } from './python';
import { useCaminho } from './rota';
import { Configuracoes } from './telas/Configuracoes';
import { Dashboard } from './telas/Dashboard';
import { TelaGrupo } from './telas/TelaGrupo';
import { useTemaGlobal } from './tema';
import { ProvedorToast } from './toast';
import './ui.css';

export default function App() {
  const caminho = useCaminho();
  useTemaGlobal();

  useEffect(() => {
    // Cartões que ficaram "enviando" porque a página fechou viram "erro" (com "Tentar de novo").
    recuperarEnviosInterrompidos().catch(() => {});
    // Começa a carregar o Pyodide já na abertura: a exportação fica pronta mais cedo.
    iniciarPython().catch(() => {});
    // PWA: cache offline do app, do Pyodide e do MathJax (só em produção).
    registrarServiceWorker();
  }, []);

  const grupo = /^\/grupo\/([^/]+)$/.exec(caminho);
  return (
    <ProvedorToast>
      <div className="mx-auto flex h-dvh w-full max-w-6xl flex-col bg-[var(--fundo)] text-[var(--texto)]">
        {grupo ? <TelaGrupo key={grupo[1]} id={grupo[1]} /> : caminho === '/config' ? <Configuracoes /> : <Dashboard />}
      </div>
    </ProvedorToast>
  );
}
