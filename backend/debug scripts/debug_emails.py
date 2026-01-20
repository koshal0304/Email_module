import os
import sys

sys.path.append(os.getcwd())

from app.database import SessionLocal
from models.email import Email

db = SessionLocal()

print("\n=== Email Timestamps Debug ===\n")

emails = db.query(Email).order_by(Email.received_date_time.desc()).limit(10).all()

for i, e in enumerate(emails):
    print(f"{i+1}. Subject: {e.subject[:40]}...")
    print(f"   from: {e.from_address}")
    print(f"   received_date_time: {e.received_date_time}")
    print(f"   sent_date_time: {e.sent_date_time}")
    print()

db.close()
