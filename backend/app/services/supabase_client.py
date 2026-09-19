import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    """
    Supabase client for application data and investigator persistence.
    """
    def __init__(self):
        self.client = None
        try:
            from supabase import create_client
            if settings.SUPABASE_URL and not settings.SUPABASE_URL.startswith("https://placeholder"):
                self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception:
            self.client = None

    def is_connected(self) -> bool:
        return self.client is not None

    def save_processing_job(self, filename: str, file_type: str, nodes: int, edges: int, status: str = "completed") -> bool:
        """Saves uploaded file report and pipeline status into Supabase processing_jobs table."""
        if not self.client:
            return False
        try:
            row = {
                "filename": filename,
                "type": file_type.upper(),
                "status": status,
                "progress": 100,
                "details": f"{nodes} Nodes, {edges} Edges created",
                "created_at": datetime.utcnow().isoformat()
            }
            self.client.table("processing_jobs").insert(row).execute()
            return True
        except Exception as exc:
            logger.warning("Supabase processing job write failed (%s)", type(exc).__name__)
            return False

    def save_extracted_entities(self, entities: List[Dict[str, Any]]) -> bool:
        """Saves extracted suspects, phones, or vehicles into Supabase extracted_entities table."""
        if not self.client or not entities:
            return False
        try:
            self.client.table("extracted_entities").insert(entities).execute()
            return True
        except Exception as exc:
            logger.warning("Supabase entity write failed (%s)", type(exc).__name__)
            return False

    def save_case(self, case_data: Dict[str, Any]) -> bool:
        """Saves a registered case into Supabase cases table."""
        if not self.client:
            return False
        try:
            self.client.table("cases").upsert(case_data).execute()
            return True
        except Exception as exc:
            logger.warning("Supabase case write failed (%s)", type(exc).__name__)
            return False

supabase_service = SupabaseService()
