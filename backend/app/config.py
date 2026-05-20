import os
from dotenv import load_dotenv

load_dotenv()

# Absolute path to the backend directory (always correct regardless of CWD)
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_TEXT_MODEL = os.getenv("OLLAMA_TEXT_MODEL", "llama3.2")
    OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(_BACKEND_DIR, 'resume_evaluator.db')}")
    UPLOAD_DIR = os.path.join(_BACKEND_DIR, "uploads")
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretplaceholder")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    API_PREFIX = os.getenv("API_PREFIX", "/api")

settings = Config()
