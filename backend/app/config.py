import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel


# Keep deployment secrets outside source control while allowing the frontend
# and backend to share the repository-root .env during local development.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

class Settings(BaseModel):
    PROJECT_NAME: str = "NexusNet Criminal Intelligence Backend"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Neo4j Settings
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password")
    
    # Supabase Settings
    SUPABASE_URL: str = (
        os.getenv("SUPABASE_URL") or
        os.getenv("NEXT_PUBLIC_SUPABASE_URL") or
        "https://placeholder.supabase.co"
    )
    SUPABASE_KEY: str = (
        os.getenv("SUPABASE_ANON_KEY") or
        os.getenv("SUPABASE_PUBLISHABLE_KEY") or
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
        os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or
        "placeholder"
    )
    
    # The provider is isolated behind an adapter so retrieval, graph analysis,
    # citations, and sandbox logic remain provider-independent.
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-3.7-flash")
    LLM_TIMEOUT_SECONDS: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "90"))
    LLM_ENABLED: bool = os.getenv("LLM_ENABLED", "true").lower() == "true"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ALLOW_CLOUD_FIR_PROCESSING: bool = os.getenv("ALLOW_CLOUD_FIR_PROCESSING", "false").lower() == "true"
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    RERANKER_MODEL: str = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
    GLINER_MODEL: str = os.getenv("GLINER_MODEL", "urchade/gliner_multi-v2.1")
    ENABLE_LOCAL_TRANSFORMERS: bool = os.getenv("ENABLE_LOCAL_TRANSFORMERS", "false").lower() == "true"

    # Access control and feature isolation. Demo mode preserves the existing
    # local workflow; production deployments should set AUTH_MODE=required and
    # place a real identity gateway in front of this API.
    AUTH_MODE: str = os.getenv("AUTH_MODE", "demo")
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    )
    ENABLE_AI_INVESTIGATOR: bool = os.getenv("ENABLE_AI_INVESTIGATOR", "true").lower() == "true"
    ENABLE_INVESTIGATION_SANDBOX: bool = os.getenv("ENABLE_INVESTIGATION_SANDBOX", "true").lower() == "true"

settings = Settings()
