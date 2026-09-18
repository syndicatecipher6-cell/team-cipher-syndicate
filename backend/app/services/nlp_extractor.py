import json
import math
import re
import unicodedata
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import settings

class NLPEntityExtractor:
    """
    spaCy & NLP entity extraction engine for police FIRs and unstructured text.
    """
    def __init__(self):
        self.nlp = None
        self.gliner = None
        self.trained_model = None
        model_path = Path(__file__).resolve().parents[2] / "models" / "fir_extractor_model.json"
        try:
            with model_path.open("r", encoding="utf-8") as model_file:
                self.trained_model = json.load(model_file)
        except (OSError, ValueError):
            self.trained_model = None

        try:
            import spacy
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except Exception:
                pass
        except Exception:
            pass

        if settings.ENABLE_LOCAL_TRANSFORMERS:
            try:
                from gliner import GLiNER
                self.gliner = GLiNER.from_pretrained(settings.GLINER_MODEL)
            except Exception:
                self.gliner = None

    @staticmethod
    def _base_tokens(text: str) -> List[str]:
        normalized = unicodedata.normalize("NFKC", text).lower()
        normalized = re.sub(r"\b\d{2}[-/]\d{2}[-/]\d{4}\b", " date_token ", normalized)
        normalized = re.sub(r"(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b", " phone_token ", normalized)
        normalized = re.sub(
            r"\b[a-z]{2}[\s-]?\d{1,2}[\s-]?[a-z]{1,3}[\s-]?\d{4}\b",
            " vehicle_token ",
            normalized,
        )
        normalized = re.sub(r"\b\d[\d,]*(?:\.\d+)?\b", " number_token ", normalized)
        normalized = re.sub(r"[^\w]+", " ", normalized, flags=re.UNICODE).strip()
        return normalized.split() if normalized else []

    @classmethod
    def _document_features(cls, text: str) -> List[str]:
        tokens = cls._base_tokens(text)
        features = [f"u:{token}" for token in tokens]
        features.extend(f"b:{left}_{right}" for left, right in zip(tokens, tokens[1:]))
        return features

    @classmethod
    def _role_features(cls, text: str, person_name: str) -> List[str]:
        marked = re.sub(re.escape(person_name), " person_marker ", text, flags=re.IGNORECASE)
        tokens = cls._base_tokens(marked)
        try:
            marker = tokens.index("person_marker")
        except ValueError:
            return cls._document_features(text)

        features: List[str] = []
        for offset in range(-16, 17):
            if offset == 0 or not 0 <= marker + offset < len(tokens):
                continue
            token = tokens[marker + offset]
            side = "before" if offset < 0 else "after"
            features.append(f"{side}:{token}")
            if abs(offset) <= 6:
                features.append(f"{side}:{abs(offset)}:{token}")

        context = tokens[max(0, marker - 16):min(len(tokens), marker + 17)]
        features.extend(f"context:{token}" for token in context if token != "person_marker")
        features.extend(f"context_bigram:{left}_{right}" for left, right in zip(context, context[1:]))
        return features

    @staticmethod
    def _predict(model: Optional[Dict[str, Any]], features: List[str]) -> Optional[Dict[str, Any]]:
        if not model:
            return None
        vocabulary = set(model.get("vocabulary", []))
        labels = model.get("labels", [])
        if not vocabulary or not labels:
            return None

        scores: Dict[str, float] = {}
        for label in labels:
            score = float(model["logPrior"][label])
            weights = model["logLikelihood"][label]
            unknown = float(model["unknownLogProbability"][label])
            for feature in features:
                if feature in vocabulary:
                    score += float(weights.get(feature, unknown))
            scores[label] = score

        predicted = max(scores, key=scores.get)
        maximum = max(scores.values())
        exponentials = {label: math.exp(score - maximum) for label, score in scores.items()}
        total = sum(exponentials.values()) or 1.0
        return {"label": predicted, "confidence": exponentials[predicted] / total}

    @staticmethod
    def _explicit_role(text: str, person_name: str) -> Optional[str]:
        name = re.escape(person_name)
        direct_patterns = (
            ("officer", rf"\b(?:inspector|sub-inspector|officer|constable|ranger)\s+{name}\b"),
            ("witness", rf"\b(?:witness|eyewitness|informant)\s+{name}\b|\b{name}\s+(?:saw|witnessed|observed)\b"),
            ("suspect", rf"\b(?:suspect|accused)\s+{name}\b|\b(?:apprehended|arrested|detained|identified)\s+{name}\b"),
            ("complainant", rf"\bcomplainant\s+{name}\b|\b{name}\s+(?:personally\s+)?(?:reported|filed|lodged)\b"),
        )
        for role, pattern in direct_patterns:
            if re.search(pattern, text, flags=re.IGNORECASE):
                return role
        return None

    @staticmethod
    def _explicit_crime(text: str) -> Optional[str]:
        patterns = (
            ("Ransomware Extortion", r"\bransomware(?:\s+extortion)?\b"),
            ("Cyber Fraud", r"\b(?:cyber\s+fraud|online\s+fraud|phishing)\b"),
            ("Counterfeit Currency", r"\b(?:counterfeit|fake)\s+(?:currency|notes?)\b"),
            ("Hawala Transactions", r"\bhawala\b"),
            ("Illegal Wildlife Trade", r"\b(?:illegal\s+)?wildlife\s+(?:trade|trafficking)\b"),
            ("Cattle Smuggling", r"\bcattle\s+smuggling\b"),
            ("Contraband Smuggling", r"\b(?:contraband|narcotics?|drugs?)\s+(?:smuggling|trafficking)\b"),
            ("Bootlegging", r"\b(?:bootlegging|illicit\s+liquor)\b"),
            ("Organized Robbery", r"\b(?:organized\s+robbery|armed\s+robbery|gang\s+robbery)\b"),
            ("Abduction", r"\b(?:abduction|kidnapping|kidnapped)\b"),
        )
        for label, pattern in patterns:
            if re.search(pattern, text, flags=re.IGNORECASE):
                return label
        return None

    @staticmethod
    def _is_plausible_person(value: str) -> bool:
        cleaned = re.sub(r"\s+", " ", value).strip(" .,;:-")
        words = cleaned.split()
        crime_names = {
            "abduction", "bootlegging", "cattle smuggling", "contraband smuggling",
            "counterfeit currency", "cyber fraud", "hawala transactions",
            "illegal wildlife trade", "organized robbery", "ransomware extortion",
        }
        blocked_words = {
            "account", "bank", "branch", "company", "corporation", "department",
            "complainant", "creta", "district", "enfield", "fraud", "inspector",
            "limited", "mall", "market", "nagar", "officer", "police", "private",
            "pulsar", "road", "scorpio", "street", "suspect", "swift", "transactions",
            "victim", "witness",
        }
        return (
            2 <= len(words) <= 4
            and cleaned.lower() not in crime_names
            and not any(word.lower() in blocked_words for word in words)
            and all(re.fullmatch(r"[A-Z][\w'-]*", word, flags=re.UNICODE) for word in words)
        )

    @classmethod
    def _has_person_context(cls, text: str, value: str) -> bool:
        match = re.search(re.escape(value), text)
        if not match:
            return False
        window = text[max(0, match.start() - 90):min(len(text), match.end() + 90)].lower()
        return bool(re.search(
            r"\b(?:alias|apprehended|arrested|complainant|detained|informant|inspector|"
            r"involvement|led by|officer|operator|reported|suspect|victim|witness)\b",
            window,
        ))

    @classmethod
    def _rule_person_candidates(cls, text: str) -> List[str]:
        name = r"[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){1,3}"
        patterns = [
            rf"\b(?:apprehended|arrested|detained|identified|involving|involvement of|led by|against)\s+({name})",
            rf"\b(?:debriefing of|interview of)\s+({name})",
            rf"\b(?:protections?|assistance) (?:was|were) offered to\s+({name})",
            rf"\b({name})\s+(?:personally reported|reported|filed|was identified|was apprehended|was arrested|was detained|was interviewed)",
            rf"\b(?:Inspector|Officer|Constable|Ranger|Witness|Suspect|Accused|Complainant|Victim)\s+({name})",
        ]
        candidates: List[str] = []
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                candidate = match.group(1).strip()
                if cls._is_plausible_person(candidate):
                    candidates.append(candidate)
        return candidates

    def extract_entities(self, text: str) -> Dict[str, Any]:
        results: Dict[str, Any] = {
            "persons": [],
            "organizations": [],
            "locations": [],
            "phones": [],
            "vehicles": [],
            "fir_numbers": [],
            "transactions": [],
            "accounts": [],
        }

        # 1. spaCy NER if loaded
        if self.nlp:
            try:
                doc = self.nlp(text)
                for ent in doc.ents:
                    if ent.label_ == "PERSON" and self._is_plausible_person(ent.text):
                        results["persons"].append(ent.text.strip())
                    elif ent.label_ == "ORG":
                        results["organizations"].append(ent.text.strip())
                    elif ent.label_ in ["GPE", "LOC"]:
                        results["locations"].append(ent.text.strip())
            except Exception:
                pass

        # 2. GLiNER augments spaCy for open-label person, organization, and
        # location extraction when the optional local model pack is enabled.
        if self.gliner:
            try:
                labels = ["person", "organization", "location"]
                for entity in self.gliner.predict_entities(text[:20000], labels, threshold=0.45):
                    label = entity.get("label")
                    value = str(entity.get("text", "")).strip()
                    target = {
                        "person": "persons",
                        "organization": "organizations",
                        "location": "locations",
                    }.get(label)
                    if target and value and (target != "persons" or self._is_plausible_person(value)):
                        results[target].append(value)
            except Exception:
                pass

        results["persons"].extend(self._rule_person_candidates(text))

        # 3. Regex Patterns for Law Enforcement Identifiers
        # Indian Phone numbers
        for phone_match in re.finditer(r'(?:\+91[\s-]?)?[6789]\d{9}', text):
            preceding = text[max(0, phone_match.start() - 35):phone_match.start()].lower()
            if re.search(r"\b(?:account|a/c|acct)\s*$", preceding):
                continue
            results["phones"].append(phone_match.group(0).strip())

        # Vehicle registration plates (Indian format: DL 04 NX 0201, MH 12 AB 1234)
        vehicle_matches = re.findall(r'\b[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}\b', text, re.I)
        results["vehicles"].extend([v.upper().strip() for v in vehicle_matches])

        # FIR numbers (FIR/ND/1042/26, FIR No. 124/2026)
        fir_matches = re.findall(r'(?:FIR[/\s\w]+/\d{2,4})', text, re.I)
        results["fir_numbers"].extend([f.strip() for f in fir_matches])

        # Transaction and Account IDs
        txn_matches = re.findall(
            r'\b(?:TXN|TX|IMPS|UPI)[-\s]?(?=[0-9A-Z]{4,12}\b)(?=[0-9A-Z]*\d)[0-9A-Z]{4,12}\b',
            text,
            re.I,
        )
        results["transactions"].extend([t.strip() for t in txn_matches])

        amount_matches = re.findall(
            r'\b(?:Rs\.?|INR)\s*[0-9][0-9,]*(?:\.\d+)?(?:\s+via\s+[A-Z][A-Z0-9-]*)?',
            text,
            re.I,
        )
        results["transactions"].extend([value.strip() for value in amount_matches])

        account_matches = re.findall(
            r'\b(?:[A-Z][A-Za-z&.-]*\s+){0,3}(?:bank\s+)?account\s+(?:number\s+|no\.?\s*)?[0-9]{8,18}\b',
            text,
            re.I,
        )
        results["accounts"].extend([value.strip() for value in account_matches])

        # Deduplicate
        for k in results:
            results[k] = list(dict.fromkeys(results[k]))

        aliases = {
            match.group(1).lower()
            for match in re.finditer(r"\balias\s+([A-Z][\w'-]*)", text)
        }
        results["locations"] = [
            value for value in results["locations"]
            if value.lower() not in aliases
        ]
        person_keys = {value.lower() for value in results["persons"]}
        results["organizations"] = [
            value for value in results["organizations"]
            if value.lower() not in person_keys
        ]

        if self.trained_model:
            explicit_crime = self._explicit_crime(text)
            crime = (
                {"label": explicit_crime, "confidence": 1.0, "source": "explicit FIR wording"}
                if explicit_crime
                else self._predict(
                    self.trained_model.get("crimeClassifier"),
                    self._document_features(text),
                )
            )
            results["crime_type"] = crime
            person_roles = []
            for person in results["persons"]:
                explicit_role = self._explicit_role(text, person)
                learned_role = self._predict(
                    self.trained_model.get("personRoleClassifier"),
                    self._role_features(text, person),
                )
                if explicit_role:
                    person_roles.append({
                        "name": person,
                        "role": explicit_role,
                        "confidence": 1.0,
                        "source": "explicit FIR wording",
                    })
                elif learned_role:
                    person_roles.append({
                        "name": person,
                        "role": learned_role["label"],
                        "confidence": learned_role["confidence"],
                        "source": "trained FIR role model",
                    })
            results["person_roles"] = person_roles

        return results

nlp_extractor = NLPEntityExtractor()
