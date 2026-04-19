import os
import tempfile
import os as _os

from openai import AsyncOpenAI


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    client = AsyncOpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url=os.getenv("OPENROUTER_BASE_URL"),
    )

    suffix = _os.path.splitext(filename)[1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name

    try:
        with open(temp_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="openai/whisper-1",
                file=audio_file,
            )
        return transcript.text
    finally:
        if _os.path.exists(temp_path):
            _os.remove(temp_path)
