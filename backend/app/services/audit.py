from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List
from uuid import uuid4


@dataclass(frozen=True)
class AuditEvent:
    event_id: str
    timestamp: str
    actor: str
    action: str
    resource: str
    details: Dict[str, Any]


class AuditService:
    """Append-only in-process audit trail.

    Production deployments can replace this adapter with an immutable database
    sink without changing the investigator or sandbox services.
    """

    def __init__(self) -> None:
        self._events: List[AuditEvent] = []
        self._lock = Lock()

    def record(self, actor: str, action: str, resource: str, details: Dict[str, Any]) -> AuditEvent:
        event = AuditEvent(
            event_id=f"AUD-{uuid4().hex[:12].upper()}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            actor=actor,
            action=action,
            resource=resource,
            details=details,
        )
        with self._lock:
            self._events.append(event)
        return event

    def list_for_resource(self, resource: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [asdict(event) for event in self._events if event.resource == resource]


audit_service = AuditService()
