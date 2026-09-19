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
        context_text = " ".join(context)
        role_cues = {
            "suspect": r"\b(?:suspect|accused|ringleader|offender|perpetrator|apprehended|arrested|detained|tracking|cctv|charged|suspicion|leaving the premises)\b",
            "witness": r"\b(?:witness|eyewitness|observed|witnessed|saw|corroborated|testimony|detailed account|came forward)\b",
            "complainant": r"\b(?:complainant|complaint|lodged|personally reported|submitted a written complaint|registered the fir|written grievance|case was opened|approached the station)\b",
            "officer": r"\b(?:inspector|sub inspector|officer|constable|official capacity|assigned to|seized|secured|investigating|oversaw|search operations)\b",
            "victim": r"\b(?:victim|suffered|medical attention|severe losses|bore the brunt|exploited|harmed|injured)\b",
            "person of interest": r"\b(?:person of interest|no affirmative evidence|no connection|questioned but released|supplementary reports)\b",
        }
        for role, pattern in role_cues.items():
            if re.search(pattern, context_text):
                features.extend([f"role_cue:{role}"] * 12)
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
            (
                "officer",
                rf"\b(?:inspector|sub-inspector|investigating officer|officer|constable|ranger)\s+{name}\b|"
                rf"\b(?:crime scene|premises|area)\s+was\s+secured\s+by\s+{name}\b|"
                rf"\b{name}\s+(?:seized|secured|investigated|oversaw|conducted|recorded|arrested\s+the\s+suspects?)\b",
            ),
            (
                "witness",
                rf"\b(?:witness|eyewitness|informant)\s+{name}\b|"
                rf"\b{name}\s+(?:saw|witnessed|observed|corroborated|provided\s+a\s+detailed\s+account|came\s+forward\s+as\s+(?:a\s+)?(?:key\s+)?witness)\b|"
                rf"\b(?:testimony|statement|account)\s+of\s+{name}\b|"
                rf"\baccording\s+to\s+{name}\s*,\s*who\s+witnessed\b",
            ),
            (
                "suspect",
                rf"\b(?:suspect|accused|ringleader|offender|perpetrator)\s+{name}\b|"
                rf"\b(?:apprehended|arrested|detained|identified)\s+{name}\b|"
                rf"\b(?:identified|recognized|recognised|named)\s+(?:the\s+)?"
                rf"(?:ringleader|suspect|accused|offender|perpetrator)\s+as\s+{name}\b|"
                rf"\b(?:primary|prime)\s+accused\s+(?:is|was)\s+{name}\b|"
                rf"\bnamed\s+{name}\s+as\s+(?:the\s+)?(?:prime\s+|primary\s+)?suspect\b|"
                rf"\bcctv\s+showed\s+{name}\s+leaving\b|"
                rf"\b{name}\s+(?:was\s+(?:formally\s+)?charged|faces?\s+accusations?)\b",
            ),
            (
                "complainant",
                rf"\bcomplainant\s*,?\s*{name}\b|\b{name}\s+(?:personally\s+)?(?:reported|filed|lodged|registered\s+the\s+fir|approached\s+the\s+station\s+to\s+file\s+a\s+complaint)\b|"
                rf"\b(?:written\s+)?(?:complaint|grievance|report)\s+(?:was\s+)?(?:filed|lodged|submitted)?\s*by\s+{name}\b|"
                rf"\bvictimized\s+party(?:'s)?\s+representative\s*,\s*{name}\s*,\s*filed\s+the\s+formal\s+complaint\b",
            ),
            (
                "victim",
                rf"\bvictim\s*,?\s*{name}\b|\bmedical\s+attention\s+was\s+provided\s+to\s+{name}\b|"
                rf"\b{name}\s+(?:suffered|sustained\s+damages|bore\s+the\s+brunt|was\s+harmed|was\s+injured)\b|"
                rf"\bperpetrators\s+exploited\s+{name}\b|"
                rf"\brestitution\s+is\s+sought\s+for\s+{name}\s*,\s*the\s+primary\s+victim\b",
            ),
            (
                "person of interest",
                rf"\b{name}\s+is\s+a\s+person\s+of\s+interest\b|"
                rf"\bno\s+affirmative\s+evidence\s+linked\s+{name}\b|"
                rf"\binvestigated\s+{name}\s+but\s+found\s+no\s+connection\b|"
                rf"\b{name}\s+was\s+(?:questioned\s+but\s+released|mentioned\s+in\s+supplementary\s+reports)\b|"
                rf"\bthe\s+name\s+{name}\s+surfaced\s+during\s+inquiries\s*,?\s*though\s+no\s+direct\s+involvement\b|"
                rf"\b(?:detectives|investigators|police)\s+ruled\s+out\s+{name}\s+after\s+verifying\s+(?:their|an?)\s+alibi\b",
            ),
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
        title_match = re.match(r"^(?:mr|mrs|ms|dr|shri|smt)\.?(?:\s+|$)", cleaned, flags=re.IGNORECASE)
        untitled = cleaned[title_match.end():] if title_match else cleaned
        words = untitled.split()
        crime_names = {
            "abduction", "bootlegging", "cattle smuggling", "contraband smuggling",
            "counterfeit currency", "cyber fraud", "hawala transactions",
            "illegal wildlife trade", "organized robbery", "ransomware extortion",
        }
        blocked_words = {
            "account", "bank", "branch", "company", "corporation", "department",
            "complainant", "creta", "district", "enfield", "fraud", "inspector",
            "honda", "hyundai", "limited", "mall", "market", "nagar", "nexon",
            "officer", "police", "private", "pulsar", "road", "scorpio", "street",
            "suspect", "swift", "tata", "transactions", "victim", "witness",
        }
        if not (
            2 <= len(words) <= 4
            and untitled.lower() not in crime_names
            and not any(word.lower() in blocked_words for word in words)
        ):
            return False
        if title_match is not None:
            return all(re.fullmatch(r"[^\W\d_][\w'-]*", word, flags=re.UNICODE) for word in words)
        return all(re.fullmatch(r"[A-Z][\w'-]*", word, flags=re.UNICODE) for word in words)

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
        titled_name = r"(?:Mr|Mrs|Ms|Dr|Shri|Smt)\.?\s+[^\W\d_][\w'-]*(?:\s+[^\W\d_][\w'-]*){1,3}"
        capitalized_name = r"[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*){1,3}"
        name = rf"(?:{titled_name}|{capitalized_name})"
        patterns = [
            # High precision role-bearing FIR phrases. These are deliberately
            # bounded by surrounding wording so four-part Indian names and
            # honorifics are captured whole instead of as partial names.
            rf"(?i:\bwitness\s+)({name})(?i:\s+provided\s+a\s+detailed\s+account)",
            rf"(?i:\bstatement\s+was\s+recorded\s+from\s+)({name})(?i:\s+who\s+observed)",
            rf"\b({name})(?i:\s+came\s+forward\s+as\s+(?:a\s+)?(?:key\s+)?witness\b)",
            rf"(?i:\beyewitness\s+)({name})(?i:\s+corroborated\b)",
            rf"(?i:\baccording\s+to\s+)({name})(?i:\s*,\s*who\s+witnessed\b)",
            rf"(?i:\btestimony\s+of\s+)({name})(?=[,.;]|$)",
            rf"\b({name})(?i:\s+testified\s+regarding\b)",
            rf"\b({name})(?i:\s+is\s+a\s+person\s+of\s+interest\b)",
            rf"(?i:\bno\s+affirmative\s+evidence\s+linked\s+)({name})(?i:\s+to\b)",
            rf"(?i:\bwe\s+investigated\s+)({name})(?i:\s+but\s+found\s+no\s+connection\b)",
            rf"(?i:\bbackground\s+checks\s+were\s+run\s+on\s+)({name})(?i:\s*,\s*yielding\s+no\s+conclusive\s+link\b)",
            rf"\b({name})(?i:\s+was\s+questioned\s+but\s+released\b)",
            rf"(?i:\b(?:detectives|investigators|police)\s+ruled\s+out\s+)({name})(?i:\s+after\s+verifying\b)",
            rf"(?i:\bthe\s+name\s+)({name})(?i:\s+surfaced\s+during\s+inquiries\b)",
            rf"(?i:\b(?:officer|investigating\s+officer)\s+)({name})(?i:\s+(?:is\s+actively\s+investigating|oversaw)\b)",
            rf"(?i:\bsub-inspector\s+)({name})(?i:\s+seized\b)",
            rf"(?i:\bcrime\s+scene\s+was\s+secured\s+by\s+)({name})(?=[,.;]|$)",
            rf"(?i:\braid\s+was\s+led\s+by\s+)({name})(?=[,.;]|$)",
            rf"\b({name})(?i:\s+(?:recorded\s+the\s+statements|arrested\s+the\s+suspects?)\b)",
            rf"(?i:\bcctv\s+showed\s+)({name})(?i:\s+leaving\s+the\s+premises\b)",
            rf"\b({name})(?i:\s*,\s*identified\s+as\s+a\s+suspect\s*,\s*was\s+apprehended\b)",
            rf"(?i:\bsuspect\s+)({name})(?i:\s+was\s+(?:formally\s+)?charged\b)",
            rf"\b({name})(?i:\s+faces?\s+accusations?\s+of\b)",
            rf"(?i:\bprimary\s+accused\s+(?:is|was)\s+)({name})(?=[,.;]|$)",
            rf"(?i:\binvestigating\s+officers?\s+named\s+)({name})(?i:\s+as\s+(?:the\s+)?(?:prime|primary)\s+suspect\b)",
            rf"(?i:\b(?:authorities|officers|police)\s+detained\s+)({name})(?i:\s+under\s+suspicion\b)",
            rf"(?i:\bmedical\s+attention\s+was\s+provided\s+to\s+)({name})(?=[,.;]|$)",
            rf"(?i:\bthe\s+victim\s*,\s*)({name})(?i:\s*,\s*suffered\b)",
            rf"\b({name})(?i:\s+(?:was\s+directly\s+targeted|sustained\s+damages|bore\s+the\s+brunt)\b)",
            rf"(?i:\bperpetrators\s+exploited\s+)({name})(?=[,.;]|$)",
            rf"(?i:\brestitution\s+is\s+sought\s+for\s+)({name})(?i:\s*,\s*the\s+primary\s+victim\b)",
            rf"(?i:\bcomplainant\s*,\s*)({name})(?i:\s*,\s*registered\s+the\s+fir\b)",
            rf"\b({name})(?i:\s+approached\s+the\s+station\s+to\s+file\s+a\s+complaint\b)",
            rf"(?i:\bwritten\s+grievance\s+by\s+)({name})(?i:\s*,\s*the\s+case\s+was\s+opened\b)",
            rf"(?i:\battention\s+by\s+complainant\s+)({name})(?=[,.;]|$)",
            rf"(?i:\breport\s+submitted\s+by\s+)({name})(?i:\s*,\s*an\s+inquiry\s+began\b)",
            rf"\b({name})(?i:\s+initiated\s+the\s+legal\s+proceedings\b)",
            rf"(?i:\bvictimized\s+party(?:'s)?\s+representative\s*,\s*)({name})(?i:\s*,\s*filed\s+the\s+formal\s+complaint\b)",
            rf"\b(?:apprehended|arrested|detained|identified|involving|involvement of|led by|against)\s+({name})(?=[,.;]|\s+(?:who|was|is|has|had|at|in|from|near|during|after|before|with)\b|$)",
            rf"\b(?:identified|recognized|recognised|named)\s+(?:the\s+)?(?:ringleader|suspect|accused|offender|perpetrator)\s+as\s+({name})(?=[,.;]|\s+(?:who|was|is|has|had|at|in|from|with)\b|$)",
            rf"\b(?:debriefing of|interview of)\s+({name})",
            rf"\b(?:protections?|assistance) (?:was|were) offered to\s+({name})",
            rf"\b(?:tracking|seeking|monitoring|searching for|looking for)\s+({name})(?=[,.;]|\s+(?:who|was|is|has|had|at|in|from|with|and)\b|$)",
            rf"\b({name})\s+(?:personally reported|reported|filed|was identified|was apprehended|was arrested|was detained|was interviewed|used|uses|owned|owns|drove|drives|operated|operates|contacted|called|transferred|received|paid|resides|lives)",
            rf"\b({name})\s+(?:was|is)\s+(?:actively\s+|currently\s+)?(?:using|operating|driving|contacting|calling|transferring|receiving|residing|living)",
            rf"\b(?:Inspector|Sub-Inspector|Officer|Constable|Ranger|Witness|Eyewitness|Informant|Suspect|Accused|Complainant|Victim)\s+({name})",
            rf"\b(?:complaint|report|statement)\s+(?:was\s+)?(?:lodged|filed|submitted|provided|given)\s+by\s+({name})",
            rf"\b(?:report|statement|complaint)\s+from\s+({name})",
            rf"\b(?:Witness|Complainant|Officer|Suspect|Victim)\s+(?:name\s*)?[:\-]\s*({name})",
            rf"\b({name})\s*,\s+(?:an?\s+)?(?:eyewitness|witness|complainant|police officer|investigating officer|suspect|accused)\b",
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

        # A broad NER engine can return a short fragment of a name that a
        # role-bounded rule also captured in full (for example "Neha Raj"
        # beside "Dr. Neha Raj Kumar Gowda"). Keep the most complete mention;
        # fragments would otherwise become fake people and graph nodes.
        def person_tokens(value: str) -> List[str]:
            normalized = re.sub(r"[^\w' -]+", " ", value, flags=re.UNICODE).lower()
            tokens = normalized.split()
            if tokens and tokens[0] in {"mr", "mrs", "ms", "dr", "shri", "smt"}:
                tokens = tokens[1:]
            return tokens

        people = results["persons"]
        tokenized = [person_tokens(value) for value in people]
        has_title = [
            bool(re.match(r"^(?:mr|mrs|ms|dr|shri|smt)\.?(?:\s+|$)", value, flags=re.IGNORECASE))
            for value in people
        ]
        results["persons"] = [
            value
            for index, value in enumerate(people)
            if not any(
                (
                    len(tokenized[other]) > len(tokenized[index])
                    and any(
                        tokenized[other][start:start + len(tokenized[index])] == tokenized[index]
                        for start in range(len(tokenized[other]) - len(tokenized[index]) + 1)
                    )
                )
                or (
                    tokenized[other] == tokenized[index]
                    and has_title[other]
                    and not has_title[index]
                )
                for other in range(len(people))
                if other != index and tokenized[index]
            )
        ]

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
