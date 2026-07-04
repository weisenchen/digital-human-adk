"""OpenAI-compatible API clients for non-Gemini models (DeepSeek, Claude, etc.)."""

import os, logging
from openai import OpenAI

logger = logging.getLogger("digital-human.model_clients")

# ── Model Catalog ──────────────────────────────────────────────────────────
# Each entry: backend type ("openai" = OpenAI-compat API call, "adk" = ADK Agent)
MODEL_CATALOG: dict[str, dict] = {
    # ADK-native Gemini models
    "gemini-2.5-flash": {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "Google",
        "backend": "adk",
    },
    "gemini-2.5-pro": {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "provider": "Google",
        "backend": "adk",
    },
    # DeepSeek (OpenAI-compatible)
    "deepseek-chat": {
        "id": "deepseek-chat",
        "name": "DeepSeek V4",
        "provider": "DeepSeek",
        "backend": "openai",
        "api_base": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        "api_key_env": "DEEPSEEK_API_KEY",
        "model": "deepseek-chat",
    },
    "deepseek-reasoner": {
        "id": "deepseek-reasoner",
        "name": "DeepSeek R1",
        "provider": "DeepSeek",
        "backend": "openai",
        "api_base": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        "api_key_env": "DEEPSEEK_API_KEY",
        "model": "deepseek-reasoner",
    },
    # Claude via OpenRouter
    "anthropic/claude-sonnet-4": {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4",
        "provider": "Anthropic",
        "backend": "openai",
        "api_base": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "model": "anthropic/claude-sonnet-4",
    },
    "anthropic/claude-haiku-3.5": {
        "id": "anthropic/claude-haiku-3.5",
        "name": "Claude Haiku 3.5",
        "provider": "Anthropic",
        "backend": "openai",
        "api_base": "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "model": "anthropic/claude-haiku-3.5",
    },
}


def get_openai_client(model_id: str) -> OpenAI | None:
    """Return an OpenAI client for the given model, or None if not available."""
    info = MODEL_CATALOG.get(model_id)
    if not info or info["backend"] != "openai":
        return None
    api_key = os.getenv(info["api_key_env"])
    if not api_key:
        logger.warning("API key missing for model %s (env: %s)", model_id, info["api_key_env"])
        return None
    return OpenAI(api_key=api_key, base_url=info["api_base"])


def list_api_models() -> list[dict]:
    """Return frontend-safe model list (no keys)."""
    result = []
    for mid, info in MODEL_CATALOG.items():
        if info["backend"] == "openai":
            key_ok = bool(os.getenv(info["api_key_env"]))
        else:
            key_ok = True  # Gemini uses GOOGLE_API_KEY, always available
        result.append({
            "id": mid,
            "name": info["name"],
            "provider": info["provider"],
            "backend": info["backend"],
            "available": key_ok,
        })
    return result
