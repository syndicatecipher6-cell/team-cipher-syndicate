import re
from typing import List, Dict, Any
from app.config import settings

class NLPEntityExtractor:
    """
    spaCy & NLP entity extraction engine for police FIRs and unstructured text.
    """
    def __init__(self):
        self.nlp = None
        self.gliner = None
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

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        results = {
            "persons": [],
            "organizations": [],
            "locations": [],
            "phones": [],
            "vehicles": [],
            "fir_numbers": [],
            "transactions": []
        }

        # 1. spaCy NER if loaded
        if self.nlp:
            try:
                doc = self.nlp(text)
                for ent in doc.ents:
                    if ent.label_ == "PERSON":
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
                    if target and value:
                        results[target].append(value)
            except Exception:
                pass

        # 3. Regex Patterns for Law Enforcement Identifiers
        # Indian Phone numbers
        phone_matches = re.findall(r'(?:\+91[\s-]?)?[6789]\d{9}', text)
        results["phones"].extend([p.strip() for p in phone_matches])

        # Vehicle registration plates (Indian format: DL 04 NX 0201, MH 12 AB 1234)
        vehicle_matches = re.findall(r'\b[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}\b', text, re.I)
        results["vehicles"].extend([v.upper().strip() for v in vehicle_matches])

        # FIR numbers (FIR/ND/1042/26, FIR No. 124/2026)
        fir_matches = re.findall(r'(?:FIR[/\s\w]+/\d{2,4})', text, re.I)
        results["fir_numbers"].extend([f.strip() for f in fir_matches])

        # Transaction and Account IDs
        txn_matches = re.findall(r'\b(?:TXN|TX|IMPS|UPI)[-\s]?[0-9A-Z]{4,12}\b', text, re.I)
        results["transactions"].extend([t.strip() for t in txn_matches])

        # Deduplicate
        for k in results:
            results[k] = list(dict.fromkeys(results[k]))

        return results

nlp_extractor = NLPEntityExtractor()
