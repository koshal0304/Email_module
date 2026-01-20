
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from app.database import SessionLocal
from models.user import User

def get_user_id():
    db = SessionLocal()
    try:
        email = "koshalkumar2000@outlook.com"
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            print(f"User Found:")
            print(f"Email: {user.email}")
            print(f"ID: {user.id}")
            print(f"Active: {user.is_active}")
            print(f"Has Access Token: {bool(user.access_token)}")
        else:
            print(f"User with email {email} not found.")
            
            # List all users
            users = db.query(User).all()
            print(f"\nAll Users ({len(users)}):")
            for u in users:
                print(f"- {u.email} ({u.id})")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    get_user_id()
