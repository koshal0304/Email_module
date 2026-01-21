
import os
import sys

sys.path.append(os.getcwd())

from app.database import SessionLocal
from models.user import User

def delete_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            print(f"Deleting user: {user.email} ({user.id})")
            db.delete(user)
            db.commit()
            print("User deleted successfully.")
        else:
            print("User not found.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    delete_user("baff9167-804f-479f-8eea-45726201bdc1")
