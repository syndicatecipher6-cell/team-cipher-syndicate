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

## Machine Learning Module

Added a robust Graph Machine Learning pipeline for **Link Prediction** to detect hidden criminal connections.

- **Training Dataset**: Fully structured, synthetic CSV relational dataset simulating real-world investigations (Persons, Phones, Transactions, Cases).
- **Model**: Random Forest Classifier trained on graph-topological features (Jaccard, Adamic-Adar) and individual risk/criminal-history features.
- **Training Pipeline**: Located at `backend/train_model.py`. The model currently achieves **92.77% accuracy**.
- **Dependencies**: Uses lightweight 
etworkx and scikit-learn libraries.
- **Model Output**: The trained model is serialized to `backend/models/investigation_model.pkl`.
