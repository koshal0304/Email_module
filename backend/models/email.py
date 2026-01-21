"""
Email and EmailThread models.
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid

from sqlalchemy import (
    Column, String, Text, DateTime, Boolean, Integer, 
    JSON, ForeignKey, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


class EmailType(str, Enum):
    """Email type classification."""
    NIL_FILING = "NIL_FILING"
    VAT_FILING = "VAT_FILING"
    GST_FILING = "GST_FILING"
    ITR_SUBMISSION = "ITR_SUBMISSION"
    DOC_REQUEST = "DOC_REQUEST"
    COMPLIANCE_NOTICE = "COMPLIANCE_NOTICE"
    GENERAL = "GENERAL"


class ThreadStatus(str, Enum):
    """Thread status values."""
    AWAITING_REPLY = "awaiting_reply"
    REPLIED = "replied"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class EmailDirection(str, Enum):
    """Email direction."""
    INCOMING = "incoming"
    OUTGOING = "outgoing"


class EmailStatus(str, Enum):
    """Email status."""
    DRAFT = "draft"
    SENT = "sent"
    RECEIVED = "received"
    FAILED = "failed"


class EmailThread(Base):
    """Email thread/conversation model."""
    
    __tablename__ = "email_threads"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Client association
    client_id = Column(String(36), ForeignKey("clients.id"), index=True)
    
    # Thread metadata
    subject = Column(String(500), nullable=False)
    email_type = Column(String(50), index=True)  # EmailType enum
    conversation_id = Column(String(255), index=True)  # Microsoft conversation ID
    tax_email_id = Column(String(255), unique=True, index=True)  # Our custom ID
    
    # Message tracking
    first_message_id = Column(String(255))
    last_message_id = Column(String(255))
    message_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_activity_at = Column(DateTime)  # No default - set from email timestamp
    
    # Status
    status = Column(String(50), default=ThreadStatus.AWAITING_REPLY.value)
    is_archived = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    
    # Relationships
    client = relationship("Client", back_populates="email_threads")
    emails = relationship(
        "Email", 
        back_populates="thread", 
        cascade="all, delete-orphan",
        order_by="Email.received_date_time.desc()"
    )
    
    __table_args__ = (
        Index('idx_thread_client_type', 'client_id', 'email_type'),
        Index('idx_thread_status_activity', 'status', 'last_activity_at'),
    )
    
    def add_email(self, email: "Email") -> None:
        """Add email to thread and update metadata."""
        self.emails.append(email)
        self.last_message_id = email.id
        self.last_activity_at = datetime.utcnow()
        self.message_count = len(self.emails)
    
    def to_dict(self, include_emails: bool = False) -> dict:
        """Convert to dictionary."""
        result = {
            "id": self.id,
            "client_id": self.client_id,
            "subject": self.subject,
            "email_type": self.email_type,
            "message_count": self.message_count,
            "status": self.status,
            "is_archived": self.is_archived,
            "is_flagged": self.is_flagged,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_activity_at": self.last_activity_at.isoformat() if self.last_activity_at else None,
        }
        
        if include_emails:
            result["emails"] = [e.to_dict() for e in self.emails]
        
        return result
    
    def __repr__(self) -> str:
        return f"<EmailThread {self.subject[:30]}...>"


class Email(Base):
    """Email message model."""
    
    __tablename__ = "emails"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Thread association
    thread_id = Column(String(36), ForeignKey("email_threads.id"), nullable=False, index=True)
    
    # Graph API ID
    graph_message_id = Column(String(255), unique=True, index=True)
    
    # Content
    subject = Column(String(500), nullable=False)
    body = Column(Text)  # Plain text
    body_html = Column(Text)  # HTML content
    body_preview = Column(String(500))  # Preview/snippet
    
    # Participants
    from_address = Column(String(255), nullable=False, index=True)
    from_name = Column(String(255))
    to_recipients = Column(JSON, default=[])  # List of email addresses
    cc_recipients = Column(JSON, default=[])
    bcc_recipients = Column(JSON, default=[])
    reply_to = Column(JSON, default=[])
    
    # Threading headers (RFC 5322)
    internet_message_id = Column(String(500), unique=True, index=True)
    in_reply_to_id = Column(String(500), index=True)
    references = Column(Text)  # Space-separated message IDs
    conversation_id = Column(String(255), index=True)
    conversation_index = Column(String(255))
    
    # Custom headers for our platform
    tax_email_id = Column(String(255), unique=True, index=True)
    
    # Classification
    email_type = Column(String(50), index=True)  # EmailType enum
    client_id = Column(String(36), ForeignKey("clients.id"), index=True)
    user_id = Column(String(36), ForeignKey("users.id"), index=True)
    
    # Status
    direction = Column(String(20))  # incoming, outgoing
    is_read = Column(Boolean, default=False)
    status = Column(String(20), default=EmailStatus.RECEIVED.value)
    
    # Timestamps
    received_date_time = Column(DateTime, index=True)
    sent_date_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Attachments
    has_attachments = Column(Boolean, default=False)
    attachment_count = Column(Integer, default=0)
    
    # Flags
    is_flagged = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    importance = Column(String(20), default="normal")  # low, normal, high
    
    # Folder
    folder_id = Column(String(255))
    folder_name = Column(String(100))
    
    # Relationships
    thread = relationship("EmailThread", back_populates="emails")
    client = relationship("Client", back_populates="emails")
    user = relationship("User", back_populates="emails")
    attachments = relationship(
        "EmailAttachment", 
        back_populates="email", 
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index('idx_email_user_received', 'user_id', 'received_date_time'),
        Index('idx_email_client_type', 'client_id', 'email_type'),
    )
    
    def to_dict(self, include_body: bool = True) -> dict:
        """Convert to dictionary."""
        result = {
            "id": self.id,
            "thread_id": self.thread_id,
            "subject": self.subject,
            "from_address": self.from_address,
            "from_name": self.from_name,
            "to_recipients": self.to_recipients,
            "cc_recipients": self.cc_recipients,
            "direction": self.direction,
            "is_read": self.is_read,
            "status": self.status,
            "email_type": self.email_type,
            "has_attachments": self.has_attachments,
            "attachment_count": self.attachment_count,
            "is_flagged": self.is_flagged,
            "importance": self.importance,
            "received_date_time": self.received_date_time.isoformat() if self.received_date_time else None,
            "sent_date_time": self.sent_date_time.isoformat() if self.sent_date_time else None,
        }
        
        if include_body:
            result["body"] = self.body
            result["body_html"] = self.body_html
        else:
            result["body_preview"] = self.body_preview
        
        return result
    
    def __repr__(self) -> str:
        return f"<Email {self.subject[:30]}...>"


class EmailAttachment(Base):
    """Email attachment model."""
    
    __tablename__ = "email_attachments"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email_id = Column(String(36), ForeignKey("emails.id", ondelete="CASCADE"), nullable=False)
    
    # Graph API ID
    graph_attachment_id = Column(String(255))
    
    # File info
    file_name = Column(String(500), nullable=False)
    file_size = Column(Integer)  # bytes
    content_type = Column(String(100))  # MIME type
    
    # Storage
    storage_key = Column(String(500))  # S3/Azure Blob key
    storage_url = Column(String(1000))  # Signed URL (expires)
    is_inline = Column(Boolean, default=False)
    content_id = Column(String(255))  # For inline attachments
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    email = relationship("Email", back_populates="attachments")
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "content_type": self.content_type,
            "storage_url": self.storage_url,
            "is_inline": self.is_inline,
        }
    
    def __repr__(self) -> str:
        return f"<EmailAttachment {self.file_name}>"
