# NexusNet Intelligence

Production-oriented frontend prototype for SIH26189: an evidence-first, graph-centric investigation workspace that connects fragmented records without making legal conclusions.

## Run locally

```bash
pnpm install
pnpm dev
```

The default is coherent mock-data mode. Copy `.env.example` to `.env` only when you need different configuration. Do not disable mock mode until the proposed contract in `FRONTEND_BACKEND_INTEGRATION.md` has been confirmed with the backend team.

## Validate

```bash
pnpm typecheck
pnpm lint
pnpm build
```
