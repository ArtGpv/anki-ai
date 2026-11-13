# Instalação (Fase 1, parte 1)

```bash
npm install dexie
npm install -D vitest fake-indexeddb typescript
npx vitest run src/db
```

Copie `src/db/` para o projeto Vite (React + TS). `tsconfig`: `"target": "ES2022"` ou superior (usa `Array.prototype.at`).
