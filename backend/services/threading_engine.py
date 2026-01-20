"""
Email Threading Engine - Multi-layer algorithm for thread grouping.

This engine handles email threading using multiple strategies in priority order:
1. Microsoft Conversation ID
2. Custom X-Tax-Email-ID header
3. RFC 5322 In-Reply-To header
4. RFC 5322 References header
5. Subject line fuzzy matching
6. Time-based + recipient matching
"""

import re
import difflib
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session

from models.email import Email, EmailThread
from services.classification_service import EmailClassifier


@dataclass
class ThreadingResult:
    """Result of threading algorithm."""
    thread_id: str
    confidence: float
    method: str
    parent_id: Optional[str] = None
    is_new: bool = False
    
    def to_dict(self) -> Dict:
        return {
            "thread_id": self.thread_id,
            "confidence": self.confidence,
            "method": self.method,
            "parent_id": self.parent_id,
            "is_new": self.is_new,
        }


class EmailThreadingEngine:
    """
    Multi-layer email threading algorithm.
    
    Implements sophisticated threading to handle:
    - Normal replies (same thread)
    - Replies from different email accounts
    - Forwarded emails
    - Changed subject lines
    """
    
    # Patterns to remove from subject for normalization
    SUBJECT_PREFIXES = re.compile(
        r'^(re|fwd?|aw|rv|enc|tr|vs|sv|antw|odp|yant|doorst):\s*',
        re.IGNORECASE
    )
    SUBJECT_BRACKETS = re.compile(r'^\[.*?\]\s*')
    
    def __init__(self, db: Session):
        """
        Initialize threading engine.
        
        Args:
            db: Database session
        """
        self.db = db
    
    def thread_email(self, email_data: Dict[str, Any], user_email: Optional[str] = None) -> ThreadingResult:
        """
        Main orchestrator: tries all threading methods in priority order.
        
        Args:
            email_data: Email data from Microsoft Graph API
            user_email: Current user's email address (to identify direction)
            
        Returns:
            ThreadingResult with thread_id and confidence
        """
        # Layer 1: User Preference - Group by (Participant + Tag)
        result = self._check_participant_tag_thread(email_data, user_email)
        if result:
            return result
        
        # Layer 2: Microsoft Conversation ID (Standard)
        result = self._check_conversation_id(email_data)
        if result:
            return result
        
        # Layer 3: Custom X-Tax-Email-ID header
        result = self._check_custom_header(email_data)
        if result:
            return result
        
        # Layer 4: RFC 5322 In-Reply-To header
        result = self._check_in_reply_to(email_data)
        if result:
            return result
        
        # Layer 5: RFC 5322 References header
        result = self._check_references(email_data)
        if result:
            return result
        
        # Layer 6: Subject line fuzzy matching
        result = self._check_subject_matching(email_data)
        if result:
            return result
        
        # Layer 7: Time + recipient matching
        result = self._check_time_recipient_matching(email_data)
        if result:
            return result
        
        # No match found - create new thread
        return ThreadingResult(
            thread_id=str(uuid.uuid4()),
            confidence=0.0,
            method="new_thread",
            is_new=True
        )
    
    def _check_participant_tag_thread(self, email_data: Dict, user_email: Optional[str]) -> Optional[ThreadingResult]:
        """
        Layer 1: Check for existing thread with same Participant and Email Type.
        
        Priority: High (1.0)
        """
        if not user_email:
            return None
            
        # 1. Determine Participant
        from_address = self._extract_from_address(email_data)
        participant = None
        
        if from_address == user_email.lower():
            # Outgoing: participant is first recipient
            to_recipients = self._extract_recipients(email_data, "toRecipients")
            if to_recipients:
                participant = to_recipients[0]
        else:
            # Incoming: participant is sender
            participant = from_address
            
        if not participant:
            return None
            
        # 2. Determine Email Type
        subject = email_data.get("subject", "")
        body_preview = email_data.get("bodyPreview", "")
        email_type = EmailClassifier.classify(subject, body_preview)
        
        # 3. Query DB for matching thread
        # Find ANY email that involves this participant AND belongs to a thread with this type
        existing_email = self.db.query(Email).join(EmailThread).filter(
            EmailThread.email_type == email_type.value,
            (Email.from_address == participant) | (Email.to_recipients.contains([participant]))
        ).order_by(Email.received_date_time.desc()).first()
        
        if existing_email and existing_email.thread_id:
            return ThreadingResult(
                thread_id=existing_email.thread_id,
                confidence=1.0,
                method="participant_tag_match",
                parent_id=existing_email.id
            )
            
        return None
    
    def _check_conversation_id(self, email_data: Dict) -> Optional[ThreadingResult]:
        """
        Layer 1: Check Microsoft's native conversation ID.
        
        Pros: 100% accurate for Outlook
        Cons: Only works if all emails went through Outlook
        """
        conversation_id = email_data.get("conversationId")
        
        if not conversation_id:
            return None
        
        # Find thread with this conversation ID
        thread = self.db.query(EmailThread).filter(
            EmailThread.conversation_id == conversation_id
        ).first()
        
        if thread:
            return ThreadingResult(
                thread_id=thread.id,
                confidence=1.0,
                method="conversation_id"
            )
        
        return None
    
    def _check_custom_header(self, email_data: Dict) -> Optional[ThreadingResult]:
        """
        Layer 2: Check our custom X-Tax-Email-ID header.
        
        When we send emails, we add this header. When client replies,
        we look for this header in References.
        """
        headers = email_data.get("internetMessageHeaders", [])
        
        # Check direct header
        for header in headers:
            if header.get("name") == "X-Tax-Email-ID":
                value = header.get("value")
                if value:
                    thread = self.db.query(EmailThread).filter(
                        EmailThread.tax_email_id == value
                    ).first()
                    
                    if thread:
                        return ThreadingResult(
                            thread_id=thread.id,
                            confidence=0.95,
                            method="custom_header_direct"
                        )
        
        # Check in References header
        references = email_data.get("references", "")
        for header in headers:
            if header.get("name", "").lower() == "references":
                references = header.get("value", "")
                break
        
        if references:
            # Look for TAX_ prefix in references
            for ref in references.split():
                if "TAX_" in ref.upper():
                    # Extract the tax email ID
                    match = re.search(r'TAX_[A-Za-z0-9_-]+', ref, re.IGNORECASE)
                    if match:
                        tax_id = match.group()
                        thread = self.db.query(EmailThread).filter(
                            EmailThread.tax_email_id == tax_id
                        ).first()
                        
                        if thread:
                            return ThreadingResult(
                                thread_id=thread.id,
                                confidence=0.85,
                                method="custom_header_in_references"
                            )
        
        return None
    
    def _check_in_reply_to(self, email_data: Dict) -> Optional[ThreadingResult]:
        """
        Layer 3: Check RFC 5322 In-Reply-To header.
        
        Points directly to the message being replied to.
        """
        # Try getting from headers first
        headers = email_data.get("internetMessageHeaders", [])
        in_reply_to = None
        
        for header in headers:
            if header.get("name", "").lower() == "in-reply-to":
                in_reply_to = header.get("value", "").strip()
                break
        
        if not in_reply_to:
            return None
        
        # Clean the message ID
        in_reply_to = self._clean_message_id(in_reply_to)
        
        # Find parent email
        parent = self.db.query(Email).filter(
            Email.internet_message_id == in_reply_to
        ).first()
        
        if parent and parent.thread_id:
            return ThreadingResult(
                thread_id=parent.thread_id,
                confidence=0.99,
                method="rfc_in_reply_to",
                parent_id=parent.id
            )
        
        return None
    
    def _check_references(self, email_data: Dict) -> Optional[ThreadingResult]:
        """
        Layer 4: Check RFC 5322 References header.
        
        Contains entire chain of message IDs in the conversation.
        """
        headers = email_data.get("internetMessageHeaders", [])
        references = None
        
        for header in headers:
            if header.get("name", "").lower() == "references":
                references = header.get("value", "")
                break
        
        if not references:
            return None
        
        # Parse references (space-separated message IDs)
        ref_ids = [self._clean_message_id(ref) for ref in references.split()]
        
        # Try each reference, starting from most recent
        for ref_id in reversed(ref_ids):
            if not ref_id:
                continue
                
            parent = self.db.query(Email).filter(
                Email.internet_message_id == ref_id
            ).first()
            
            if parent and parent.thread_id:
                return ThreadingResult(
                    thread_id=parent.thread_id,
                    confidence=0.95,
                    method="rfc_references",
                    parent_id=parent.id
                )
        
        return None
    
    def _check_subject_matching(self, email_data: Dict) -> Optional[ThreadingResult]:
        """
        Layer 5: Subject line fuzzy matching.
        
        Normalizes subjects and matches with 90%+ similarity.
        Lower confidence as this can have false positives.
        """
        subject = email_data.get("subject", "")
        if not subject:
            return None
        
        normalized_subject = self._normalize_subject(subject)
        if len(normalized_subject) < 5:  # Too short to match
            return None
        
        # Get recipients for additional validation
        from_address = self._extract_from_address(email_data)
        to_recipients = self._extract_recipients(email_data, "toRecipients")
        cc_recipients = self._extract_recipients(email_data, "ccRecipients")
        current_recipients = set(to_recipients + cc_recipients)
        if from_address:
            current_recipients.add(from_address)
        
        # Look for similar subjects in recent emails (last 30 days)
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        
        recent_emails = self.db.query(Email).filter(
            Email.received_date_time >= cutoff_date
        ).limit(500).all()  # Limit for performance
        
        for existing_email in recent_emails:
            existing_normalized = self._normalize_subject(existing_email.subject)
            
            # Calculate similarity
            similarity = difflib.SequenceMatcher(
                None, normalized_subject, existing_normalized
            ).ratio()
            
            if similarity >= 0.90:
                # Additional check: recipients overlap
                existing_recipients = set(
                    (existing_email.to_recipients or []) +
                    (existing_email.cc_recipients or []) +
                    [existing_email.from_address]
                )
                
                overlap = len(current_recipients & existing_recipients)
                if overlap >= 1:  # At least one common recipient
                    return ThreadingResult(
                        thread_id=existing_email.thread_id,
                        confidence=0.70,
                        method="subject_matching",
                        parent_id=existing_email.id
                    )
        
        return None
    
    def _check_time_recipient_matching(self, email_data: Dict) -> Optional[ThreadingResult]:
        """
        Layer 6: Time-based + recipient matching.
        
        Last resort: match based on similar recipients within 24 hours.
        Very low confidence - only use when nothing else matches.
        """
        from_address = self._extract_from_address(email_data)
        to_recipients = self._extract_recipients(email_data, "toRecipients")
        cc_recipients = self._extract_recipients(email_data, "ccRecipients")
        
        current_recipients = set(to_recipients + cc_recipients)
        if from_address:
            current_recipients.add(from_address)
        
        if len(current_recipients) < 2:
            return None
        
        # Look within 24 hours
        received_time = email_data.get("receivedDateTime")
        if received_time and isinstance(received_time, str):
            received_time = datetime.fromisoformat(received_time.replace("Z", "+00:00"))
        else:
            received_time = datetime.utcnow()
        
        cutoff_start = received_time - timedelta(hours=24)
        cutoff_end = received_time
        
        recent_emails = self.db.query(Email).filter(
            Email.received_date_time >= cutoff_start,
            Email.received_date_time <= cutoff_end
        ).limit(100).all()
        
        for existing_email in recent_emails:
            existing_recipients = set(
                (existing_email.to_recipients or []) +
                (existing_email.cc_recipients or []) +
                [existing_email.from_address]
            )
            
            # Calculate overlap ratio
            if not existing_recipients:
                continue
                
            intersection = len(current_recipients & existing_recipients)
            union = len(current_recipients | existing_recipients)
            
            if union > 0:
                overlap = intersection / union
                
                if overlap >= 0.70:  # 70% overlap
                    return ThreadingResult(
                        thread_id=existing_email.thread_id,
                        confidence=0.50,
                        method="time_recipient_matching",
                        parent_id=existing_email.id
                    )
        
        return None
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    def _normalize_subject(self, subject: str) -> str:
        """
        Normalize subject for matching.
        
        Removes Re:, Fwd:, brackets, and extra whitespace.
        """
        if not subject:
            return ""
        
        # Remove common prefixes (Re:, Fwd:, etc.)
        cleaned = subject
        while True:
            new_cleaned = self.SUBJECT_PREFIXES.sub("", cleaned)
            new_cleaned = self.SUBJECT_BRACKETS.sub("", new_cleaned)
            if new_cleaned == cleaned:
                break
            cleaned = new_cleaned
        
        # Normalize whitespace and case
        cleaned = " ".join(cleaned.split())
        return cleaned.strip().lower()
    
    def _clean_message_id(self, message_id: str) -> str:
        """Clean message ID, removing angle brackets."""
        if not message_id:
            return ""
        return message_id.strip().strip("<>")
    
    def _extract_from_address(self, email_data: Dict) -> Optional[str]:
        """Extract from email address."""
        from_field = email_data.get("from", {})
        email_address = from_field.get("emailAddress", {})
        return email_address.get("address", "").lower()
    
    def _extract_recipients(self, email_data: Dict, field: str) -> List[str]:
        """Extract recipient email addresses."""
        recipients = email_data.get(field, [])
        return [
            r.get("emailAddress", {}).get("address", "").lower()
            for r in recipients
            if r.get("emailAddress", {}).get("address")
        ]


def create_or_get_thread(
    db: Session,
    threading_result: ThreadingResult,
    email_data: Dict,
    email_type: Optional[str] = None,
    client_id: Optional[str] = None
) -> EmailThread:
    """
    Create a new thread or get existing one based on threading result.
    
    Args:
        db: Database session
        threading_result: Result from threading engine
        email_data: Original email data
        email_type: Classified email type
        client_id: Associated client ID
        
    Returns:
        EmailThread instance
    """
    if not threading_result.is_new:
        # Get existing thread
        thread = db.query(EmailThread).filter(
            EmailThread.id == threading_result.thread_id
        ).first()
        
        if thread:
            return thread
    
    # Create new thread
    thread = EmailThread(
        id=threading_result.thread_id,
        subject=email_data.get("subject", "No Subject"),
        email_type=email_type,
        client_id=client_id,
        conversation_id=email_data.get("conversationId"),
        status="awaiting_reply",
    )
    
    # Check for custom header to store
    headers = email_data.get("internetMessageHeaders", [])
    for header in headers:
        if header.get("name") == "X-Tax-Email-ID":
            thread.tax_email_id = header.get("value")
            break
    
    db.add(thread)
    db.flush()  # Get ID without committing
    
    return thread
