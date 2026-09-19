from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.config import settings
from app.hardening import RateLimitMiddleware, RequestSizeLimitMiddleware, SecurityHeadersMiddleware
from app.routers import ingest, investigations, analysis, analytics_routes, federated_routes, sandbox

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Python FastAPI backend for SIH Criminal Network Analysis with Pandas, NumPy, spaCy, Neo4j, BM25/BGE-M3, GraphRAG, Plotly, and Flower/FedProx.",
    docs_url="/docs" if settings.EXPOSE_API_DOCS else None,
    redoc_url="/redoc" if settings.EXPOSE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.EXPOSE_API_DOCS else None,
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=[host.strip() for host in settings.ALLOWED_HOSTS.split(",") if host.strip()])
app.add_middleware(RequestSizeLimitMiddleware, max_request_bytes=settings.MAX_UPLOAD_BYTES + 1024 * 1024)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_window=settings.RATE_LIMIT_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
)

# CORS middleware for explicitly configured frontend origins. Wildcard CORS
# with credentials is intentionally avoided.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-NexusNet-Role", "X-NexusNet-User"],
)
app.add_middleware(SecurityHeadersMiddleware)

# Register API Routers
app.include_router(ingest.router, prefix=settings.API_PREFIX)
app.include_router(investigations.router, prefix=settings.API_PREFIX)
app.include_router(analysis.router, prefix=settings.API_PREFIX)
app.include_router(analytics_routes.router, prefix=settings.API_PREFIX)
app.include_router(federated_routes.router, prefix=settings.API_PREFIX)
app.include_router(sandbox.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs" if settings.EXPOSE_API_DOCS else None,
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
