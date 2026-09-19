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
        self.assertEqual(3000, nlp_extractor.trained_model["source"]["baseRows"])
        self.assertEqual(480, nlp_extractor.trained_model["source"]["narrativeAugmentationRows"])

    def test_six_role_narrative_extracts_complete_names_and_roles(self):
        text = (
            "Following the report submitted by Dr. Neha Raj Kumar Gowda, an inquiry began. "
            "Investigating officer Ravi Singh Devi Roy oversaw the search operations. "
            "According to Vijay Kumar Chauhan, who witnessed the robbery, the perpetrators fled. "
            "Ashok Pratap Devi Rajput faces accusations of Organized Robbery. "
            "Restitution is sought for Dinesh Reddy, the primary victim of the robbery. "
            "Detectives ruled out Fatima Kaur Gowda after verifying their alibi."
        )

        result = nlp_extractor.extract_entities(text)
        roles = {item["name"]: item["role"] for item in result["person_roles"]}

        self.assertEqual("complainant", roles["Dr. Neha Raj Kumar Gowda"])
        self.assertEqual("officer", roles["Ravi Singh Devi Roy"])
        self.assertEqual("witness", roles["Vijay Kumar Chauhan"])
        self.assertEqual("suspect", roles["Ashok Pratap Devi Rajput"])
        self.assertEqual("victim", roles["Dinesh Reddy"])
        self.assertEqual("person of interest", roles["Fatima Kaur Gowda"])
        self.assertNotIn("Neha Raj", result["persons"])

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

    def test_vehicle_model_is_not_promoted_as_a_person(self):
        text = (
            "A black Toyota Innova bearing registration KA-01-AB-1234 was intercepted. "
            "The driver, identified as Suraj Verma, was arrested immediately."
        )

        loaded_nlp = nlp_extractor.nlp
        try:
            # Vercel's lightweight function does not install the optional
            # spaCy model, so the deterministic path must stand on its own.
            nlp_extractor.nlp = None
            result = nlp_extractor.extract_entities(text)
        finally:
            nlp_extractor.nlp = loaded_nlp

        self.assertNotIn("Toyota Innova", result["persons"])
        self.assertIn("Suraj Verma", result["persons"])
        self.assertTrue(any(
            item["name"] == "Suraj Verma" and item["role"] == "suspect"
            for item in result["person_roles"]
        ))


if __name__ == "__main__":
    unittest.main()
