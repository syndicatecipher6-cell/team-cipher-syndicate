import io
import unittest

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

from app.hardening import RateLimitMiddleware, RequestSizeLimitMiddleware, read_validated_uploads
from app.main import app


def upload(filename: str, content: bytes, content_type: str = "text/plain") -> UploadFile:
    return UploadFile(
        filename=filename,
        file=io.BytesIO(content),
        headers=Headers({"content-type": content_type}),
    )


class UploadSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_valid_utf8_text_upload_is_accepted(self):
        result = await read_validated_uploads(
            [upload("case.txt", b"Suspect Ramesh Kumar was arrested.")],
            max_files=2,
            max_total_bytes=1024,
        )
        self.assertEqual("case.txt", result[0][0])
        self.assertIn("Ramesh Kumar", result[0][3])

    async def test_path_traversal_filename_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            await read_validated_uploads(
                [upload("../case.txt", b"test")],
                max_files=2,
                max_total_bytes=1024,
            )
        self.assertEqual(400, raised.exception.status_code)

    async def test_disguised_binary_and_oversized_uploads_are_rejected(self):
        with self.assertRaises(HTTPException) as binary_error:
            await read_validated_uploads(
                [upload("case.txt", b"safe\x00binary")],
                max_files=2,
                max_total_bytes=1024,
            )
        self.assertEqual(400, binary_error.exception.status_code)

        with self.assertRaises(HTTPException) as size_error:
            await read_validated_uploads(
                [upload("case.txt", b"12345")],
                max_files=2,
                max_total_bytes=4,
            )
        self.assertEqual(413, size_error.exception.status_code)


class HttpSecurityTests(unittest.TestCase):
    def test_sensitive_responses_have_security_headers_and_docs_are_disabled(self):
        client = TestClient(app)
        response = client.get("/health")
        self.assertEqual(200, response.status_code)
        self.assertEqual("no-store", response.headers["cache-control"])
        self.assertEqual("nosniff", response.headers["x-content-type-options"])
        self.assertEqual("DENY", response.headers["x-frame-options"])
        self.assertEqual(404, client.get("/docs").status_code)

    def test_request_size_and_rate_limits_return_standard_errors(self):
        limited_app = FastAPI()
        limited_app.add_middleware(RequestSizeLimitMiddleware, max_request_bytes=4)
        limited_app.add_middleware(RateLimitMiddleware, requests_per_window=2, window_seconds=60)

        @limited_app.post("/work")
        def work():
            return {"ok": True}

        client = TestClient(limited_app)
        self.assertEqual(413, client.post("/work", content=b"12345").status_code)
        self.assertEqual(200, client.post("/work").status_code)
        limited = client.post("/work")
        self.assertEqual(429, limited.status_code)
        self.assertIn("Retry-After", limited.headers)


if __name__ == "__main__":
    unittest.main()
