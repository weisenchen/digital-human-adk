"""
Text-to-Speech — converts text to audio file.

Supports multiple providers with voice character selection.
Default: edge-tts (free, no API key).
"""

import os, uuid
from pathlib import Path

TTS_PROVIDER = os.getenv("TTS_PROVIDER", "edge")
CACHE_DIR = Path(os.getenv("TTS_CACHE_DIR", "/tmp/tts_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── Voice Catalog ──────────────────────────────────────────────────────────
# locale → { gender → [(voice_id, display_name, localized_name), ...] }
VOICE_CATALOG: dict[str, dict[str, list[tuple[str, str, str]]]] = {
    "en-US": {
        "female": [
            ("en-US-JennyNeural",    "Jenny",  "Jenny"),
            ("en-US-AriaNeural",     "Aria",   "Aria"),
            ("en-US-JaneNeural",     "Jane",   "Jane"),
            ("en-US-MichelleNeural", "Michelle", "Michelle"),
            ("en-US-CoraNeural",     "Cora",   "Cora"),
        ],
        "male": [
            ("en-US-GuyNeural",      "Guy",    "Guy"),
            ("en-US-DavisNeural",    "Davis",  "Davis"),
            ("en-US-TonyNeural",     "Tony",   "Tony"),
            ("en-US-BrandonNeural",  "Brandon","Brandon"),
            ("en-US-EricNeural",     "Eric",   "Eric"),
        ],
    },
    "en-GB": {
        "female": [
            ("en-GB-SoniaNeural",    "Sonia",  "Sonia"),
            ("en-GB-LibbyNeural",    "Libby",  "Libby"),
            ("en-GB-AdaNeural",      "Ada",    "Ada"),
        ],
        "male": [
            ("en-GB-RyanNeural",     "Ryan",   "Ryan"),
            ("en-GB-ThomasNeural",   "Thomas", "Thomas"),
            ("en-GB-AlfieNeural",    "Alfie",  "Alfie"),
        ],
    },
    "cmn-CN": {  # Mandarin Chinese
        "female": [
            ("zh-CN-XiaoxiaoNeural", "Xiaoxiao",  "小笑"),
            ("zh-CN-XiaohanNeural",  "Xiaohan",   "晓涵"),
            ("zh-CN-XiaomoNeural",   "Xiaomo",    "小墨"),
            ("zh-CN-XiaoyiNeural",   "Xiaoyi",    "小伊"),
        ],
        "male": [
            ("zh-CN-YunxiNeural",    "Yunxi",     "云希"),
            ("zh-CN-YunjianNeural",  "Yunjian",   "云健"),
            ("zh-CN-YunyangNeural",  "Yunyang",   "云扬"),
            ("zh-CN-YunhaoNeural",   "Yunhao",    "云浩"),
        ],
    },
    "Yue-HK": {  # Cantonese
        "female": [
            ("zh-HK-HiuGaaiNeural",  "HiuGaai",   "晓佳"),
            ("zh-HK-HiuMaanNeural",  "HiuMaan",   "晓敏"),
        ],
        "male": [
            ("zh-HK-WanLungNeural",  "WanLung",   "云龙"),
        ],
    },
    "ja-JP": {
        "female": [
            ("ja-JP-NanamiNeural",   "Nanami",    "七海"),
            ("ja-JP-KeitaNeural",    "Keita",     "慶太"),
        ],
        "male": [
            ("ja-JP-KeitaNeural",    "Keita",     "慶太"),
        ],
    },
    "ko-KR": {
        "female": [
            ("ko-KR-SunHiNeural",    "SunHi",     "선희"),
            ("ko-KR-JiMinNeural",    "JiMin",     "지민"),
        ],
        "male": [
            ("ko-KR-InJoonNeural",   "InJoon",    "인준"),
            ("ko-KR-BongJinNeural",  "BongJin",   "봉진"),
        ],
    },
    "fr-FR": {
        "female": [
            ("fr-FR-DeniseNeural",   "Denise",    "Denise"),
            ("fr-FR-EliseNeural",    "Elise",     "Élise"),
        ],
        "male": [
            ("fr-FR-HenriNeural",    "Henri",     "Henri"),
        ],
    },
}

# Locale-appropriate popular names (for agent persona naming)
POPULAR_NAMES: dict[str, dict[str, list[str]]] = {
    "en-US": {
        "female": ["Olivia", "Emma", "Charlotte", "Amelia", "Sophia", "Ava", "Isabella", "Mia", "Evelyn", "Luna"],
        "male":   ["Liam", "Noah", "Oliver", "James", "William", "Elijah", "Benjamin", "Lucas", "Henry", "Alexander"],
    },
    "en-GB": {
        "female": ["Olivia", "Amelia", "Isla", "Ava", "Ivy", "Freya", "Lily", "Florence", "Ella", "Evie"],
        "male":   ["Oliver", "George", "Arthur", "Noah", "Muhammad", "Leo", "Harry", "Oscar", "Jack", "Charlie"],
    },
    "cmn-CN": {
        "female": ["小薇", "小美", "小雨", "小琳", "小娜", "小悦", "小雪", "小蝶", "小慧", "小琪"],
        "male":   ["小明", "小刚", "志强", "云浩", "伟杰", "子轩", "浩然", "俊杰", "天宇", "宇航"],
    },
    "Yue-HK": {
        "female": ["小慧", "小琳", "小美", "小晴", "小琪"],
        "male":   ["小明", "家豪", "志强", "俊杰", "偉倫"],
    },
    "ja-JP": {
        "female": ["さくら", "ひなた", "ゆい", "あかり", "みお"],
        "male":   ["そうた", "はると", "こうき", "ゆうと", "りく"],
    },
    "ko-KR": {
        "female": ["지은", "서연", "하은", "수진", "예진"],
        "male":   ["지성", "민준", "도윤", "예준", "지호"],
    },
    "fr-FR": {
        "female": ["Louise", "Emma", "Alice", "Chloé", "Léa", "Manon", "Juliette", "Camille", "Sarah", "Jade"],
        "male":   ["Gabriel", "Léo", "Jules", "Louis", "Adam", "Lucas", "Ashton", "Ethan", "Raphaël", "Noah"],
    },
}


def list_voices() -> list[dict]:
    """Return flat voice list with locale, gender, voice_id, display_name, localized_name."""
    result = []
    for locale, genders in VOICE_CATALOG.items():
        for gender, voices in genders.items():
            names = POPULAR_NAMES.get(locale, {}).get(gender, [])
            for i, (voice_id, display_name, localized_name) in enumerate(voices):
                result.append({
                    "voice_id": voice_id,
                    "display_name": display_name,
                    "localized_name": localized_name,
                    "locale": locale,
                    "gender": gender,
                    "popular_names": names,
                })
    return result


def get_default_voice(language: str = "en", gender: str = "female") -> str:
    """Return default voice for a given language code and gender."""
    locale_map = {
        "en": "en-US", "zh": "cmn-CN", "yue": "Yue-HK",
        "ja": "ja-JP", "ko": "ko-KR", "fr": "fr-FR",
    }
    locale = locale_map.get(language, "en-US")
    voices = VOICE_CATALOG.get(locale, {}).get(gender, [])
    return voices[0][0] if voices else "en-US-JennyNeural"


async def synthesize(text: str, language: str = "en", voice: str | None = None) -> str:
    """Convert text to an audio file. Returns the file path.

    Args:
        text: Text to synthesize.
        language: Language code (en, zh, yue, ja, ko, fr).
        voice: Edge TTS voice name. If None, defaults from VOICE_CATALOG.
    """
    if TTS_PROVIDER == "edge":
        return await _edge_tts(text, voice or get_default_voice(language))
    elif TTS_PROVIDER == "google":
        return await _google_tts(text, language, voice)
    elif TTS_PROVIDER == "openai":
        return await _openai_tts(text, language)
    raise ValueError(f"Unknown TTS provider: {TTS_PROVIDER}")


async def _edge_tts(text: str, voice: str) -> str:
    """Edge TTS (free, no API key)."""
    import edge_tts
    out_path = CACHE_DIR / f"tts_{uuid.uuid4().hex}.mp3"
    await edge_tts.Communicate(text, voice).save(str(out_path))
    return str(out_path)


async def _google_tts(text: str, language: str, voice: str | None = None) -> str:
    """Google Cloud Text-to-Speech."""
    from google.cloud import texttospeech
    client = texttospeech.TextToSpeechClient()
    lang_code = "zh-CN" if language == "zh" else language
    voice_name = voice or ("zh-CN-Wavenet-A" if language == "zh" else "en-US-Neural2-D")
    name_to_gender = {
        "female": texttospeech.SsmlVoiceGender.FEMALE,
        "male": texttospeech.SsmlVoiceGender.MALE,
    }
    # Try to guess gender from voice name keywords
    gender = texttospeech.SsmlVoiceGender.FEMALE
    for g_key, g_val in name_to_gender.items():
        if g_key in voice_name.lower():
            gender = g_val
            break
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice_name,
            ssml_gender=gender,
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
