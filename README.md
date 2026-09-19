# NexusNet Intelligence

NexusNet Intelligence is an **evidence-first, graph-centric investigation platform** that connects fragmented records into a unified investigative network. It combines **knowledge graphs, relationship analysis, Investigation AI, and a secure sandbox** to help investigators trace entities, uncover connections, analyse evidence, and explore what-if scenarios through a single intelligent workspace.

The platform transforms disconnected records into **connected, explainable, and actionable investigative intelligence**, while keeping every conclusion grounded in available evidence.

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

The Investigation AI **understands the investigator’s natural-language query, plans the required graph and evidence retrieval, fetches relevant FIR and case evidence, enriches it with knowledge-graph relationships, and reranks the retrieved evidence for relevance**. It then identifies supporting and conflicting evidence and produces a **grounded, cited response** with each finding classified as **Verified Fact, Corroborated, Inferred, or Unresolved**.

The LLM serves primarily as the **natural-language understanding and explanation layer**. Database access, query validation, evidence retrieval, and record modification are controlled by the backend, ensuring that the model cannot directly execute unrestricted database operations or modify production records.

Gemini is the only configured cloud provider. Add a server-side key to `.env` when ready:

```dotenv
GEMINI_API_KEY=your_key_here
ALLOW_CLOUD_FIR_PROCESSING=true
```

`ALLOW_CLOUD_FIR_PROCESSING` is intentionally `false` by default. Keep it disabled for sensitive FIRs unless the deployment and data-handling policy explicitly permits sending the selected evidence context to Gemini. Without a key or cloud permission, NexusNet uses its deterministic grounded response and still supplies citations.

Optional local GLiNER, embedding, and cross-encoder support is isolated in `backend/requirements-llm.txt`. It is disabled by default to avoid automatic model downloads; enable it with `ENABLE_LOCAL_TRANSFORMERS=true` only after installing that requirements file.

## Investigation Sandbox

The Investigation Sandbox creates a **safe what-if environment** using the base case and an **ordered modification log**, instead of duplicating the production database. Investigators can simulate changes such as **merging identities, adding or removing relationships, disputing evidence, splitting entities, or modifying timelines**.

After each change, the system **recalculates affected graph relationships, metrics, and LPI**, and clearly shows **how the connections and investigation picture change**. Every output is labelled **HYPOTHETICAL / SANDBOX**, and all modifications remain isolated from the production graph.

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

### FIR extraction training

The trained FIR model classifies crime types and person roles while the hybrid extractor validates deterministic identifiers such as phones, vehicles, accounts, and transaction amounts. Training automatically adds a balanced 480-row narrative corpus covering varied suspect, witness, complainant, officer, victim, and person-of-interest wording; validation and test templates are kept separate from its training templates.

```bash
npm run train:fir -- path/to/indian_fir_dataset.csv
backend/.venv/Scripts/python backend/evaluate_fir_extractor.py path/to/indian_fir_dataset.csv --split test
```

The generated `backend/models/fir_extractor_model.json` is loaded automatically by the FastAPI ingestion service. Reported metrics are synthetic-dataset results and must not be treated as a production benchmark.

### OWASP-aligned API hardening

Both the full FastAPI service and the deployed Vercel function enforce allow-listed upload extensions and media types, safe filenames, UTF-8 text validation, PDF signatures, configurable file/count limits, per-client abuse throttling, trusted hosts, restricted CORS, disabled production API documentation, no-store caching, and security response headers. Configure the limits and deployment hosts with the variables documented in `.env.example`. These controls are a security baseline and do not replace production identity enforcement, edge rate limiting, dependency scanning, or a formal security assessment.
