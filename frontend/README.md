# AutoCircuitGNN Frontend

This is the Next.js frontend for the AutoCircuitGNN platform.

## Features

- **SSO Login Simulation**: A futuristic login screen (Mock User: Dr. Alex Chen).
- **Project Dashboard**: View project stats, active datasets, and model status.
- **Upload Data**: Parse and ingest .DEF/.LEF/GraphML files (Mock ingestion).
- **Graph Explorer**: Deep dive into circuit topology, node classification, and timing violations with interactive charts.
- **Auto GNN Training**: Simulate Neural Architecture Search (NAS) for circuit property prediction.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Design System

- **Glassmorphism**: Heavy use of backdrop-blur and semi-transparent backgrounds.
- **Theme**: Dark mode default with Neon Cyan (#06b6d4) and Violet (#8b5cf6) accents.
- **Components**: Material UI (MUI) v5 + Framer Motion.
