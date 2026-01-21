
import os
from dotenv import load_dotenv

load_dotenv('../.env')
load_dotenv('.env')

key = os.getenv("ENCRYPTION_KEY")
print(f"ENCRYPTION_KEY set: {bool(key)}")
if key:
    print(f"Key length: {len(key)}")
else:
    print("ENCRYPTION_KEY is NOT set. Generating random key on startup.")
