import os
import sys

sys.path.append(os.getcwd())

from app.database import SessionLocal
from models.email import EmailThread

db = SessionLocal()

print("\n=== Thread Sorting Debug ===\n")

threads = db.query(EmailThread).order_by(EmailThread.last_activity_at.desc()).limit(10).all()

for i, t in enumerate(threads):
    print(f"{i+1}. Subject: {t.subject[:50]}...")
    print(f"   last_activity_at: {t.last_activity_at}")
    print(f"   message_count: {t.message_count}")
    print()

db.close()
