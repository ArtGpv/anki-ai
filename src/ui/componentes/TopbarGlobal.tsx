import { useState } from 'react';
import { filtroTags, useFiltroTags } from '../filtro';
import { CONFIG_BARALHOS, CONFIG_TAGS, ModalArvore } from '../modais/ModalArvore';
import { ir } from '../rota';
import { useToast } from '../toast';
import { Drawer, type ItemDrawer } from './Drawer';
import { IconeEngrenagem, IconeMenu } from './Icones';
import { Topbar } from './Topbar';

/** Topbar global: hambúrguer (Drawer → modais de Baralhos/Tags) e engrenagem (Configurações). */
export function TopbarGlobal() {
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<ItemDrawer | null>(null);
  const filtro = useFiltroTags();
  const { avisar } = useToast();

  return (
    <>
      <Topbar
        esquerda={<button type="button" className="icone-btn" aria-label="Abrir menu" onClick={() => setDrawer(true)}><IconeMenu /></button>}
        titulo="Cartões Anki"
        direita={<button type="button" className="icone-btn" aria-label="Configurações" onClick={() => ir('/config')}><IconeEngrenagem /></button>}
      />
      {drawer && <Drawer aoFechar={() => setDrawer(false)} aoEscolher={(i) => { setDrawer(false); setModal(i); }} />}
      {modal === 'tags' && (
        <ModalArvore
          config={CONFIG_TAGS}
          inicial={filtro}
          aoCancelar={() => setModal(null)}
          aoConfirmar={(sel) => {
            filtroTags.definir(sel);
            setModal(null);
            avisar(sel.length ? 'Filtro de tags aplicado à lista de cartões.' : 'Filtro de tags removido.');
          }}
        />
      )}
      {modal === 'baralhos' && (
        <ModalArvore config={CONFIG_BARALHOS} inicial={[]} aoCancelar={() => setModal(null)} aoConfirmar={() => setModal(null)} />
      )}
    </>
  );
}
