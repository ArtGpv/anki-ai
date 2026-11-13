/** Registra o service worker (só em produção). Chamado uma vez ao abrir o app. */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const registrar = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {}); // sem service worker o app funciona igual, só sem cache offline
  };
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}
