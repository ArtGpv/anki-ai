import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = {
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const;

export const IconeMenu = (p: P) => <svg {...base} {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export const IconeEngrenagem = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
);
export const IconeMais = (p: P) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconeBaixar = (p: P) => <svg {...base} {...p}><path d="M12 4v12M6 11l6 6 6-6M5 21h14" /></svg>;
export const IconeVoltar = (p: P) => <svg {...base} {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
export const IconeLupa = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
export const IconeLixeira = (p: P) => <svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>;
export const IconeGrampo = (p: P) => <svg {...base} {...p}><path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-2-2l8-8" /></svg>;
export const IconeLapis = (p: P) => <svg {...base} {...p}><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" /></svg>;
export const IconeRegerar = (p: P) => <svg {...base} {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>;
export const IconeOlho = (p: P) => <svg {...base} {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const IconeFechar = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconeSeta = (p: P) => <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>;
