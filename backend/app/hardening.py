import json
import time
from collections import defaultdict, deque
from pathlib import PurePath
from typing import Sequence

from fastapi import HTTPException, UploadFile, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


ALLOWED_UPLOAD_TYPES = {
    ".txt": {"text/plain", "application/octet-stream"},
    ".csv": {"text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"},
    ".json": {"application/json", "text/json", "text/plain", "application/octet-stream"},
    ".pdf": {"application/pdf", "application/octet-stream"},
}


def _safe_filename(filename: str | None) -> tuple[str, str]:
    value = (filename or "").strip()
    if (
        not value
        or len(value) > 255
        or "/" in value
        or "\\" in value
        or "\x00" in value
        or any(ord(character) < 32 for character in value)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload filename.")

    extension = PurePath(value).suffix.lower()
    if extension not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Allowed types: TXT, CSV, JSON, PDF.",
        )
    return value, extension


def _validate_content(extension: str, content_type: str, content: bytes) -> str:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty files are not allowed.")
    normalized_type = content_type.split(";", 1)[0].strip().lower()
    if normalized_type and normalized_type not in ALLOWED_UPLOAD_TYPES[extension]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"The content type does not match {extension.upper()} uploads.",
        )

    if extension == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid PDF signature.")
        return content.decode("utf-8", errors="ignore")

    if b"\x00" in content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Binary content is not allowed in text uploads.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text uploads must use UTF-8 encoding.") from exc

    if extension == ".json":
        try:
            json.loads(text)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON upload.") from exc
    return text


async def read_validated_uploads(
    files: Sequence[UploadFile],
    *,
    max_files: int,
    max_total_bytes: int,
) -> list[tuple[str, str, bytes, str]]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required.")
    if len(files) > max_files:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"A maximum of {max_files} files is allowed per request.",
        )

    validated: list[tuple[str, str, bytes, str]] = []
    total_bytes = 0
    for uploaded in files:
        filename, extension = _safe_filename(uploaded.filename)
        remaining = max_total_bytes - total_bytes
        content = await uploaded.read(remaining + 1)
        if len(content) > remaining:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Combined upload size must not exceed {max_total_bytes // (1024 * 1024)} MB.",
            )
        total_bytes += len(content)
        text = _validate_content(extension, uploaded.content_type or "", content)
        validated.append((filename, extension, content, text))
    return validated


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.headers.setdefault("X-API-Version", "1.0.0")
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_request_bytes: int):
        super().__init__(app)
        self.max_request_bytes = max_request_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > self.max_request_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                content={"detail": "Request body is too large."},
            )
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-instance abuse protection; edge/platform rate limits should supplement it."""

    def __init__(self, app, requests_per_window: int, window_seconds: int, sensitive_requests_per_window: int | None = None):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.sensitive_requests_per_window = sensitive_requests_per_window or requests_per_window
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path.endswith("/health") or request.method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)

        vercel_client = request.headers.get("x-vercel-forwarded-for") if request.headers.get("x-vercel-id") else None
        client = (vercel_client or (request.client.host if request.client else "unknown")).split(",", 1)[0].strip()
        now = time.monotonic()
        sensitive = request.url.path.endswith(("/federated/train", "/ingest/clear", "/assistant/query"))
        bucket = f"{client}:sensitive" if sensitive else client
        limit = self.sensitive_requests_per_window if sensitive else self.requests_per_window
        entries = self.requests[bucket]
        while entries and now - entries[0] >= self.window_seconds:
            entries.popleft()
        if len(entries) >= limit:
            retry_after = max(1, int(self.window_seconds - (now - entries[0])))
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(retry_after)},
                content={"detail": "Too many requests. Retry later."},
            )
        entries.append(now)
        return await call_next(request)
