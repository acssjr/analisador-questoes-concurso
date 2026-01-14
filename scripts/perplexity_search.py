#!/usr/bin/env python3
"""
Perplexity AI Search CLI

Web search with AI-powered answers, deep research, and chain-of-thought reasoning.

Models:
  - sonar: Lightweight search with grounding
  - sonar-pro: Advanced search for complex queries
  - sonar-reasoning-pro: Chain of thought reasoning
  - sonar-deep-research: Expert-level exhaustive research

Usage:
  python scripts/perplexity_search.py --ask "quick question"
  python scripts/perplexity_search.py --search "topic" --max-results 5
  python scripts/perplexity_search.py --research "compare X vs Y"
  python scripts/perplexity_search.py --reason "should I use X or Y?"
  python scripts/perplexity_search.py --deep "comprehensive topic"
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)


# Model mapping
MODELS = {
    "ask": "sonar",
    "search": "sonar",
    "research": "sonar-pro",
    "reason": "sonar-reasoning-pro",
    "deep": "sonar-deep-research",
}

API_URL = "https://api.perplexity.ai/chat/completions"


def load_api_key() -> str:
    """Load API key from environment or .env files."""
    # Check environment first
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if api_key:
        return api_key

    # Check .env files
    env_paths = [
        Path.home() / ".claude" / ".env",
        Path.cwd() / ".env",
    ]

    for env_path in env_paths:
        if env_path.exists():
            try:
                content = env_path.read_text(encoding="utf-8")
                for line in content.split("\n"):
                    line = line.strip()
                    if line.startswith("PERPLEXITY_API_KEY=") and not line.startswith("#"):
                        key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if key:
                            return key
            except Exception:
                continue

    return ""


def search_perplexity(
    query: str,
    model: str = "sonar",
    max_tokens: int = 1024,
    temperature: float = 0.2,
    search_recency: Optional[str] = None,
    search_domain_filter: Optional[list] = None,
) -> dict:
    """
    Call Perplexity API.

    Args:
        query: The search query or question
        model: Model to use (sonar, sonar-pro, sonar-reasoning-pro, sonar-deep-research)
        max_tokens: Maximum tokens in response
        temperature: Response temperature (0-1)
        search_recency: Filter by recency (day, week, month, year)
        search_domain_filter: List of domains to filter

    Returns:
        dict with 'answer', 'citations', 'model', 'usage'
    """
    api_key = load_api_key()
    if not api_key:
        return {"error": "PERPLEXITY_API_KEY not found. Set in environment or ~/.claude/.env"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": query}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    # Add search options if provided
    if search_recency:
        payload["search_recency_filter"] = search_recency
    if search_domain_filter:
        payload["search_domain_filter"] = search_domain_filter

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=120)

        if response.status_code == 200:
            data = response.json()
            return {
                "answer": data["choices"][0]["message"]["content"],
                "citations": data.get("citations", []),
                "model": model,
                "usage": data.get("usage", {}),
            }
        else:
            return {"error": f"API error {response.status_code}: {response.text}"}

    except requests.exceptions.Timeout:
        return {"error": "Request timed out (120s). Try a simpler query."}
    except Exception as e:
        return {"error": f"Request failed: {str(e)}"}


def format_output(result: dict, output_format: str = "text") -> str:
    """Format the result for display."""
    if "error" in result:
        return f"ERROR: {result['error']}"

    if output_format == "json":
        return json.dumps(result, indent=2, ensure_ascii=False)

    # Text format
    lines = []
    lines.append(f"Model: {result['model']}")
    lines.append("-" * 50)
    lines.append(result["answer"])

    if result.get("citations"):
        lines.append("")
        lines.append(f"Sources ({len(result['citations'])}):")
        for i, citation in enumerate(result["citations"], 1):
            lines.append(f"  [{i}] {citation}")

    if result.get("usage"):
        usage = result["usage"]
        lines.append("")
        lines.append(f"Tokens: {usage.get('total_tokens', 'N/A')}")

    return "\n".join(lines)


def main():
    # Fix Windows console encoding
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        description="Perplexity AI Search CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --ask "What is Python 3.12 new features?"
  %(prog)s --search "FastAPI best practices" --max-results 5
  %(prog)s --research "compare PostgreSQL vs MongoDB for analytics"
  %(prog)s --reason "should I use microservices or monolith?"
  %(prog)s --deep "comprehensive guide to LLM rate limiting"
        """,
    )

    # Query modes (mutually exclusive)
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--ask", metavar="QUERY", help="Quick question (sonar)")
    mode_group.add_argument("--search", metavar="QUERY", help="Web search (sonar)")
    mode_group.add_argument("--research", metavar="QUERY", help="AI research (sonar-pro)")
    mode_group.add_argument("--reason", metavar="QUERY", help="Chain-of-thought (sonar-reasoning-pro)")
    mode_group.add_argument("--deep", metavar="QUERY", help="Deep research (sonar-deep-research)")

    # Search options
    parser.add_argument("--max-results", type=int, default=10, help="Max results (1-20)")
    parser.add_argument("--recency", choices=["day", "week", "month", "year"], help="Filter by recency")
    parser.add_argument("--domains", nargs="+", help="Limit to specific domains")

    # Output options
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--max-tokens", type=int, default=1024, help="Max response tokens")

    args = parser.parse_args()

    # Determine mode and query
    if args.ask:
        mode, query = "ask", args.ask
    elif args.search:
        mode, query = "search", args.search
    elif args.research:
        mode, query = "research", args.research
    elif args.reason:
        mode, query = "reason", args.reason
    elif args.deep:
        mode, query = "deep", args.deep
    else:
        parser.error("No query mode specified")

    model = MODELS[mode]

    # For search mode, modify query to request ranked results
    if mode == "search":
        query = f"Search for: {query}\n\nProvide {args.max_results} relevant results with titles and URLs."

    # Execute search
    result = search_perplexity(
        query=query,
        model=model,
        max_tokens=args.max_tokens,
        search_recency=args.recency,
        search_domain_filter=args.domains,
    )

    # Format and print output
    output_format = "json" if args.json else "text"
    print(format_output(result, output_format))

    # Exit with error code if failed
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
