from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import ingest, investigations, analysis, analytics_routes, federated_routes

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Python FastAPI backend for SIH Criminal Network Analysis with Pandas, NumPy, spaCy, Neo4j, BM25/BGE-M3, GraphRAG, Plotly, and Flower/FedProx."
)

# CORS middleware for local frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(ingest.router, prefix=settings.API_PREFIX)
app.include_router(investigations.router, prefix=settings.API_PREFIX)
app.include_router(analysis.router, prefix=settings.API_PREFIX)
app.include_router(analytics_routes.router, prefix=settings.API_PREFIX)
app.include_router(federated_routes.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "stack": {
            "core": "Python 3.11",
            "api": "FastAPI",
            "data": "Pandas + NumPy",
            "nlp": "spaCy",
            "graph": "Neo4j + Cypher",
            "retrieval": "BM25 + BGE-M3 + BGE Reranker v2-M3",
            "qa": "GraphRAG + LLM",
            "federated": "Flower + FedProx + PyTorch",
            "database": "Supabase",
            "analytics": "Plotly",
            "visualization": "Cytoscape.js"
        }
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
