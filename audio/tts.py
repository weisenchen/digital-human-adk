"""Text-to-Speech — converts text to audio file."""

import os, uuid
from pathlib import Path

TTS_PROVIDER = os.getenv("TTS_PROVIDER", "google")
CACHE_DIR = Path(os.getenv("TTS_CACHE_DIR", "/tmp/tts_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

async def synthesize(text: str, language: str = "en") -> str:
    """Convert text to an audio file. Returns the file path."""
    if TTS_PROVIDER == "google":
        return await _google_tts(text, language)
    elif TTS_PROVIDER == "openai":
        return await _openai_tts(text, language)
    elif TTS_PROVIDER == "edge":
        return await _edge_tts(text, language)
    raise ValueError(f"Unknown TTS provider: {TTS_PROVIDER}")

async def _google_tts(text: str, language: str) -> str:
    """Google Cloud Text-to-Speech."""
    from google.cloud import texttospeech
    client = texttospeech.TextToSpeechClient()
    lang_code = "zh-CN" if language == "zh" else language
    voice_name = "zh-CN-Wavenet-A" if language == "zh" else "en-US-Neural2-D"
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice_name,
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
        ),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
        ),
    )
    out_path = CACHE_DIR / f"tts_{uuid.uuid4().hex}.mp3"
    out_path.write_bytes(response.audio_content)
    return str(out_path)

async def _openai_tts(text: str, language: str) -> str:
    """OpenAI TTS API."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    voice = "nova" if language == "zh" else "alloy"
    response = await client.audio.speech.create(
        model="tts-1", voice=voice, input=text,
    )
    out_path = CACHE_DIR / f"tts_{uuid.uuid4().hex}.mp3"
    out_path.write_bytes(response.content)
    return str(out_path)

async def _edge_tts(text: str, language: str) -> str:
    """Edge TTS (free, no API key)."""
    import edge_tts
    voice = "zh-CN-XiaoxiaoNeural" if language == "zh" else "en-US-JennyNeural"
    out_path = CACHE_DIR / f"tts_{uuid.uuid4().hex}.mp3"
    await edge_tts.Communicate(text, voice).save(str(out_path))
    return str(out_path)
