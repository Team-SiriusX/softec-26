import os
import tempfile
import os as _os

from openai import AsyncOpenAI

DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_TRANSCRIPTION_MODEL = "openai/whisper-1"


class TranscriptionError(RuntimeError):
    pass


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise TranscriptionError("OPENROUTER_API_KEY is not configured")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=os.getenv("OPENROUTER_BASE_URL", DEFAULT_OPENROUTER_BASE_URL),
    )

    suffix = _os.path.splitext(filename)[1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name

    try:
        with open(temp_path, "rb") as audio_file:
            try:
                transcript = await client.audio.transcriptions.create(
                    model=os.getenv("VOICE_TRANSCRIPTION_MODEL", DEFAULT_TRANSCRIPTION_MODEL),
                    file=audio_file,
                )
            except Exception as exc:
                raise TranscriptionError(str(exc)) from exc
        return transcript.text
    finally:
        if _os.path.exists(temp_path):
            _os.remove(temp_path)
