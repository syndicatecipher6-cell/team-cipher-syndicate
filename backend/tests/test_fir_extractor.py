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
        self.assertEqual(1000, nlp_extractor.trained_model["source"]["rows"])


if __name__ == "__main__":
    unittest.main()
