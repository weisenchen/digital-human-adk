"""Speech-to-Text — converts user audio to text."""

import os, io

STT_PROVIDER = os.getenv("STT_PROVIDER", "google")

async def transcribe_audio(audio_bytes: bytes, language: str = "en") -> str:
    """Transcribe audio bytes to text string."""
    if STT_PROVIDER == "google":
        return await _google_stt(audio_bytes, language)
    elif STT_PROVIDER == "whisper":
        return await _whisper_stt(audio_bytes, language)
    raise ValueError(f"Unknown STT provider: {STT_PROVIDER}")

async def _google_stt(audio_bytes: bytes, language: str) -> str:
    """Google Cloud Speech-to-Text."""
    from google.cloud import speech
    client = speech.SpeechClient()
    audio = speech.RecognitionAudio(content=audio_bytes)
    lang_code = "zh-CN" if language == "zh" else language
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.MP3,
        sample_rate_hertz=16000,
        language_code=lang_code,
        model="latest_short",
    )
    response = client.recognize(config=config, audio=audio)
    return response.results[0].alternatives[0].transcript if response.results else ""

async def _whisper_stt(audio_bytes: bytes, language: str) -> str:
    """OpenAI Whisper API."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    buf = io.BytesIO(audio_bytes)
    buf.name = "audio.mp3"
    transcript = await client.audio.transcriptions.create(
        model="whisper-1", file=buf, language=language,
    )
    return transcript.text
