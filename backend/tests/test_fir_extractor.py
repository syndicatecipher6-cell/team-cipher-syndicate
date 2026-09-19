import unittest

from app.services.nlp_extractor import nlp_extractor


class TrainedFirExtractorTests(unittest.TestCase):
    def test_trained_model_and_identifier_rules_extract_a_case(self):
        text = (
            "Anita Yadav personally reported a cyber fraud near City Center Mall, Jaipur. "
            "Investigators identified Ajay Das as the suspect. Rs. 2,50,000 via UPI "
            "was routed to a Kotak Mahindra account 9363154144. Witness Ramesh Patel "
            "saw Ajay Das using vehicle DL-04-AB-1234."
        )

        result = nlp_extractor.extract_entities(text)

        self.assertEqual("Cyber Fraud", result["crime_type"]["label"])
        self.assertGreaterEqual(result["crime_type"]["confidence"], 0.5)
        self.assertIn("Anita Yadav", result["persons"])
        self.assertIn("Ajay Das", result["persons"])
        self.assertIn("Ramesh Patel", result["persons"])
        self.assertNotIn("Cyber Fraud", result["persons"])
        self.assertNotIn("9363154144", result["phones"])
        self.assertIn("DL-04-AB-1234", result["vehicles"])
        self.assertTrue(any("9363154144" in value for value in result["accounts"]))
        self.assertTrue(any("2,50,000" in value for value in result["transactions"]))

    def test_model_artifact_is_loaded(self):
        self.assertIsNotNone(nlp_extractor.trained_model)
        self.assertEqual(1000, nlp_extractor.trained_model["source"]["baseRows"])
        self.assertEqual(320, nlp_extractor.trained_model["source"]["narrativeAugmentationRows"])

    def test_linked_cases_extract_the_same_suspect_from_narrative_wording(self):
        first = (
            "Witnesses reported that a gang of armed men forcefully entered the premises. "
            "Security footage identified the ringleader as Ramesh Khanna, a known local criminal. "
            "Police are currently tracking Ramesh Khanna and his associates."
        )
        second = (
            "Authorities apprehended Ramesh Khanna at the scene, who was actively processing "
            "Rs. 20,00,000 via wire transfer to offshore accounts. It was confirmed that "
            "Ramesh Khanna was using the facility to wash proceeds from previous robberies."
        )

        first_result = nlp_extractor.extract_entities(first)
        second_result = nlp_extractor.extract_entities(second)

        self.assertIn("Ramesh Khanna", first_result["persons"])
        self.assertIn("Ramesh Khanna", second_result["persons"])
        self.assertTrue(any(
            item["name"] == "Ramesh Khanna" and item["role"] == "suspect"
            for item in first_result["person_roles"]
        ))
        self.assertTrue(any(
            item["name"] == "Ramesh Khanna" and item["role"] == "suspect"
            for item in second_result["person_roles"]
        ))

    def test_unseen_action_wording_extracts_people_without_promoting_locations(self):
        text = (
            "Investigators are searching for Dev Malhotra after the theft. "
            "Dev Malhotra drove a vehicle from South District. "
            "Witness Priya Sen observed the escape."
        )

        result = nlp_extractor.extract_entities(text)

        self.assertIn("Dev Malhotra", result["persons"])
        self.assertIn("Priya Sen", result["persons"])
        self.assertNotIn("South District", result["persons"])


if __name__ == "__main__":
    unittest.main()
