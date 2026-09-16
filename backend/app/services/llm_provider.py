import json
from dataclasses import dataclass
from typing import Any, Dict, List

from app.config import settings


@dataclass(frozen=True)
class LLMResult:
    available: bool
    provider: str
    model: str
    payload: Dict[str, Any]
    warning: str = ""


class GeminiProvider:
    """Stateless Gemini explanation adapter with strict structured output.

    Gemini receives only evidence and graph context selected by NexusNet. It
    receives no database credentials, cannot execute Cypher, and cannot write
    to the production graph. Cloud transmission is disabled by default until
    the deployment owner explicitly acknowledges its data policy.
    """

    RESPONSE_SCHEMA = {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["Verified Fact", "Corroborated", "Inferred", "Unresolved"],
                        },
                        "statement": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "evidence_ids": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["status", "statement", "confidence", "evidence_ids"],
                    "additionalProperties": False,
                },
            },
            "contradictions": {"type": "array", "items": {"type": "string"}},
            "unresolved": {"type": "array", "items": {"type": "string"}},
            "suggested_questions": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["answer", "findings", "contradictions", "unresolved", "suggested_questions"],
        "additionalProperties": False,
    }

    def generate_json(
        self,
        question: str,
        retrieved_context: List[Dict[str, Any]],
        graph_context: Dict[str, Any],
        query_plan: List[str],
    ) -> LLMResult:
        if not settings.LLM_ENABLED or settings.LLM_PROVIDER.lower() != "gemini":
            return LLMResult(False, settings.LLM_PROVIDER, settings.LLM_MODEL, {}, "Gemini is disabled.")
        if not settings.GEMINI_API_KEY:
            return LLMResult(
                False,
                "gemini",
                settings.LLM_MODEL,
                {},
                "GEMINI_API_KEY is not configured; deterministic grounded reasoning used.",
            )
        if not settings.ALLOW_CLOUD_FIR_PROCESSING:
            return LLMResult(
                False,
                "gemini",
                settings.LLM_MODEL,
                {},
                "Cloud FIR processing is disabled. Set ALLOW_CLOUD_FIR_PROCESSING=true only for authorized or anonymized data.",
            )

        system_prompt = (
            "You are NexusNet's evidence-grounded investigative explanation layer. "
            "Use only supplied context. Never invent a person, event, relationship, citation, or allegation. "
            "Never claim guilt. Separate Verified Fact, Corroborated, Inferred, and Unresolved statements. "
            "An inference is only a lead requiring investigator verification. Evidence IDs must come from "
            "the supplied retrieved records. Reveal contradictions and missing information."
        )
        prompt = json.dumps(
            {
                "instructions": system_prompt,
                "question": question,
                "query_plan": query_plan,
                "retrieved_records": retrieved_context,
                "graph_context": graph_context,
            },
            ensure_ascii=False,
        )
        try:
            from google import genai

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            interaction = client.interactions.create(
                model=settings.LLM_MODEL,
                input=prompt,
                store=False,
                generation_config={"temperature": 0.1},
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": self.RESPONSE_SCHEMA,
                },
            )
            payload = json.loads(interaction.output_text)
            if not isinstance(payload, dict):
                raise ValueError("Gemini returned a non-object JSON value")
            return LLMResult(True, "gemini", settings.LLM_MODEL, payload)
        except Exception as exc:
            return LLMResult(
                False,
                "gemini",
                settings.LLM_MODEL,
                {},
                f"Gemini unavailable; deterministic grounded reasoning used ({type(exc).__name__}).",
            )


llm_provider = GeminiProvider()
