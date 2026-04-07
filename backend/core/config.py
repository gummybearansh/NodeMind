import os
from dotenv import load_dotenv

env_path = os.path.join(os.getcwd(), ".env")
load_dotenv(env_path)

class Settings:
    def __init__(self):
        self.mongodb_uri = os.getenv("MONGO_DB_URL", "mongodb://localhost:27017")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.chroma_persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./.chroma")

    def is_configured(self):
        """Returns True if the mandatory Gemini API key is present and not a placeholder."""
        placeholder = "your_gemini_api_key_here"
        return bool(self.gemini_api_key and self.gemini_api_key.strip() and self.gemini_api_key != placeholder)

settings = Settings()
