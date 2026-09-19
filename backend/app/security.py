import json
from dataclasses import dataclass
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from fastapi import Header, HTTPException, status

from app.config import settings
from app.services.audit import audit_service


@dataclass(frozen=True)
class Principal:
    user_id: str
    role: str
    station_id: str
    station_name: str


READ_ROLES = {"investigator", "analyst", "supervisor", "admin"}
SANDBOX_ROLES = {"investigator", "analyst", "supervisor", "admin"}
WRITE_ROLES = {"investigator", "supervisor", "admin"}
ADMIN_ROLES = {"supervisor", "admin"}


def _configured_ids(value: str) -> set[str]:
    return {item.strip() for item in value.split(",") if item.strip()}


def _role_for_user(user_id: str) -> str:
    if user_id in _configured_ids(settings.ADMIN_USER_IDS):
        return "admin"
    if user_id in _configured_ids(settings.SUPERVISOR_USER_IDS):
        return "supervisor"
    return "investigator"


def _supabase_base_url() -> str:
    value = settings.SUPABASE_URL.rstrip("/")
    parsed = urlparse(value)
    is_local = parsed.hostname in {"localhost", "127.0.0.1"}
    if (
        not parsed.hostname
        or (parsed.scheme != "https" and not is_local)
        or (not is_local and not parsed.hostname.endswith(".supabase.co"))
        or "placeholder" in parsed.hostname
    ):
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured securely.")
    if not settings.SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured securely.")
    return value


def _read_json(request: Request) -> object:
    try:
        with urlopen(request, timeout=settings.SUPABASE_AUTH_TIMEOUT_SECONDS) as response:
            raw = response.read(64 * 1024 + 1)
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        audit_service.record("anonymous", "AUTHENTICATION_FAILED", "supabase", {"reason": "token_rejected"})
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc
    if len(raw) > 64 * 1024:
        raise HTTPException(status_code=502, detail="Identity provider response was too large.")
    try:
        return json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Identity provider returned an invalid response.") from exc


def _verify_supabase_token(token: str) -> Principal:
    base_url = _supabase_base_url()
    common_headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    user = _read_json(Request(f"{base_url}/auth/v1/user", headers=common_headers))
    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.")

    profile_url = (
        f"{base_url}/rest/v1/station_members?user_id=eq.{quote(user_id, safe='')}"
        "&select=station_id,station_name&limit=1"
    )
    profiles = _read_json(Request(profile_url, headers=common_headers))
    profile = profiles[0] if isinstance(profiles, list) and profiles else None
    if not isinstance(profile, dict):
        raise HTTPException(status_code=403, detail="Authorised station membership is required.")
    station_id = profile.get("station_id")
    station_name = profile.get("station_name")
    if not isinstance(station_id, str) or not isinstance(station_name, str):
        raise HTTPException(status_code=502, detail="Station membership response was invalid.")
    return Principal(user_id, _role_for_user(user_id), station_id, station_name)


def get_principal(
    authorization: str | None = Header(default=None),
) -> Principal:
    """Resolve a fixed demo actor or a verified Supabase station member."""
    if settings.AUTH_MODE == "demo":
        # Demo headers are intentionally ignored so a browser cannot elevate
        # itself by supplying a different user or role.
        return Principal("local-investigator", "investigator", "local", "Local workspace")

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        audit_service.record("anonymous", "AUTHENTICATION_FAILED", "api", {"reason": "missing_bearer"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid Supabase bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _verify_supabase_token(token.strip())


def require_role(principal: Principal, allowed: Iterable[str]) -> None:
    if principal.role not in set(allowed):
        audit_service.record(
            principal.user_id,
            "AUTHORIZATION_DENIED",
            "api",
            {"role": principal.role, "station_id": principal.station_id},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role is not authorized for this investigation operation.",
        )
