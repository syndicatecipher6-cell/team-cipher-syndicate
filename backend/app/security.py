from dataclasses import dataclass
from typing import Iterable

from fastapi import Header, HTTPException, status

from app.config import settings


@dataclass(frozen=True)
class Principal:
    user_id: str
    role: str


READ_ROLES = {"investigator", "analyst", "supervisor", "admin"}
SANDBOX_ROLES = {"investigator", "analyst", "supervisor", "admin"}


def get_principal(
    x_nexusnet_user: str | None = Header(default=None),
    x_nexusnet_role: str | None = Header(default=None),
) -> Principal:
    """Resolve the authenticated actor before any investigation retrieval.

    Demo mode is intentionally explicit and local-development only. Required
    mode fails closed unless an upstream identity layer supplies both headers.
    """
    if settings.AUTH_MODE == "demo":
        return Principal(
            user_id=(x_nexusnet_user or "local-investigator").strip(),
            role=(x_nexusnet_role or "investigator").strip().lower(),
        )

    if not x_nexusnet_user or not x_nexusnet_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated investigator identity is required.",
        )
    return Principal(user_id=x_nexusnet_user.strip(), role=x_nexusnet_role.strip().lower())


def require_role(principal: Principal, allowed: Iterable[str]) -> None:
    if principal.role not in set(allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role is not authorized for this investigation operation.",
        )
