"""
Email thread routes.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from models.user import User
from models.email import EmailThread, ThreadStatus
from services.email_service import EmailService
from utils.decorators import get_current_user

router = APIRouter(prefix="/threads", tags=["Threads"])


class UpdateThreadRequest(BaseModel):
    status: Optional[str] = None
    is_archived: Optional[bool] = None
    is_flagged: Optional[bool] = None


@router.get("")
async def list_threads(
    email_type: Optional[str] = Query(None, description="Filter by email type"),
    client_id: Optional[str] = Query(None, description="Filter by client"),
    status: Optional[str] = Query(None, description="Filter by status"),
    is_archived: bool = Query(False, description="Include archived threads"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List email threads with filtering.
    """
    query = db.query(EmailThread)
    
    if email_type:
        query = query.filter(EmailThread.email_type == email_type)
    
    if client_id:
        query = query.filter(EmailThread.client_id == client_id)
    
    if status:
        query = query.filter(EmailThread.status == status)
    
    if not is_archived:
        query = query.filter(EmailThread.is_archived == False)
    
    total = query.count()
    
    threads = query.order_by(
        EmailThread.last_activity_at.desc()
    ).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "threads": [t.to_dict(include_preview=True) for t in threads]
    }


@router.get("/statuses")
async def get_thread_statuses():
    """
    Get available thread statuses.
    """
    return {
        "statuses": [
            {"value": s.value, "label": s.value.replace("_", " ").title()}
            for s in ThreadStatus
        ]
    }


@router.get("/{thread_id}")
async def get_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a thread with all its emails.
    """
    service = EmailService(db)
    thread = service.get_thread(thread_id, current_user)
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    return thread


@router.patch("/{thread_id}")
async def update_thread(
    thread_id: str,
    payload: UpdateThreadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update thread properties.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    if payload.status:
        if payload.status not in [s.value for s in ThreadStatus]:
            raise HTTPException(status_code=400, detail="Invalid status")
        thread.status = payload.status
    
    if payload.is_archived is not None:
        thread.is_archived = payload.is_archived
    
    if payload.is_flagged is not None:
        thread.is_flagged = payload.is_flagged
    
    db.commit()
    
    return {
        "message": "Thread updated",
        "thread": thread.to_dict()
    }


@router.post("/{thread_id}/resolve")
async def resolve_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark thread as resolved.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    thread.status = ThreadStatus.RESOLVED.value
    db.commit()
    
    return {"message": "Thread resolved"}


@router.post("/{thread_id}/reopen")
async def reopen_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reopen a resolved thread.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    thread.status = ThreadStatus.AWAITING_REPLY.value
    db.commit()
    
    return {"message": "Thread reopened"}


@router.post("/{thread_id}/archive")
async def archive_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Archive a thread.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    thread.is_archived = True
    thread.status = ThreadStatus.ARCHIVED.value
    db.commit()
    
    return {"message": "Thread archived"}


@router.post("/{thread_id}/unarchive")
async def unarchive_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unarchive a thread.
    """
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    thread.is_archived = False
    thread.status = ThreadStatus.AWAITING_REPLY.value
    db.commit()
    
    return {"message": "Thread unarchived"}
