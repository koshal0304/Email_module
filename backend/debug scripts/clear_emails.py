
import os
import sys

sys.path.append(os.getcwd())

from app.database import SessionLocal
from models.email import Email, EmailThread

def clear_emails():
    db = SessionLocal()
    try:
        print("Clearing all emails and threads...")
        db.query(Email).delete()
        db.query(EmailThread).delete()
        db.commit()
        print("Successfully cleared all emails and threads.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_emails()
