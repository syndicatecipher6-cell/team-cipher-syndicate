from typing import Optional, Dict, Any
from app.config import settings

class SupabaseService:
    """
    Supabase client for application data and investigator auth persistence.
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

    def sync_case(self, case_data: Dict[str, Any]) -> bool:
        if not self.client:
            return False
        try:
            self.client.table("cases").upsert(case_data).execute()
            return True
        except Exception:
            return False

supabase_service = SupabaseService()
