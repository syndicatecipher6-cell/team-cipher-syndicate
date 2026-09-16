import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "NexusNet Criminal Intelligence Backend"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Neo4j Settings
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password")
    
    # Supabase Settings
    SUPABASE_URL: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co")
    SUPABASE_KEY: str = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder")
    
    # Model & Retrieval Settings
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")

settings = Settings()
