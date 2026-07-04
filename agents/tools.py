"""Custom tools for the Digital Human ADK agent."""

user_memory: dict[str, str] = {}

def remember_user(key: str, value: str) -> str:
    """Store information the user shares (e.g. name, preferences)."""
    user_memory[key] = value
    return f"OK, I'll remember: {key} = {value}"

def recall_user(key: str) -> str:
    """Recall stored information about the user."""
    return user_memory.get(key, "I don't know")

CUSTOM_TOOLS = [remember_user, recall_user]
