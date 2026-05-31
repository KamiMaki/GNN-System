# GraphX.AI — Frontend

Next.js (App Router) frontend for the **GraphX.AI** GNN AutoML platform. It guides a
user through the 6-step pipeline (Create → Upload → Explore → Train → Evaluate →
Predict) against the FastAPI backend.

> For the full-stack overview, data format, and backend setup see the
> [root README](../README.md) and [`docs/architecture/overview.md`](../docs/architecture/overview.md).

## Tech stack

| Concern | Technology |
|---------|------------|
| Framework | Next.js 16 (App Router), React 19 |
| UI        | Ant Design 5 + custom dark/glass theme (`theme/theme.ts`) |
| Charts    | Recharts |
| Animation | Framer Motion |
| Auth      | NextAuth + Keycloak OIDC (optional; falls back to anonymous in dev) |
| API client| Typed `fetch` wrapper in `lib/api.ts` |
| Tests     | Jest + React Testing Library |

## Development

```bash
npm install
npm run dev          # http://localhost:3000  (expects backend on :8000)
```

Configure the backend URL and (optional) Keycloak via `.env.local` — see
`.env.example` for the supported variables.

## Project layout

```
frontend/
├── app/                      # App Router pages
│   ├── dashboard/            # project list
│   ├── docs/  api-spec/      # in-app docs + API spec viewer
│   └── projects/[id]/        # upload → explore → train → evaluate → predict → models
├── components/               # AppHeader, PipelineStepper, GraphPreview, PredictionTable, …
├── contexts/                 # AuthContext, ColorModeContext, ProjectContext
├── lib/                      # api.ts (typed client), sanitize, progress, mockGraphData (types)
└── theme/                    # Ant Design theme tokens + dark mode
```

## Testing

```bash
npm test                     # Jest + RTL unit/component tests
npm run test:watch           # watch mode
npx tsc --noEmit             # type-check only
npm run lint                 # eslint (flat config: eslint.config.mjs)
```

Tests live next to the code they cover in `__tests__/` folders
(`components/__tests__`, `contexts/__tests__`, `lib/__tests__`, `theme/__tests__`).
