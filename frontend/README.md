# frontend

SPA del dashboard — Vue 3 + TypeScript + Vite + TailwindCSS 4.

Documentación completa (arquitectura, API, usuarios de prueba): ver
[README raíz](../README.md).

## Setup

IDE: [VS Code](https://code.visualstudio.com/) + extensión
[Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
(deshabilitar Vetur). El type-checking de `.vue` usa `vue-tsc`.

```sh
pnpm install
pnpm dev               # servidor de desarrollo (proxy /api → 127.0.0.1:3000)
pnpm build             # type-check + build de producción
pnpm test:run          # tests unitarios (Vitest + jsdom)
pnpm test:coverage     # tests con thresholds de cobertura (80%)
pnpm check:lint        # oxlint + eslint
pnpm type-check        # vue-tsc
pnpm format:check      # prettier
```
