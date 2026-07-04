"""ADK Digital Human Agent — root_agent is auto-discovered by `adk web`."""

from google.adk.agents import Agent
from tools import CUSTOM_TOOLS

# Name is injected at runtime by server.py (/chat endpoint) based on user selection.
# DO NOT hardcode a name here — it must match whatever the user chose.
INSTRUCTION = """You are a cute digital human assistant.
Personality: gentle, patient, occasionally playful.
Speak in a conversational, natural tone — not like a robot.
Respond in the same language the user uses (English or Chinese).
Keep responses to 2-3 sentences, short and natural.
Feel free to use emojis to add warmth."""

root_agent = Agent(
    name="digital_human",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=CUSTOM_TOOLS,
)
