import Dexie, { type Table } from 'dexie';
import type { Arquivo, Baralho, Cartao, Grupo, ItemConfig, Tag } from './tipos';

export class AnkiDB extends Dexie {
  grupos!: Table<Grupo, string>;
  cartoes!: Table<Cartao, string>;
  baralhos!: Table<Baralho, string>;
  tags!: Table<Tag, string>;
  arquivos!: Table<Arquivo, string>;
  config!: Table<ItemConfig, string>;

  constructor(nome = 'gerador-anki') {
    super(nome);
    // Só os campos indexados entram aqui; os demais são gravados normalmente.
    this.version(1).stores({
      grupos: 'id, baralho, criadoEm',
      cartoes: 'id, grupoId, estado, criadoEm, *tags',
      baralhos: 'caminho, criadoEm',
      tags: 'caminho, criadoEm',
      arquivos: 'id, grupoId',
      config: 'chave',
    });
  }
}

export const db = new AnkiDB();
export const novoId = (): string => crypto.randomUUID();
