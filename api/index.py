import sys
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware


ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.nlp_extractor import nlp_extractor  # noqa: E402
from app.config import settings  # noqa: E402
from app.hardening import (  # noqa: E402
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    read_validated_uploads,
)


app = FastAPI(
    title="NexusNet FIR Extraction API",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[host.strip() for host in settings.ALLOWED_HOSTS.split(",") if host.strip()])
app.add_middleware(RequestSizeLimitMiddleware, max_request_bytes=settings.MAX_UPLOAD_BYTES + 1024 * 1024)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_window=settings.RATE_LIMIT_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "modelLoaded": nlp_extractor.trained_model is not None,
    }


@app.post("/api/ingest/upload")
async def extract_uploaded_firs(files: List[UploadFile] = File(...)):
    processed = []
    validated_files = await read_validated_uploads(
        files,
        max_files=settings.MAX_UPLOAD_FILES,
        max_total_bytes=settings.MAX_UPLOAD_BYTES,
    )
    for filename, _extension, _content_bytes, content in validated_files:
        processed.append({
            "filename": filename,
            "nodesCreated": 0,
            "edgesCreated": 0,
            "extractedNLP": nlp_extractor.extract_entities(content),
        })

    return {
        "status": "success",
        "processed": processed,
        "totalNodesCreated": 0,
        "totalEdgesCreated": 0,
    }
