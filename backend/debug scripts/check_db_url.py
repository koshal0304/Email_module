
import os
from dotenv import load_dotenv

load_dotenv('../.env')
load_dotenv('.env')

db_url = os.getenv("DATABASE_URL")
print(f"DATABASE_URL env var: {db_url}")

from app.config import get_settings
settings = get_settings()
print(f"Settings.database_url: {settings.database_url}")
