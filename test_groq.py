"""
Quick test script to verify Groq API key
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from src.llm.providers.groq_client import GroqClient


def test_groq():
    """Test Groq API connection"""
    print("🧪 Testing Groq API connection...")
    print()

    try:
        # Initialize client
        client = GroqClient()
        print("✓ Groq client initialized")
        print(f"✓ Using model: {client.model}")
        print()

        # Test simple generation
        print("🔄 Testing text generation...")
        response = client.generate(
            prompt="Diga apenas 'Olá! Sistema funcionando perfeitamente.' em português.",
            temperature=0.1,
            max_tokens=50,
        )

        print("✓ Response received!")
        print()
        print("📝 Generated text:")
        print(response["content"])
        print()
        print(f"📊 Tokens used: {response['tokens']['total']}")
        print(f"⚡ Provider: {response.get('provider', 'N/A')}")
        print()
        print("✅ Groq API is working perfectly!")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    test_groq()
