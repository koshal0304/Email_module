"""
Comprehensive Streamlit Test UI for Email Module Backend (Node.js)

Professional email inbox interface for testing all Node.js backend functionality in real-time.
Run with: streamlit run streamlit_test_ui.py --server.port 8502
"""

import streamlit as st
import requests
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
import pandas as pd
import base64
import time

# Configuration - Point to Node.js backend
API_BASE_URL = "http://localhost:3001/api"

st.markdown("""
<style>
    /* Global Font & Reset */
    @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
        color: #201f1e;
        -webkit-font-smoothing: antialiased;
    }
    
    /* App Background */
    .stApp {
        background-color: #f3f2f1;
    }
    
    /* Sidebar styling */
    section[data-testid="stSidebar"] {
        background-color: #faf9f8;
        border-right: 1px solid #edebe9;
    }
    
    section[data-testid="stSidebar"] hr {
        margin: 1rem 0;
        border-color: #edebe9;
    }
    
    /* Button Styles (List Items) */
    div[data-testid="stVerticalBlock"] > div > div > div > div > button { 
        text-align: left !important;
        border: 1px solid transparent !important;
        background-color: white !important;
        border-bottom: 1px solid #edebe9 !important;
        border-radius: 0px !important;
        padding: 12px 16px !important;
        height: auto !important;
        box-shadow: none !important;
        transition: all 0.1s ease-in-out;
    }
    
    div[data-testid="stVerticalBlock"] button:hover {
        background-color: #f3f2f1 !important;
        border-color: transparent !important;
        border-left: 3px solid #0078d4 !important;
        padding-left: 13px !important;
    }
    
    /* Primary / Action Buttons */
    button[kind="primary"] {
        background-color: #0078d4 !important;
        color: white !important;
        border: none !important;
    }

    /* Inputs */
    input[type="text"], textarea {
        border-radius: 2px !important;
        border: 1px solid #605e5c !important;
    }
    
    /* Hide Header/Footer */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
</style>
""", unsafe_allow_html=True)

# Session state initialization
def init_session_state():
    """Initialize session state variables"""
    if "auth_token" not in st.session_state:
        st.session_state.auth_token = None
    if "current_user" not in st.session_state:
        st.session_state.current_user = None
    if "selected_email" not in st.session_state:
        st.session_state.selected_email = None
    if "selected_thread" not in st.session_state:
        st.session_state.selected_thread = None
    if "selected_category" not in st.session_state:
        st.session_state.selected_category = "All"
    if "emails" not in st.session_state:
        st.session_state.emails = []
    if "threads" not in st.session_state:
        st.session_state.threads = []
    if "clients" not in st.session_state:
        st.session_state.clients = []
    if "templates" not in st.session_state:
        st.session_state.templates = []
    if "signatures" not in st.session_state:
        st.session_state.signatures = []
    if "show_compose" not in st.session_state:
        st.session_state.show_compose = False
    if "test_results" not in st.session_state:
        st.session_state.test_results = []

    # Check for token in URL
    try:
        query_params = st.query_params
        if "token" in query_params:
            token = query_params["token"]
            st.session_state.auth_token = token
    except Exception as e:
        st.error(f"Error parsing URL params: {e}")

# API Helper Functions
def make_api_call(method: str, endpoint: str, data: dict = None, params: dict = None, require_auth: bool = True) -> dict:
    """Make API request and return response"""
    url = f"{API_BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if require_auth and st.session_state.auth_token:
        headers["Authorization"] = f"Bearer {st.session_state.auth_token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return {"success": False, "error": f"Unknown method: {method}"}
        
        response_data = response.json() if response.text else {}
        return {
            "success": response_data.get("success", response.status_code in [200, 201]),
            "status_code": response.status_code,
            "data": response_data.get("data", response_data),
        }
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid JSON response"}

# Authentication Functions
def authenticate_user(user_id: str = None):
    """Simulate authentication"""
    if user_id:
        st.session_state.auth_token = user_id
        result = make_api_call("GET", "/auth/me", require_auth=True)
        if result.get("success"):
            st.session_state.current_user = result["data"]
            return True
    return False

# Data Loading Functions
def load_health_status():
    """Load API health status"""
    return make_api_call("GET", "/health", require_auth=False)

def load_emails(email_type: str = None, client_id: str = None, limit: int = 50):
    """Load emails from backend"""
    params = {"limit": limit}
    if email_type and email_type != "All":
        params["emailType"] = email_type
    if client_id:
        params["clientId"] = client_id
    
    result = make_api_call("GET", "/emails", params=params)
    if result.get("success"):
        data = result.get("data", [])
        st.session_state.emails = data if isinstance(data, list) else data.get("data", [])
        return result["data"]
    return {"data": [], "total": 0}

def load_threads(status: str = None, limit: int = 50):
    """Load email threads"""
    params = {"limit": limit}
    if status:
        params["status"] = status
    
    result = make_api_call("GET", "/threads", params=params)
    if result.get("success"):
        data = result.get("data", [])
        st.session_state.threads = data if isinstance(data, list) else data.get("data", [])
        return result["data"]
    return {"data": [], "total": 0}

def load_thread_details(thread_id: str):
    """Load details for a specific thread"""
    result = make_api_call("GET", f"/threads/{thread_id}")
    if result.get("success"):
        return result["data"]
    return None

def load_clients(limit: int = 100):
    """Load clients"""
    result = make_api_call("GET", "/clients", params={"limit": limit})
    if result.get("success"):
        data = result.get("data", [])
        st.session_state.clients = data if isinstance(data, list) else data.get("data", [])
        return result["data"]
    return {"data": [], "total": 0}

def load_templates():
    """Load email templates"""
    result = make_api_call("GET", "/templates", params={"limit": 50})
    if result.get("success"):
        data = result.get("data", [])
        st.session_state.templates = data if isinstance(data, list) else data.get("data", [])
        return result["data"]
    return {"data": [], "total": 0}

def load_signatures():
    """Load email signatures"""
    result = make_api_call("GET", "/templates/signatures/list")
    if result.get("success"):
        data = result.get("data", [])
        st.session_state.signatures = data if isinstance(data, list) else data.get("data", [])
        return result["data"]
    return {"data": [], "total": 0}

def sync_emails(folder: str = "inbox", full_sync: bool = True):
    """Sync emails from Outlook - now fetches ALL emails by default"""
    data = {"folderId": folder, "fullSync": full_sync}
    return make_api_call("POST", "/emails/sync", data=data)

def get_attachments(email_id: str):
    """Fetch attachments for an email"""
    return make_api_call("GET", f"/emails/{email_id}/attachments")

def get_attachment_content(email_id: str, attachment_id: str):
    """Fetch content of an attachment"""
    return make_api_call("GET", f"/emails/{email_id}/attachments/{attachment_id}")

def send_email(to_recipients: list, subject: str, body: str, cc: list = None, bcc: list = None, 
               thread_id: str = None, client_id: str = None, attachments: list = None):
    """Send an email"""
    # Format recipients for Node.js backend
    to_list = [{"address": email.strip()} for email in to_recipients if email.strip()]
    cc_list = [{"address": email.strip()} for email in (cc or []) if email.strip()]
    bcc_list = [{"address": email.strip()} for email in (bcc or []) if email.strip()]
    
    data = {
        "to": to_list,
        "subject": subject,
        "body": body,
        "bodyHtml": body,
    }
    if attachments:
        data["attachments"] = attachments
    if cc_list:
        data["cc"] = cc_list
    if bcc_list:
        data["bcc"] = bcc_list
    if thread_id:
        data["threadId"] = thread_id
    if client_id:
        data["clientId"] = client_id
    
    return make_api_call("POST", "/emails", data=data)

def create_client(name: str, email: str, phone: str = None, client_type: str = "corporate", 
                 pan: str = None, gstin: str = None):
    """Create a new client"""
    data = {
        "name": name,
        "email": email,
        "clientType": client_type
    }
    if phone:
        data["phone"] = phone
    if pan:
        data["pan"] = pan
    if gstin:
        data["gstin"] = gstin
    
    return make_api_call("POST", "/clients", data=data)

def update_email(email_id: str, is_read: bool = None, is_flagged: bool = None):
    """Update email properties"""
    data = {}
    if is_read is not None:
        data["isRead"] = is_read
    if is_flagged is not None:
        data["isFlagged"] = is_flagged
    
    if data:
        return make_api_call("PATCH", f"/emails/{email_id}", data=data)
    return {"success": False, "error": "No updates provided"}

def get_webhook_status():
    """Get webhook subscription status"""
    return make_api_call("GET", "/webhooks/status")

def create_webhook_subscription():
    """Create webhook subscription"""
    return make_api_call("POST", "/webhooks/subscribe")

def delete_webhook_subscription():
    """Delete webhook subscription"""
    return make_api_call("DELETE", "/webhooks/unsubscribe")

def trigger_sync():
    """Trigger email sync - fetches ALL emails"""
    make_api_call("POST", "/emails/sync", data={"folderId": "inbox", "fullSync": True})


# UI Components
def render_sidebar():
    """Render left sidebar with categories"""
    with st.sidebar:
        st.markdown("### 📨 Email Module Test UI")
        st.markdown("**Node.js Backend** - Port 3001")
        
        # User info
        if st.session_state.current_user:
            user = st.session_state.current_user
            st.success(f"👤 {user.get('email', 'User')}")
        else:
            st.warning("⚠️ Not authenticated")
        
        st.markdown("---")
        
        # New Message button
        if st.button("✉️ New Message", use_container_width=True):
            st.session_state.show_compose = True
            st.rerun()
            
        st.markdown("---")
        
        # Real-time Sync
        st.markdown("### 🔄 Real-time")
        auto_sync = st.toggle("Enable Auto-Sync", value=False, help="Automatically syncs emails every 10 seconds")
        
        if auto_sync:
            st.caption("Syncing every 10s...")
            time.sleep(10)
            trigger_sync()
            st.rerun()
        
        st.markdown("---")
        st.markdown("### 📂 Categories")
        
        # Email categories
        categories = [
            "All", "Compliance", "Info Checklist", "COI", "ITR", 
            "JSON", "ITR-V", "Acknowledgement", "Generic",
            "Action Required", "FYI", "High Priority",
            "Unassigned", "Unread", "Sent", "Drafts"
        ]
        
        for category in categories:
            if st.button(category, key=f"cat_{category}", use_container_width=True):
                st.session_state.selected_category = category
                st.rerun()
        
        st.markdown("---")
        st.markdown("### 🔧 Admin")
        if st.button("⚙️ Settings", use_container_width=True):
            pass

def render_email_list():
    """Render middle panel with thread list"""
    st.markdown(f"### {st.session_state.selected_category}")
    
    # Filters and search
    col1, col2 = st.columns([2, 1])
    with col1:
        search = st.text_input("🔍 Search", placeholder="Search conversations...")
    with col2:
        if st.button("🔄 Refresh Threads"):
            with st.spinner("Quick sync..."):
                sync_emails(full_sync=False)  # Quick sync with default limit
                load_threads()
            st.success("Threads refreshed!")
    
    # Category tabs
    tab1, tab2 = st.tabs(["Corporate", "Non Corporate"])
    
    with tab1:
        render_thread_items("corporate", search)
    
    with tab2:
        render_thread_items("non_corporate", search)
    
    if search:
        st.caption(f"Showing results for '{search}'")

def render_thread_items(client_type: str, search_term: str = None):
    """Render list of threads with optional search filter"""
    if not st.session_state.threads:
        st.info("No conversations to display. Click 'Sync from Outlook' to fetch emails.")
        if st.button(f"📥 Sync from Outlook ({client_type})", key=f"sync_{client_type}"):
            with st.spinner("Syncing emails..."):
                result = sync_emails()
                if result.get("success"):
                    st.success(f"✅ Synced emails successfully")
                    load_threads()
                    st.rerun()
                else:
                    st.error(f"❌ Sync failed: {result.get('error', 'Unknown error')}")
        return
    
    # Filter and display threads
    matches = []
    
    for thread in st.session_state.threads:
        if search_term:
            term = search_term.lower()
            subject = thread.get("subject", "").lower()
            
            if term not in subject:
                continue
                
        matches.append(thread)
    
    if not matches:
        if search_term:
             st.info(f"No matches found for '{search_term}'")
        return

    for i, thread in enumerate(matches[:20]):
        thread_id = thread.get("id", "")
        subject = thread.get("subject", "No Subject")
        message_count = thread.get("messageCount", thread.get("_count", {}).get("emails", 0))
        last_activity = thread.get("lastActivityAt", "")
        email_type = thread.get("emailType", "GENERAL")
        is_flagged = thread.get("isFlagged", False)
        
        # Unread status
        emails = thread.get("emails", [])
        latest = emails[0] if emails else {}
        is_read = latest.get("isRead", True)
        unread_indicator = "🔴 " if not is_read else ""
        
        # Format time
        try:
            dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
            time_str = dt.strftime("%I:%M%p")
        except:
            time_str = ""
        
        with st.container():
            col1, col2 = st.columns([4, 1])
            
            with col1:
                # Get latest email info
                emails = thread.get("emails", [])
                latest = emails[0] if emails else {}
                
                # Trust backend direction
                direction = latest.get("direction", "incoming")
                
                # Prepare From Display
                from_name = latest.get("fromName")
                from_addr = latest.get("fromAddress")
                from_display = from_name or from_addr or "Unknown"

                # Prepare To Display
                recipients = latest.get("toRecipients", [])
                if isinstance(recipients, str):
                    try:
                        recipients = json.loads(recipients)
                    except:
                        recipients = []
                
                to_display = "Unknown"
                if recipients and len(recipients) > 0:
                    first = recipients[0]
                    to_display = first.get("name") or first.get("address") or "Unknown"

                # Display Logic
                # If clearly in Sent folder or it is an Outgoing message, show who it was sent TO.
                if st.session_state.selected_category == "Sent" or direction == "outgoing":
                    sender_name = f"To: {to_display}"
                else:
                    # Otherwise (Inbox, All, etc for incoming) show who it is FROM
                    sender_name = from_display
                
                preview = latest.get("bodyPreview") or ""
                if not preview and latest.get("body"):
                    # Fallback if preview is missing but body exists
                    body = latest.get("body") or ""
                    preview = body[:100]
                
                # Double check preview is a string
                preview = str(preview) if preview is not None else ""
                
                preview_display = preview[:60] + "..." if len(preview) > 60 else preview
                
                subject_display = f"**{subject}**" if not is_read else subject
                display_text = f"{unread_indicator}**{sender_name}**\n{subject_display}\n{preview_display}" if preview_display else f"{unread_indicator}**{sender_name}**\n{subject_display}"
                
                if st.button(
                    display_text,
                    key=f"thread_{thread_id}_{client_type}_{i}",
                    use_container_width=True
                ):
                    st.session_state.selected_thread = thread_id
                    st.session_state.selected_email = None
                    st.rerun()
            
            with col2:
                st.caption(time_str)
                if is_flagged:
                    st.caption("🚩")
        
        st.markdown("---")

def render_email_viewer():
    """Render right panel with email details"""
    if st.session_state.show_compose:
        render_compose_email()
        return
    
    if st.session_state.selected_thread:
        render_thread_conversation()
        return
    
    if not st.session_state.selected_email:
        st.info("Select a conversation to view details")
        return
    
    # Find selected email
    email = next((e for e in st.session_state.emails if e.get("id") == st.session_state.selected_email), None)
    
    if not email:
        st.warning("Email not found")
        return
    
    # Email header
    st.markdown(f"## {email.get('subject', 'No Subject')}")
    
    col1, col2 = st.columns([3, 1])
    with col1:
        if email.get("emailType"):
            st.markdown(f"🏷️ **{email['emailType']}**")
    with col2:
        if st.button("❌ Close"):
            st.session_state.selected_email = None
            st.rerun()
    
    st.markdown("---")
    
    # Email metadata
    st.markdown(f"**From:** {email.get('fromAddress', 'Unknown')}")
    
    # Action buttons
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.button("↩️ Reply"):
            st.info("Reply functionality")
    
    with col2:
        if st.button("↪️ Reply All"):
            st.info("Reply All functionality")
    
    with col3:
        if st.button("➡️ Forward"):
            st.info("Forward functionality")
    
    with col4:
        is_read = email.get("isRead", False)
        if st.button(f"📧 Mark as {'Unread' if is_read else 'Read'}"):
            result = update_email(email["id"], is_read=not is_read)
            if result.get("success"):
                st.success("✅ Updated!")
                load_emails()
                st.rerun()
    
    st.markdown("---")
    
    # Email body
    st.markdown("### Email Content")
    body = email.get("bodyPreview", email.get("body", "No content"))
    st.markdown(body, unsafe_allow_html=True)

def render_thread_conversation():
    """Render full conversation thread"""
    thread_data = load_thread_details(st.session_state.selected_thread)
    
    if not thread_data:
        st.warning("Conversation not found")
        return
    
    # Thread header
    st.markdown(f"## {thread_data.get('subject', 'No Subject')}")
    
    col1, col2 = st.columns([3, 1])
    with col1:
        if thread_data.get("emailType"):
            st.markdown(f"🏷️ **{thread_data['emailType']}**")
    with col2:
        if st.button("❌ Close"):
            st.session_state.selected_thread = None
            st.rerun()
    
    st.markdown("---")
    
    # Conversation info
    message_count = thread_data.get("messageCount", len(thread_data.get("emails", [])))
    st.markdown(f"**💬 {message_count} message{'s' if message_count != 1 else ''}**")
    
    st.markdown("---")
    
    # Display all emails in thread
    emails = thread_data.get("emails", [])
    
    if not emails:
        st.info("No messages in this conversation")
        return
    
    # Sort to show oldest first
    emails_sorted = sorted(emails, key=lambda e: e.get("receivedDateTime", "") or e.get("sentDateTime", ""))
    
    for i, email in enumerate(emails_sorted):
        direction = email.get("direction", "incoming")
        from_addr = email.get("fromAddress", "")
        from_name = email.get("fromName", "")
        timestamp = email.get("receivedDateTime") or email.get("sentDateTime", "")
        
        body = email.get("body") or email.get("bodyHtml") or email.get("bodyPreview") or "(No content)"
        has_attachments = email.get("hasAttachments", False)
        
        # Format sender
        sender = f"{from_name} <{from_addr}>" if from_name and from_addr else (from_name or from_addr or "Unknown")
        
        # Format timestamp
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            time_display = dt.strftime("%b %d, %Y at %I:%M %p")
        except:
            time_display = timestamp
        
        if direction == "outgoing":
            st.markdown(f"### 📤 {sender}")
        else:
            st.markdown(f"### 📥 {sender}")
        
        st.caption(f"🕒 {time_display}")
        
        if has_attachments:
            st.caption("📎 Attachments")
            att_resp = get_attachments(email["id"])
            if att_resp.get("success"):
                for att in att_resp.get("data", []):
                    col_a, col_b = st.columns([3, 1])
                    fname = att.get("fileName") or att.get("name")
                    with col_a:
                        st.text(f"📄 {fname}")
                    with col_b:
                        # Unique key for session state
                        dl_key = f"dl_content_{att['id']}"
                        
                        # Check if we have content
                        if dl_key not in st.session_state:
                            if st.button("⬇️ Fetch", key=f"btn_fetch_{att['id']}"):
                                with st.spinner("Downloading..."):
                                    content_resp = get_attachment_content(email["id"], att["id"])
                                    if content_resp.get("success"):
                                        st.session_state[dl_key] = content_resp.get("data", {}).get("contentBytes")
                                        st.rerun()
                        else:
                            # Show download button
                            b64_data = st.session_state[dl_key]
                            if b64_data:
                                try:
                                    bytes_data = base64.b64decode(b64_data)
                                    st.download_button(
                                        label="💾 Save",
                                        data=bytes_data,
                                        file_name=fname,
                                        mime=att.get("contentType"),
                                        key=f"btn_dl_{att['id']}"
                                    )
                                except Exception as e:
                                    st.error("Error decoding file")

        with st.expander("View message", expanded=(i == len(emails_sorted) - 1)):
            st.markdown(body, unsafe_allow_html=True)
        
        st.markdown("---")
    
    # Inline Reply Section
    st.markdown("### ↩️ Reply")
    
    with st.form(key="inline_reply_form"):
        reply_body = st.text_area("Message", height=200, placeholder="Type your reply here...")
        
        col1, col2 = st.columns([1, 1])
        with col1:
            submit = st.form_submit_button("📨 Send Reply", type="primary", use_container_width=True)
        with col2:
            cancel = st.form_submit_button("❌ Cancel", use_container_width=True)
        
        if submit and reply_body:
            latest_email = emails_sorted[-1] if emails_sorted else {}
            default_to = latest_email.get("fromAddress", "")
            
            payload = {
                "to": [{"address": default_to}] if default_to else [],
                "subject": f"Re: {thread_data.get('subject', '')}",
                "body": reply_body,
                "bodyHtml": reply_body,
            }
            
            with st.spinner("Sending reply..."):
                response = make_api_call("POST", "/emails", data=payload)
                
                if response.get("success"):
                    st.success("Reply sent!")
                    time.sleep(1)
                    st.rerun()
                else:
                    st.error(f"Failed to send: {response.get('error', 'Unknown error')}")

def render_compose_email():
    """Render email composition form"""
    st.markdown("## ✉️ Compose New Email")
    
    if st.button("⬅️ Back"):
        st.session_state.show_compose = False
        st.rerun()
    
    st.markdown("---")
    
    with st.form("compose_email_form"):
        to_input = st.text_input("To:", placeholder="email@example.com")
        cc_input = st.text_input("CC:", placeholder="email@example.com (optional)")
        bcc_input = st.text_input("BCC:", placeholder="email@example.com (optional)")
        subject = st.text_input("Subject:", placeholder="Enter subject")
        
        # File Attachment
        uploaded_files = st.file_uploader("Attachments", accept_multiple_files=True)
        
        st.markdown("### Email Body")
        body = st.text_area("Body", height=300, placeholder="Compose your email...", label_visibility="collapsed")
        
        col1, col2 = st.columns(2)
        with col1:
            send_button = st.form_submit_button("📤 Send", use_container_width=True)
        with col2:
            draft_button = st.form_submit_button("💾 Save Draft", use_container_width=True)
        
        if send_button:
            if not to_input or not subject:
                st.error("Please provide recipient and subject")
            else:
                to_list = [email.strip() for email in to_input.split(",")]
                cc_list = [email.strip() for email in cc_input.split(",") if cc_input] if cc_input else None
                bcc_list = [email.strip() for email in bcc_input.split(",") if bcc_input] if bcc_input else None
                
                # Process attachments
                attachments = []
                if uploaded_files:
                    for uploaded_file in uploaded_files:
                        try:
                            file_bytes = uploaded_file.read()
                            encoded = base64.b64encode(file_bytes).decode('utf-8')
                            attachments.append({
                                "name": uploaded_file.name,
                                "contentType": uploaded_file.type or "application/octet-stream",
                                "contentBytes": encoded
                            })
                        except Exception as e:
                            st.error(f"Error processing file {uploaded_file.name}: {e}")
                            st.stop()
                
                with st.spinner("Sending email..."):
                    result = send_email(to_list, subject, body, cc_list, bcc_list, attachments=attachments)
                    if result.get("success"):
                        st.success("✅ Email sent successfully!")
                        st.session_state.show_compose = False
                        st.rerun()
                    else:
                        st.error(f"❌ Failed to send: {result.get('error', 'Unknown error')}")

# Testing Panel
def render_testing_panel():
    """Render testing and admin panel"""
    st.markdown("## 🧪 Backend Testing Panel (Node.js)")
    
    tabs = st.tabs([
        "🏥 Health",
        "👥 Clients",
        "🧵 Threads",
        "📝 Templates",
        "✍️ Signatures",
        "🔔 Webhooks",
        "🔍 Search",
        "📊 Results"
    ])
    
    # Health Tab
    with tabs[0]:
        st.markdown("### System Health")
        st.info("Testing Node.js backend at http://localhost:3001")
        
        if st.button("Check Health"):
            result = make_api_call("GET", "/health", require_auth=False)
            if result.get("success"):
                st.success("✅ Node.js Backend is healthy")
                st.json(result["data"])
            else:
                st.error(f"❌ Backend is down: {result.get('error', 'Connection failed')}")
        
        if st.button("Get API Info"):
            result = make_api_call("GET", "/health", require_auth=False)
            if result.get("success"):
                st.json(result["data"])
    
    # Clients Tab
    with tabs[1]:
        st.markdown("### Client Management")
        
        if st.button("Load All Clients"):
            result = load_clients()
            st.success(f"Loaded {len(st.session_state.clients)} clients")
            if st.session_state.clients:
                st.json(st.session_state.clients[:5])
        
        st.markdown("### Create Test Client")
        with st.form("create_client_form"):
            name = st.text_input("Client Name", value=f"Test Client {datetime.now().strftime('%H%M%S')}")
            email = st.text_input("Email", value="testclient@example.com")
            phone = st.text_input("Phone", value="9876543210")
            client_type = st.selectbox("Type", ["corporate", "non_corporate"])
            pan = st.text_input("PAN", value="ABCDE1234F")
            gstin = st.text_input("GSTIN", value="27ABCDE1234F1Z5")
            
            if st.form_submit_button("Create Client"):
                result = create_client(name, email, phone, client_type, pan, gstin)
                if result.get("success"):
                    st.success("✅ Client created!")
                    st.json(result["data"])
                else:
                    st.error(f"❌ Failed: {result.get('error')}")
    
    # Threads Tab
    with tabs[2]:
        st.markdown("### Email Threads")
        
        if st.button("Load All Threads"):
            result = load_threads()
            st.success(f"Loaded {len(st.session_state.threads)} threads")
            
            if st.session_state.threads:
                for thread in st.session_state.threads[:5]:
                    with st.expander(f"📁 {thread.get('subject', 'No Subject')}"):
                        st.json(thread)
    
    # Templates Tab
    with tabs[3]:
        st.markdown("### Email Templates")
        
        if st.button("Load All Templates"):
            result = load_templates()
            st.success(f"Loaded {len(st.session_state.templates)} templates")
            
            if st.session_state.templates:
                for template in st.session_state.templates:
                    with st.expander(f"📝 {template.get('name', 'Unnamed')}"):
                        st.json(template)
    
    # Signatures Tab
    with tabs[4]:
        st.markdown("### Email Signatures")
        
        if st.button("Load All Signatures"):
            result = load_signatures()
            st.success(f"Loaded {len(st.session_state.signatures)} signatures")
            
            if st.session_state.signatures:
                for sig in st.session_state.signatures:
                    with st.expander(f"✍️ {sig.get('name', 'Unnamed')}"):
                        st.json(sig)
    
    # Webhooks Tab
    with tabs[5]:
        st.markdown("### Webhook Subscriptions")
        
        if st.button("Get Webhook Status"):
            result = get_webhook_status()
            if result.get("success"):
                status = result["data"]
                if status.get("isActive"):
                    st.success("✅ Webhook subscription active")
                else:
                    st.warning("⚠️ No active subscription")
                st.json(status)
            else:
                st.error(f"Failed: {result.get('error')}")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Create Subscription"):
                result = create_webhook_subscription()
                if result.get("success"):
                    st.success("✅ Subscription created!")
                    st.json(result["data"])
                else:
                    st.error(f"❌ Failed: {result.get('error')}")
        
        with col2:
            if st.button("Delete Subscription"):
                result = delete_webhook_subscription()
                if result.get("success"):
                    st.success("✅ Subscription deleted!")
                else:
                    st.error(f"❌ Failed: {result.get('error')}")
    
    # Search Tab
    with tabs[6]:
        st.markdown("### Full-Text Search")
        
        search_query = st.text_input("Search Query", placeholder="Enter search terms...")
        
        if st.button("Search Emails"):
            if search_query:
                result = make_api_call("GET", "/search", params={"query": search_query, "limit": 20})
                if result.get("success"):
                    results = result["data"]
                    data_list = results.get("data", results) if isinstance(results, dict) else results
                    st.success(f"Found {len(data_list) if isinstance(data_list, list) else 0} results")
                    
                    if data_list:
                        st.json(data_list[:5])
                else:
                    st.error(f"❌ Search failed: {result.get('error')}")
    
    # Results Tab
    with tabs[7]:
        st.markdown("### Test Results Summary")
        
        if st.session_state.test_results:
            df = pd.DataFrame(st.session_state.test_results)
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Tests", len(df))
            with col2:
                passed = len(df[df["success"] == True])
                st.metric("Passed", passed)
            with col3:
                failed = len(df[df["success"] == False])
                st.metric("Failed", failed)
            
            st.dataframe(df, use_container_width=True)
        else:
            st.info("No test results yet. Run some tests to see results here.")

# Main Application
def main():
    """Main application entry point"""
    st.set_page_config(
        page_title="Email Module Test UI (Node.js)",
        page_icon="📧",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Initialize session state
    init_session_state()
    
    # Top navigation
    col1, col2, col3 = st.columns([2, 3, 2])
    
    with col1:
        st.markdown("## 📧 Email Module (Node.js)")
    
    with col2:
        # Login/Auth section
        if not st.session_state.auth_token:
            with st.form("auth_form", clear_on_submit=True):
                col_a, col_b = st.columns([3, 1])
                with col_a:
                    user_id = st.text_input("User ID / Token", placeholder="Enter user ID", label_visibility="collapsed")
                with col_b:
                    login_btn = st.form_submit_button("Login")
                
                if login_btn and user_id:
                    if authenticate_user(user_id):
                        st.success("✅ Logged in!")
                        load_clients()
                        load_templates()
                        load_signatures()
                        st.rerun()
                    else:
                        st.error("❌ Authentication failed")
            
            # OAuth Login Button
            st.markdown("### Or")
            
            def get_auth_url_and_redirect():
                try:
                    # Pass the streamlit URL as state for redirection after login
                    redirect_streamlit = "http://localhost:8502"
                    result = make_api_call("GET", "/auth/login", params={"state": redirect_streamlit}, require_auth=False)
                    if result.get("success"):
                        auth_url = result["data"].get("authUrl")
                        if auth_url:
                            st.link_button("🔐 Login with Microsoft", auth_url, type="primary", use_container_width=True)
                        else:
                            st.error("Could not generate auth URL")
                    else:
                        st.error("Failed to connect to Node.js backend")
                except Exception as e:
                    st.error(f"Error: {e}")

            get_auth_url_and_redirect()
            
            if st.session_state.auth_token and not st.session_state.current_user:
                if authenticate_user(st.session_state.auth_token):
                    st.success("✅ Authenticated via OAuth!")
                    load_clients()
                    load_templates()
                    load_signatures()
                    st.rerun()
    
    with col3:
        if st.session_state.current_user:
            user_name = st.session_state.current_user.get("firstName", "User")
            st.markdown(f"### 👤 {user_name}")
    
    st.markdown("---")
    
    # Main layout
    main_tabs = st.tabs(["📨 Inbox", "🧪 Testing Panel"])
    
    # Inbox Tab
    with main_tabs[0]:
        if not st.session_state.auth_token:
            st.warning("⚠️ Please login to access the email inbox")
        else:
            col1, col2, col3 = st.columns([1, 2, 3])
            
            with col1:
                render_sidebar()
            
            with col2:
                render_email_list()
            
            with col3:
                render_email_viewer()
    
    # Testing Panel Tab
    with main_tabs[1]:
        render_testing_panel()

if __name__ == "__main__":
    main()
