"""
Email CRUD routes.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from models.user import User
from models.email import EmailType
from services.email_service import EmailService
from services.auth_service import AuthService
from services.graph_service import GraphService
from utils.decorators import get_current_user
from utils.exceptions import EmailNotFoundError

settings = get_settings()
router = APIRouter(prefix="/emails", tags=["Emails"])


# Request/Response Models
class AttachmentRequest(BaseModel):
    filename: str
    content_bytes: str  # Base64 encoded
    content_type: str
    is_inline: bool = False


class SendEmailRequest(BaseModel):
    to_recipients: List[EmailStr]
    subject: str
    body: str
    body_type: str = "HTML"
    cc_recipients: Optional[List[EmailStr]] = None
    bcc_recipients: Optional[List[EmailStr]] = None
    attachments: Optional[List[AttachmentRequest]] = None
    thread_id: Optional[str] = None
    client_id: Optional[str] = None
    signature_id: Optional[str] = None


class UpdateEmailRequest(BaseModel):
    is_read: Optional[bool] = None
    is_flagged: Optional[bool] = None
    is_archived: Optional[bool] = None


# Routes

@router.get("")
async def list_emails(
    email_type: Optional[str] = Query(None, description="Filter by email type"),
    client_id: Optional[str] = Query(None, description="Filter by client"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    is_flagged: Optional[bool] = Query(None, description="Filter by flagged status"),
    direction: Optional[str] = Query(None, description="Filter by direction (incoming/outgoing)"),
    search: Optional[str] = Query(None, description="Search in subject and body"),
    limit: int = Query(50, le=100, description="Number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List emails with optional filtering and pagination.
    """
    service = EmailService(db)
    
    return service.list_emails(
        user=current_user,
        email_type=email_type,
        client_id=client_id,
        is_read=is_read,
        is_flagged=is_flagged,
        direction=direction,
        search=search,
        limit=limit,
        offset=offset
    )


@router.get("/types")
async def get_email_types():
    """
    Get available email types for filtering.
    """
    from services.classification_service import EmailClassifier
    
    return {
        "types": [
            {
                "value": t.value,
                "label": EmailClassifier.get_type_display_name(t)
            }
            for t in EmailType
        ]
    }


@router.get("/sync")
async def sync_emails(
    folder: str = Query("inbox", description="Folder to sync"),
    limit: int = Query(50, le=100, description="Number of emails to sync"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually sync emails from Outlook.
    """
    try:
        # Get valid access token
        access_token = AuthService.get_valid_access_token(db, current_user)
        
        # Create Graph service
        graph = GraphService(access_token)
        
        folders_to_sync = ["inbox", "sentitems"]
        if folder and folder not in folders_to_sync:
             # If user specifically requested something else, respect it
             folders_to_sync = [folder]
        
        synced = []
        
        for folder_name in folders_to_sync:
            # Fetch emails
            result = graph.list_messages(folder=folder_name, limit=limit)
             
            # Sync each email
            service = EmailService(db, graph)
             
            for email_data in result.get("value", []):
                try:
                    email = service.sync_email_from_graph(email_data, current_user)
                    synced.append(email.id)
                except Exception as e:
                    # Log error but continue with other emails
                    import traceback
                    traceback.print_exc()
                    print(f"Error syncing email in {folder_name}: {e}")
        
        return {
            "message": f"Synced {len(synced)} emails from {', '.join(folders_to_sync)}",
            "synced_count": len(synced),
            "synced_ids": synced
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{email_id}")
async def get_email(
    email_id: str,
    mark_as_read: bool = Query(True, description="Mark as read when fetched"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single email by ID.
    """
    service = EmailService(db)
    email = service.get_email(email_id, current_user, mark_as_read)
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return email.to_dict()


@router.post("")
async def send_email(
    payload: SendEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a new email.
    """
    try:
        # Get valid access token
        access_token = AuthService.get_valid_access_token(db, current_user)
        
        # Create Graph service
        graph = GraphService(access_token)
        service = EmailService(db, graph)
        
        # Get signature if specified
        signature_html = None
        if payload.signature_id:
            from models.signature import EmailSignature
            sig = db.query(EmailSignature).filter(
                EmailSignature.id == payload.signature_id,
                EmailSignature.user_id == current_user.id
            ).first()
            if sig:
                signature_html = sig.signature_html
        
        # Send email
        email = service.send_email(
            user=current_user,
            to_recipients=payload.to_recipients,
            subject=payload.subject,
            body=payload.body,
            body_type=payload.body_type,
            cc_recipients=payload.cc_recipients,
            bcc_recipients=payload.bcc_recipients,
            thread_id=payload.thread_id,
            client_id=payload.client_id,
            signature_html=signature_html,
            attachments=[a.dict() for a in payload.attachments] if payload.attachments else None
        )
        
        return {
            "message": "Email sent successfully",
            "email": email.to_dict()
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[EMAIL SEND ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{email_id}")
async def update_email(
    email_id: str,
    payload: UpdateEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update email properties (read status, flags, archive).
    """
    service = EmailService(db)
    
    email = service.update_email(
        email_id=email_id,
        user=current_user,
        is_read=payload.is_read,
        is_flagged=payload.is_flagged,
        is_archived=payload.is_archived
    )
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {
        "message": "Email updated",
        "email": email.to_dict(include_body=False)
    }


@router.delete("/{email_id}")
async def delete_email(
    email_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an email.
    """
    service = EmailService(db)
    
    if not service.delete_email(email_id, current_user):
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Email deleted"}


@router.post("/{email_id}/mark-read")
async def mark_email_read(
    email_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark email as read."""
    service = EmailService(db)
    email = service.update_email(email_id, current_user, is_read=True)
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Marked as read"}


@router.post("/{email_id}/mark-unread")
async def mark_email_unread(
    email_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark email as unread."""
    service = EmailService(db)
    email = service.update_email(email_id, current_user, is_read=False)
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Marked as unread"}


@router.post("/{email_id}/flag")
async def flag_email(
    email_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Flag an email."""
    service = EmailService(db)
    email = service.update_email(email_id, current_user, is_flagged=True)
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Email flagged"}


@router.post("/{email_id}/unflag")
async def unflag_email(
    email_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unflag an email."""
    service = EmailService(db)
    email = service.update_email(email_id, current_user, is_flagged=False)
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"message": "Email unflagged"}
