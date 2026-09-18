import argparse
import csv
import json
import re

from app.services.nlp_extractor import nlp_extractor


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def digits(value: str) -> str:
    return re.sub(r"\D", "", value)[-10:]


def alphanumeric(value: str) -> str:
    plate = re.search(r"\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}\b", value, re.IGNORECASE)
    selected = plate.group(0) if plate else value
    return re.sub(r"[^a-z0-9]", "", selected.lower())


def evaluate(dataset_path: str, split: str, details: bool = False) -> None:
    counts = {
        "person_tp": 0, "person_fp": 0, "person_fn": 0,
        "phone_tp": 0, "phone_fp": 0, "phone_fn": 0,
        "vehicle_tp": 0, "vehicle_fp": 0, "vehicle_fn": 0,
        "role_ok": 0, "role_total": 0, "crime_ok": 0, "cases": 0,
    }
    missed_people = []
    extra_people = []
    role_confusion = {}
    with open(dataset_path, encoding="utf-8", newline="") as dataset_file:
        for row in csv.DictReader(dataset_file):
            if row["split"] != split:
                continue
            result = nlp_extractor.extract_entities(row["fir_text"])
            counts["cases"] += 1
            counts["crime_ok"] += int(result.get("crime_type", {}).get("label") == row["crime_type"])

            expected_people = {
                normalize(item["name"]): normalize(item["role"])
                for item in json.loads(row["persons"])
            }
            predicted_people = {normalize(value) for value in result["persons"]}
            counts["person_tp"] += len(predicted_people & expected_people.keys())
            counts["person_fp"] += len(predicted_people - expected_people.keys())
            counts["person_fn"] += len(expected_people.keys() - predicted_people)
            for name in expected_people.keys() - predicted_people:
                missed_people.append((row["case_id"], name, row["fir_text"]))
            for name in predicted_people - expected_people.keys():
                extra_people.append((row["case_id"], name, row["fir_text"]))

            predicted_roles = {
                normalize(item["name"]): normalize(item["role"])
                for item in result.get("person_roles", [])
            }
            for name, role in expected_people.items():
                if name in predicted_roles:
                    counts["role_total"] += 1
                    counts["role_ok"] += int(predicted_roles[name] == role)
                    pair = (role, predicted_roles[name])
                    role_confusion[pair] = role_confusion.get(pair, 0) + 1

            for field, key, normalizer in (
                ("phones", "phone", digits),
                ("vehicles", "vehicle", alphanumeric),
            ):
                expected = {normalizer(value) for value in json.loads(row[field])}
                predicted = {normalizer(value) for value in result[field]}
                counts[f"{key}_tp"] += len(expected & predicted)
                counts[f"{key}_fp"] += len(predicted - expected)
                counts[f"{key}_fn"] += len(expected - predicted)

    for key in ("person", "phone", "vehicle"):
        true_positive = counts[f"{key}_tp"]
        false_positive = counts[f"{key}_fp"]
        false_negative = counts[f"{key}_fn"]
        precision = true_positive / max(1, true_positive + false_positive)
        recall = true_positive / max(1, true_positive + false_negative)
        f1 = 2 * precision * recall / max(1e-9, precision + recall)
        print(
            f"{key}: precision={precision:.3f} recall={recall:.3f} f1={f1:.3f} "
            f"tp={true_positive} fp={false_positive} fn={false_negative}"
        )
    print(f"crime_accuracy={counts['crime_ok'] / max(1, counts['cases']):.3f} ({counts['crime_ok']}/{counts['cases']})")
    print(
        f"role_accuracy_on_extracted={counts['role_ok'] / max(1, counts['role_total']):.3f} "
        f"({counts['role_ok']}/{counts['role_total']})"
    )
    if details:
        print("role_confusion:", sorted(role_confusion.items(), key=lambda item: (-item[1], item[0])))
        print("missed_people:")
        for item in missed_people[:12]:
            print(item)
        print("extra_people:")
        for item in extra_people[:12]:
            print(item)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate trained FIR extraction against labelled CSV data.")
    parser.add_argument("dataset")
    parser.add_argument("--split", default="test", choices=("train", "val", "test"))
    parser.add_argument("--details", action="store_true")
    arguments = parser.parse_args()
    evaluate(arguments.dataset, arguments.split, arguments.details)
