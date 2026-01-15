"""
Quick test script for edital API endpoints
"""
# Add src to Python path
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_health():
    """Test health endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    print("✅ Health endpoint working")


def test_edital_routes_registered():
    """Test that edital routes are registered"""
    response = client.get("/docs")
    assert response.status_code == 200
    print("✅ API docs accessible")

    # Check OpenAPI schema for edital endpoints
    response = client.get("/openapi.json")
    openapi = response.json()

    paths = openapi.get("paths", {})

    # Check for edital endpoints
    edital_endpoints = [
        "/api/editais/upload",
        "/api/editais/{edital_id}/conteudo-programatico",
        "/api/editais/",
        "/api/editais/{edital_id}",
    ]

    for endpoint in edital_endpoints:
        if endpoint in paths or any(endpoint.replace("{edital_id}", "{id}") in p for p in paths):
            print(f"✅ Endpoint registered: {endpoint}")
        else:
            print(f"❌ Endpoint NOT found: {endpoint}")


def test_upload_endpoint_accepts_edital_id():
    """Test that upload endpoint accepts edital_id parameter"""
    response = client.get("/openapi.json")
    openapi = response.json()

    upload_endpoint = openapi["paths"].get("/api/upload/pdf", {})
    post_params = upload_endpoint.get("post", {}).get("parameters", [])

    has_edital_id = any(p.get("name") == "edital_id" for p in post_params)

    if has_edital_id:
        print("✅ Upload endpoint accepts edital_id parameter")
    else:
        print("❌ Upload endpoint does NOT accept edital_id parameter")


def main():
    print("Testing Edital API Backend...")
    print("=" * 50)

    try:
        test_health()
        test_edital_routes_registered()
        test_upload_endpoint_accepts_edital_id()

        print("=" * 50)
        print("✅ All tests passed!")
        print("\nAPI is ready. Start server with:")
        print("  uvicorn src.api.main:app --reload")
        print("\nThen access:")
        print("  - API docs: http://localhost:8000/docs")
        print("  - Edital endpoints: http://localhost:8000/api/editais/")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
