# NexusNet Intelligence

Production-oriented frontend prototype for SIH26189: an evidence-first, graph-centric investigation workspace that connects fragmented records without making legal conclusions.

## Run locally

```bash
pnpm install
pnpm dev
```

In a second terminal, start the API:

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python run.py
```

Copy `.env.example` to `.env` for local configuration. The application retains its existing resilient frontend fallback when the API is unavailable.

## Grounded AI Investigator

The Investigation AI now plans a query, retrieves FIR evidence, adds graph context, reranks results, reports contradictions, and produces cited findings labelled **Verified Fact**, **Corroborated**, **Inferred**, or **Unresolved**. The language model is an explanation layer only: it has no database credentials, cannot execute unrestricted Cypher, and cannot modify production records.

Gemini is the only configured cloud provider. Add a server-side key to `.env` when ready:

```dotenv
GEMINI_API_KEY=your_key_here
ALLOW_CLOUD_FIR_PROCESSING=true
```

`ALLOW_CLOUD_FIR_PROCESSING` is intentionally `false` by default. Keep it disabled for sensitive FIRs unless the deployment and data-handling policy explicitly permits sending the selected evidence context to Gemini. Without a key or cloud permission, NexusNet uses its deterministic grounded response and still supplies citations.

Optional local GLiNER, embedding, and cross-encoder support is isolated in `backend/requirements-llm.txt`. It is disabled by default to avoid automatic model downloads; enable it with `ENABLE_LOCAL_TRANSFORMERS=true` only after installing that requirements file.

## Investigation Sandbox

The sandbox stores a base case plus an ordered modification log rather than duplicating the database. It supports identity merge, relationship add/remove, evidence dispute, entity split, and timeline change. Every result is labelled **HYPOTHETICAL / SANDBOX**, recalculates graph metrics and LPI, and never writes to the production graph.

## Validate

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Backend checks:

```bash
cd backend
.venv\Scripts\python -m unittest discover -s tests -v
```

## Machine Learning Module

Added a robust Graph Machine Learning pipeline for **Link Prediction** to detect hidden criminal connections.

- **Training Dataset**: Fully structured, synthetic CSV relational dataset simulating real-world investigations (Persons, Phones, Transactions, Cases).
- **Model**: Random Forest Classifier trained on graph-topological features (Jaccard, Adamic-Adar) and individual risk/criminal-history features.
- **Training Pipeline**: Located at `backend/train_model.py`. The model currently achieves **92.77% accuracy**.
- **Dependencies**: Uses lightweight 
etworkx and scikit-learn libraries.
- **Model Output**: The trained model is serialized to `backend/models/investigation_model.pkl`.
