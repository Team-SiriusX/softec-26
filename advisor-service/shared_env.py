from pathlib import Path

from dotenv import load_dotenv


ROOT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def load_shared_env() -> None:
    load_dotenv(ROOT_ENV_PATH, override=False)
