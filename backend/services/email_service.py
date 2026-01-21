"""
Email service for CRUD operations and business logic.
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.email import Email, EmailThread, EmailAttachment, EmailDirection, EmailStatus, ThreadStatus
from models.user import User
from models.audit_log import AuditLog, AuditAction
from services.graph_service import GraphService
from services.threading_engine import EmailThreadingEngine, create_or_get_thread
from services.classification_service import EmailClassifier


class EmailService:
    """Service for email operations."""
    
    def __init__(self, db: Session, graph_service: Optional[GraphService] = None):
        """
        Initialize email service.
        
        Args:
            db: Database session
            graph_service: Optional Graph service instance
        """
        self.db = db
        self.graph = graph_service
        self.threading_engine = EmailThreadingEngine(db)
    
    def sync_email_from_graph(
        self,
        email_data: Dict[str, Any],
        user: User,
        client_id: Optional[str] = None
    ) -> Email:
        """
        Sync email from Microsoft Graph API response to database.
        
        Args:
            email_data: Email data from Graph API
            user: User who owns the email
            client_id: Optional client association
            
        Returns:
            Created/updated Email instance
        """
        graph_message_id = email_data.get("id")
        
        # Extract tax_email_id from headers
        tax_email_id = None
        headers = email_data.get("internetMessageHeaders", [])
        for header in headers:
            if header.get("name", "").lower() == "x-tax-email-id":
                tax_email_id = header.get("value")
                break
        
        # Check if email already exists (by Graph ID OR Tax ID)
        query = self.db.query(Email)
        if tax_email_id:
            query = query.filter(
                or_(
                    Email.graph_message_id == graph_message_id,
                    Email.tax_email_id == tax_email_id
                )
            )
        else:
            query = query.filter(Email.graph_message_id == graph_message_id)
            
        existing = query.first()
        
        if existing:
            # If matched by Tax ID but Graph ID is different/missing, update Graph ID
            if existing.graph_message_id != graph_message_id:
                existing.graph_message_id = graph_message_id
                
            # Update existing email
            self._update_email_from_graph(existing, email_data)
            self.db.commit()
            return existing
        
        # Run threading engine
        threading_result = self.threading_engine.thread_email(email_data, user.email)
        
        # Classify email
        subject = email_data.get("subject", "")
        body_preview = email_data.get("bodyPreview", "")
        email_type = EmailClassifier.classify(subject, body_preview)
        
        # Get or create thread
        thread = create_or_get_thread(
            self.db,
            threading_result,
            email_data,
            email_type=email_type.value,
            client_id=client_id
        )
        
        # Create email instance
        email = self._create_email_from_graph(email_data, thread.id, user.id, client_id)
        email.email_type = email_type.value
        
        self.db.add(email)
        
        # Update thread metadata
        thread.last_message_id = email.id
        # Extract timestamp directly from email_data (more reliable than email object)
        received_str = email_data.get("receivedDateTime") or email_data.get("sentDateTime")
        if received_str:
            email_timestamp = datetime.fromisoformat(received_str.replace("Z", "+00:00"))
            # Normalize to naive datetime for comparison (strip timezone info)
            if email_timestamp.tzinfo is not None:
                email_timestamp = email_timestamp.replace(tzinfo=None)
        else:
            email_timestamp = datetime.utcnow()
        
        # ALWAYS update last_activity_at - this is a newly synced email
        # For the first email in a new thread, this sets the correct time
        # For subsequent emails, we take the latest timestamp
        if thread.last_activity_at is None or thread.message_count == 0:
            thread.last_activity_at = email_timestamp
        elif email_timestamp > thread.last_activity_at:
            thread.last_activity_at = email_timestamp
        # If email is older than current last_activity, still update if thread is brand new
        elif thread.message_count == 0:
            thread.last_activity_at = email_timestamp
        thread.message_count = (thread.message_count or 0) + 1
        
        # Set first message if not set
        if not thread.first_message_id:
            thread.first_message_id = email.id
            
        # Update thread status if valid incoming email (reply)
        from_address = email_data.get("from", {}).get("emailAddress", {}).get("address", "").lower()
        if from_address != user.email.lower():
            thread.status = ThreadStatus.REPLIED.value
        
        self.db.commit()
        
        return email
    
    def _create_email_from_graph(
        self,
        email_data: Dict,
        thread_id: str,
        user_id: str,
        client_id: Optional[str] = None
    ) -> Email:
        """Create Email instance from Graph API data."""
        
        # Extract from address
        from_field = email_data.get("from", {})
        from_email = from_field.get("emailAddress", {})
        
        # Parse timestamps
        received_dt = email_data.get("receivedDateTime")
        if received_dt:
            received_dt = datetime.fromisoformat(received_dt.replace("Z", "+00:00"))
        
        sent_dt = email_data.get("sentDateTime")
        if sent_dt:
            sent_dt = datetime.fromisoformat(sent_dt.replace("Z", "+00:00"))
        
        # Extract recipients
        to_recipients = [
            r.get("emailAddress", {}).get("address", "")
            for r in email_data.get("toRecipients", [])
        ]
        cc_recipients = [
            r.get("emailAddress", {}).get("address", "")
            for r in email_data.get("ccRecipients", [])
        ]
        bcc_recipients = [
            r.get("emailAddress", {}).get("address", "")
            for r in email_data.get("bccRecipients", [])
        ]
        
        # Extract body
        body = email_data.get("body", {})
        body_content = body.get("content", "")
        body_type = body.get("contentType", "HTML")
        
        # Determine direction
        direction = EmailDirection.INCOMING.value
        
        # Extract internet message headers
        internet_message_id = None
        in_reply_to = None
        references = None
        tax_email_id = None
        
        headers = email_data.get("internetMessageHeaders", [])
        for header in headers:
            name = header.get("name", "").lower()
            value = header.get("value", "")
            
            if name == "message-id":
                internet_message_id = value.strip("<>")
            elif name == "in-reply-to":
                in_reply_to = value.strip("<>")
            elif name == "references":
                references = value
            elif name == "x-tax-email-id":
                tax_email_id = value
        
        return Email(
            id=str(uuid.uuid4()),
            thread_id=thread_id,
            graph_message_id=email_data.get("id"),
            
            subject=email_data.get("subject", ""),
            body=body_content if body_type == "Text" else None,
            body_html=body_content if body_type == "HTML" else None,
            body_preview=email_data.get("bodyPreview", ""),
            
            from_address=from_email.get("address", ""),
            from_name=from_email.get("name", ""),
            to_recipients=to_recipients,
            cc_recipients=cc_recipients,
            bcc_recipients=bcc_recipients,
            
            internet_message_id=internet_message_id,
            in_reply_to_id=in_reply_to,
            references=references,
            conversation_id=email_data.get("conversationId"),
            conversation_index=email_data.get("conversationIndex"),
            tax_email_id=tax_email_id,
            
            user_id=user_id,
            client_id=client_id,
            direction=direction,
            is_read=email_data.get("isRead", False),
            status=EmailStatus.RECEIVED.value,
            
            received_date_time=received_dt,
            sent_date_time=sent_dt,
            
            has_attachments=email_data.get("hasAttachments", False),
            attachment_count=len(email_data.get("attachments", [])),
            is_flagged=email_data.get("flag", {}).get("flagStatus") == "flagged",
            importance=email_data.get("importance", "normal"),
            
            folder_id=email_data.get("parentFolderId"),
        )
    
    def _update_email_from_graph(self, email: Email, email_data: Dict) -> None:
        """Update existing email with new data from Graph."""
        email.is_read = email_data.get("isRead", email.is_read)
        email.is_flagged = email_data.get("flag", {}).get("flagStatus") == "flagged"
        email.importance = email_data.get("importance", email.importance)
    
    def send_email(
        self,
        user: User,
        to_recipients: List[str],
        subject: str,
        body: str,
        body_type: str = "HTML",
        cc_recipients: Optional[List[str]] = None,
        bcc_recipients: Optional[List[str]] = None,
        thread_id: Optional[str] = None,
        client_id: Optional[str] = None,
        signature_html: Optional[str] = None,
        attachments: Optional[List[Dict]] = None
    ) -> Email:
        """
        Send an email.
        
        Args:
            user: Sending user
            to_recipients: Recipients
            subject: Subject
            body: Body content
            body_type: 'HTML' or 'Text'
            cc_recipients: CC recipients
            bcc_recipients: BCC recipients
            thread_id: Optional thread to add to
            client_id: Optional client association
            signature_html: Optional signature to append
            
        Returns:
            Created Email instance
        """
        if not self.graph:
            raise ValueError("Graph service required for sending emails")
        
        # Append signature if provided
        if signature_html and body_type == "HTML":
            body = f"{body}<br><br>{signature_html}"
        
        # Generate custom header for tracking
        tax_email_id = f"TAX_{int(datetime.now().timestamp())}_{user.id[:8]}"
        
        custom_headers = {
            "X-Tax-Email-ID": tax_email_id,
            "X-Email-Source": "TaxPlatform",
        }
        

        
        # Process attachments for Graph API
        graph_attachments = []
        if attachments:
            for att in attachments:
                graph_attachments.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": att["filename"],
                    "contentBytes": att["content_bytes"],
                    "contentType": att["content_type"],
                    "isInline": att.get("is_inline", False)
                })

        # Send via Graph API
        self.graph.send_email(
            to_recipients=to_recipients,
            subject=subject,
            body=body,
            body_type=body_type,
            cc_recipients=cc_recipients,
            bcc_recipients=bcc_recipients,
            custom_headers=custom_headers,
            attachments=graph_attachments
        )
        
        # Create or get thread
        if thread_id:
            thread = self.db.query(EmailThread).filter(
                EmailThread.id == thread_id
            ).first()
        else:
            # Create new thread
            email_type = EmailClassifier.classify(subject, body)
            thread = EmailThread(
                id=str(uuid.uuid4()),
                subject=subject,
                email_type=email_type.value,
                client_id=client_id,
                tax_email_id=tax_email_id,
                status="awaiting_reply",
            )
            self.db.add(thread)
            self.db.flush()
        
        # Create sent email record
        email = Email(
            id=str(uuid.uuid4()),
            thread_id=thread.id,
            
            subject=subject,
            body=body if body_type == "Text" else None,
            body_html=body if body_type == "HTML" else None,
            body_preview=body[:200] if body else "",
            
            from_address=user.email,
            from_name=user.full_name,
            to_recipients=to_recipients,
            cc_recipients=cc_recipients or [],
            bcc_recipients=bcc_recipients or [],
            
            tax_email_id=tax_email_id,
            
            user_id=user.id,
            client_id=client_id,
            direction=EmailDirection.OUTGOING.value,
            is_read=True,
            status=EmailStatus.SENT.value,
            
            sent_date_time=datetime.utcnow(),
            has_attachments=bool(attachments),
            attachment_count=len(attachments) if attachments else 0,
        )
        
        self.db.add(email)
        
        # Save attachment records
        if attachments:
            for att in attachments:
                # Calculate size (approximate from base64)
                size_bytes = (len(att["content_bytes"]) * 3) // 4
                
                attachment = EmailAttachment(
                    id=str(uuid.uuid4()),
                    email_id=email.id,
                    file_name=att["filename"],
                    content_type=att["content_type"],
                    file_size=size_bytes,
                    is_inline=att.get("is_inline", False),
                    # Note: We are not storing the content in DB, just metadata
                    # In a real app, upload to S3 here
                )
                self.db.add(attachment)
        
        # Update thread
        thread.last_message_id = email.id
        thread.last_activity_at = datetime.utcnow()
        thread.message_count = (thread.message_count or 0) + 1
        
        if not thread.first_message_id:
            thread.first_message_id = email.id
            
        self.db.flush()  # Ensure email exists before audit log
        
        # Log audit
        audit = AuditLog(
            user_id=user.id,
            email_id=email.id,
            thread_id=thread.id,
            client_id=client_id,
            action=AuditAction.SENT,
            metadata={
                "to": to_recipients,
                "subject": subject,
            }
        )
        self.db.add(audit)
        
        self.db.commit()
        
        return email
    
    def get_email(
        self, 
        email_id: str, 
        user: User, 
        mark_as_read: bool = True
    ) -> Optional[Email]:
        """
        Get email by ID.
        
        Args:
            email_id: Email ID
            user: Current user
            mark_as_read: Mark as read when fetched
            
        Returns:
            Email or None
        """
        email = self.db.query(Email).filter(
            Email.id == email_id,
            Email.user_id == user.id
        ).first()
        
        if email and mark_as_read and not email.is_read:
            email.is_read = True
            
            # Log view action
            audit = AuditLog(
                user_id=user.id,
                email_id=email.id,
                action=AuditAction.VIEWED,
            )
            self.db.add(audit)
            self.db.commit()
        
        return email
    
    def list_emails(
        self,
        user: User,
        email_type: Optional[str] = None,
        client_id: Optional[str] = None,
        is_read: Optional[bool] = None,
        is_flagged: Optional[bool] = None,
        direction: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """
        List emails with filtering.
        
        Returns:
            Dict with total, emails list, and pagination info
        """
        query = self.db.query(Email).filter(Email.user_id == user.id)
        
        if email_type:
            query = query.filter(Email.email_type == email_type)
        
        if client_id:
            query = query.filter(Email.client_id == client_id)
        
        if is_read is not None:
            query = query.filter(Email.is_read == is_read)
        
        if is_flagged is not None:
            query = query.filter(Email.is_flagged == is_flagged)
        
        if direction:
            query = query.filter(Email.direction == direction)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Email.subject.ilike(search_term)) |
                (Email.body_preview.ilike(search_term)) |
                (Email.from_address.ilike(search_term))
            )
        
        total = query.count()
        
        emails = query.order_by(
            Email.received_date_time.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "emails": [e.to_dict(include_body=False) for e in emails]
        }
    
    def get_thread(self, thread_id: str, user: User) -> Optional[Dict]:
        """
        Get thread with all emails.
        
        Returns:
            Thread dict with emails
        """
        thread = self.db.query(EmailThread).filter(
            EmailThread.id == thread_id
        ).first()
        
        if not thread:
            return None
        
        return thread.to_dict(include_emails=True)
    
    def update_email(
        self,
        email_id: str,
        user: User,
        is_read: Optional[bool] = None,
        is_flagged: Optional[bool] = None,
        is_archived: Optional[bool] = None
    ) -> Optional[Email]:
        """Update email properties."""
        email = self.db.query(Email).filter(
            Email.id == email_id,
            Email.user_id == user.id
        ).first()
        
        if not email:
            return None
        
        actions = []
        
        if is_read is not None and email.is_read != is_read:
            email.is_read = is_read
            actions.append(AuditAction.MARKED_READ if is_read else AuditAction.MARKED_UNREAD)
        
        if is_flagged is not None and email.is_flagged != is_flagged:
            email.is_flagged = is_flagged
            actions.append(AuditAction.FLAGGED if is_flagged else AuditAction.UNFLAGGED)
        
        if is_archived is not None:
            email.is_archived = is_archived
            if is_archived:
                actions.append(AuditAction.ARCHIVED)
        
        # Log actions
        for action in actions:
            audit = AuditLog(
                user_id=user.id,
                email_id=email.id,
                action=action,
            )
            self.db.add(audit)
        
        self.db.commit()
        
        return email
    
    def delete_email(self, email_id: str, user: User) -> bool:
        """Delete email."""
        email = self.db.query(Email).filter(
            Email.id == email_id,
            Email.user_id == user.id
        ).first()
        
        if not email:
            return False
        
        # Log deletion
        audit = AuditLog(
            user_id=user.id,
            email_id=email.id,
            action=AuditAction.DELETED,
            metadata={"subject": email.subject}
        )
        self.db.add(audit)
        
        self.db.delete(email)
        self.db.commit()
        
        return True
