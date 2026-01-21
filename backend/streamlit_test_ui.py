"""
Comprehensive Streamlit Test UI for Email Module Backend

Professional email inbox interface for testing all backend functionality in real-time.
Run with: streamlit run streamlit_test_ui.py --server.port 8501
"""

import streamlit as st
import requests
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
import pandas as pd
import base64
import time

# Configuration
API_BASE_URL = "http://localhost:8000"

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

# Custom CSS for professional styling
_old_css = """
<style>
    /* Main layout */
    .main {
        background-color: #f5f5f5;
    }
    
    /* Email list item */
    .email-item {
        background: white;
        padding: 12px 16px;
        margin-bottom: 8px;
        border-radius: 6px;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: all 0.2s;
    }
    
    .email-item:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border-left-color: #ff6b35;
    }
    
    .email-item.unread {
        background: #fff7f0;
        border-left-color: #ff6b35;
    }
    
    .email-item.selected {
        background: #fff0e6;
        border-left-color: #ff6b35;
    }
    
    /* Email metadata */
    .email-sender {
        font-weight: 600;
        font-size: 14px;
        color: #1a1a1a;
        margin-bottom: 4px;
    }
    
    .email-subject {
        font-size: 13px;
        color: #4a4a4a;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .email-time {
        font-size: 11px;
        color: #888;
    }
    
    /* Category badge */
    .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        margin-right: 6px;
        margin-bottom: 4px;
    }
    
    .badge-action {
        background: #ff6b35;
        color: white;
    }
    
    .badge-priority {
        background: #ff4757;
        color: white;
    }
    
    .badge-attachment {
        background: #ecf0f1;
        color: #555;
    }
    
    /* Sidebar */
    .sidebar-item {
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 6px;
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .sidebar-item:hover {
        background: #f0f0f0;
    }
    
    .sidebar-item.active {
        background: #ff6b35;
        color: white;
        font-weight: 600;
    }
    
    .sidebar-count {
        background: #ff6b35;
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
    }
    
    /* Buttons */
    .stButton>button {
        border-radius: 6px;
        border: none;
        font-weight: 500;
    }
    
    /* Success/Error messages */
    .success-msg {
        background: #d4edda;
        color: #155724;
        padding: 12px;
        border-radius: 6px;
        margin: 8px 0;
    }
    
    .error-msg {
        background: #f8d7da;
        color: #721c24;
        padding: 12px;
        border-radius: 6px;
        margin: 8px 0;
    }
</style>
"""

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
        # Compatibility handling for query params
        query_params = st.query_params
        # st.write(f"DEBUG: Query Params: {query_params}") # Uncomment for debugging
        if "token" in query_params:
            token = query_params["token"]
            # st.write(f"DEBUG: Found token: {token}")
            st.session_state.auth_token = token
            # Clear query params to prevent re-login on refresh
            # Note: This might not clear the URL in the browser bar immediately in all versions
            # st.query_params.clear() 
    except Exception as e:
        st.error(f"Error parsing URL params: {e}")

# API Helper Functions
def make_api_call(method: str, endpoint: str, data: dict = None, params: dict = None, require_auth: bool = True) -> dict:
    """Make API request and return response"""
    url = f"{API_BASE_URL}{endpoint}"
    headers = {}
    
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
        
        return {
            "success": response.status_code in [200, 201],
            "status_code": response.status_code,
            "data": response.json() if response.text else {},
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
        params["email_type"] = email_type
    if client_id:
        params["client_id"] = client_id
    
    result = make_api_call("GET", "/emails", params=params)
    if result.get("success"):
        st.session_state.emails = result["data"].get("emails", [])
        return result["data"]
    return {"emails": [], "total": 0}

def load_threads(status: str = None, limit: int = 50):
    """Load email threads"""
    params = {"limit": limit}
    if status:
        params["status"] = status
    
    result = make_api_call("GET", "/threads", params=params)
    if result.get("success"):
        st.session_state.threads = result["data"].get("threads", [])
        return result["data"]

    return {"threads": [], "total": 0}

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
        st.session_state.clients = result["data"].get("clients", [])
        return result["data"]
    return {"clients": [], "total": 0}

def load_templates():
    """Load email templates"""
    result = make_api_call("GET", "/templates", params={"limit": 50})
    if result.get("success"):
        st.session_state.templates = result["data"].get("templates", [])
        return result["data"]
    return {"templates": [], "total": 0}

def load_signatures():
    """Load email signatures"""
    result = make_api_call("GET", "/signatures", params={"limit": 50})
    if result.get("success"):
        st.session_state.signatures = result["data"].get("signatures", [])
        return result["data"]
    return {"signatures": [], "total": 0}

def sync_emails(folder: str = "inbox", limit: int = 50):
    """Sync emails from Outlook"""
    params = {"folder": folder, "limit": limit}
    return make_api_call("GET", "/emails/sync", params=params)

def send_email(to_recipients: list, subject: str, body: str, cc: list = None, bcc: list = None, 
               thread_id: str = None, client_id: str = None, signature_id: str = None, attachments: list = None):
    """Send an email"""
    data = {
        "to_recipients": to_recipients,
        "subject": subject,
        "body": body,
        "body_type": "HTML"
    }
    if cc:
        data["cc_recipients"] = cc
    if bcc:
        data["bcc_recipients"] = bcc
    if thread_id:
        data["thread_id"] = thread_id
    if client_id:
        data["client_id"] = client_id
    if signature_id:
        data["signature_id"] = signature_id
    if attachments:
        data["attachments"] = attachments
    
    return make_api_call("POST", "/emails", data=data)

def create_client(name: str, email: str, phone: str = None, client_type: str = "corporate", 
                 pan: str = None, gstin: str = None):
    """Create a new client"""
    data = {
        "name": name,
        "email": email,
        "client_type": client_type
    }
    if phone:
        data["phone"] = phone
    if pan:
        data["pan"] = pan
    if gstin:
        data["gstin"] = gstin
    
    return make_api_call("POST", "/clients", data=data)

def update_email(email_id: str, is_read: bool = None, is_flagged: bool = None, is_archived: bool = None):
    """Update email properties"""
    data = {}
    if is_read is not None:
        data["is_read"] = is_read
    if is_flagged is not None:
        data["is_flagged"] = is_flagged
    if is_archived is not None:
        data["is_archived"] = is_archived
    
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
    return make_api_call("DELETE", "/webhooks/subscribe")

def trigger_sync():
    """Trigger email sync"""
    make_api_call("GET", "/emails/sync?folder=inbox&limit=5")
    make_api_call("GET", "/emails/sync?folder=sentitems&limit=5")


# UI Components
def render_sidebar():
    """Render left sidebar with categories"""
    with st.sidebar:
        st.markdown("### 📨 Email Module Test UI")
        
        # User info
        if st.session_state.current_user:
            user = st.session_state.current_user
            st.success(f"👤 {user.get('email', 'User')}")
        else:
            st.warning("⚠️ Not authenticated")
        
        st.markdown("---")
        
        # New Message button
        if st.button("✉️ New Message", width='stretch'):
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
        
        # Email categories with counts
        categories = {
            "All": 100,
            "Compliance": 10,
            "Info Checklist": 10,
            "COI": 20,
            "ITR": 10,
            "JSON": 10,
            "ITR-V": 10,
            "Acknowledgement": 10,
            "Generic": 10,
            "Action Required": 10,
            "FYI": 10,
            "High Priority": 10,
            "Unassigned": 0,
            "Unread": 0,
            "Sent": 60,
            "Drafts": 0,
        }
        
        for category, count in categories.items():
            col1, col2 = st.columns([3, 1])
            with col1:
                if st.button(category, key=f"cat_{category}", width='stretch'):
                    st.session_state.selected_category = category
                    st.rerun()
            with col2:
                if count > 0:
                    st.markdown(f"**{count}**")
        
        st.markdown("---")
        st.markdown("### 🔧 Admin")
        if st.button("⚙️ Settings", width='stretch'):
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
                    st.success(f"✅ Synced {result['data'].get('synced', 0)} emails")
                    load_threads()
                    st.rerun()
                else:
                    st.error(f"❌ Sync failed: {result.get('error', 'Unknown error')}")
        return
    
    # Filter and display threads
    matches = []
    
    # Pre-filter to get relevant threads
    for thread in st.session_state.threads:
        if search_term:
            term = search_term.lower()
            subject = thread.get("subject", "").lower()
            sender = thread.get("latest_sender_name", "").lower()
            preview = thread.get("preview", "").lower()
            
            if term not in subject and term not in sender and term not in preview:
                continue
                
        matches.append(thread)
    
    if not matches:
        if search_term:
             st.info(f"No matches found for '{search_term}'")
        return

    for i, thread in enumerate(matches[:20]):  # Limit display items
        thread_id = thread.get("id", "")
        subject = thread.get("subject", "No Subject")
        message_count = thread.get("message_count", 0)
        last_activity = thread.get("last_activity_at", "")
        email_type = thread.get("email_type", "GENERAL")
        is_flagged = thread.get("is_flagged", False)
        
        # Format time
        try:
            dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
            time_str = dt.strftime("%I:%M%p")
        except:
            time_str = ""
        
        # Thread item (Outlook style: Sender → Subject → Preview)
        with st.container():
            col1, col2 = st.columns([4, 1])
            
            with col1:
                # Get sender and preview from thread data
                sender_name = thread.get("latest_sender_name", "Unknown Sender")
                preview = thread.get("preview", "")
                
                # Truncate preview to keep it short  
                if preview and len(preview) > 60:
                    preview = preview[:60] + "..."
                
                #  Outlook-style display: Sender (bold) → Subject → Preview
                display_text = f"**{sender_name}**\n{subject}\n{preview}" if preview else f"**{sender_name}**\n{subject}"
                
                if st.button(
                    display_text,
                    key=f"thread_{thread_id}_{client_type}_{i}",
                    width='stretch'
                ):
                    st.session_state.selected_thread = thread_id
                    st.session_state.selected_email = None
                    st.rerun()
            
            with col2:
                st.caption(time_str)
                if is_flagged:
                    st.caption("🚩")
        
        st.markdown("---")


def render_email_items(client_type: str):
    """Render list of emails"""
    if not st.session_state.emails:
        st.info("No emails to display. Click 'Sync from Outlook' to fetch emails.")
        if st.button(f"📥 Sync from Outlook ({client_type})", key=f"sync_{client_type}"):
            with st.spinner("Syncing emails..."):
                result = sync_emails()
                if result.get("success"):
                    st.success(f"✅ Synced {result['data'].get('synced', 0)} emails")
                    load_emails()
                    st.rerun()
                else:
                    st.error(f"❌ Sync failed: {result.get('error', 'Unknown error')}")
        return
    
    # Display emails
    # Display emails
    for i, email in enumerate(st.session_state.emails[:20]):  # Limit display
        email_id = email.get("id", "")
        from_addr = email.get("from_address") or email.get("sender_email", "")
        from_name = email.get("from_name", "")
        if from_name and from_addr and from_name != from_addr:
            sender = f"{from_name} <{from_addr}>"
        elif from_name:
            sender = from_name
        elif from_addr:
            sender = from_addr
        else:
            sender = "Unknown"
        subject = email.get("subject", "No Subject")
        received = email.get("received_date_time", "")
        is_read = email.get("is_read", False)
        is_flagged = email.get("is_flagged", False)
        has_attachments = email.get("has_attachments", False)
        email_type = email.get("email_type", "GENERAL")
        
        # Format time
        try:
            dt = datetime.fromisoformat(received.replace("Z", "+00:00"))
            time_str = dt.strftime("%I:%M%p")
        except:
            time_str = ""
        
        # Email item
        unread_class = "unread" if not is_read else ""
        selected_class = "selected" if st.session_state.selected_email == email_id else ""
        
        with st.container():
            col1, col2 = st.columns([4, 1])
            
            with col1:
                if st.button(
                    f"{'🔴' if not is_read else '⚪'} **{sender}**\n{subject[:60]}...",
                    key=f"email_{email_id}_{client_type}_{i}",
                    width='stretch'
                ):
                    st.session_state.selected_email = email_id
                    st.rerun()
            
            with col2:
                st.caption(time_str)
                if has_attachments:
                    st.caption("📎")
                if is_flagged:
                    st.caption("🚩")
        
        # Show badges
        badges = []
        if email_type and email_type != "GENERAL":
            badges.append(email_type.replace("_", " "))
        if is_flagged:
            badges.append("High Priority")
        
        if badges:
            st.caption(" • ".join(badges))
        
        st.markdown("---")

def render_email_viewer():
    """Render right panel with email details"""
    if st.session_state.show_compose:
        render_compose_email()
        return
    
    # Check for thread selection first
    if st.session_state.selected_thread:
        render_thread_conversation()
        return
    
    # Fall back to individual email view
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
    
    # Badges
    col1, col2 = st.columns([3, 1])
    with col1:
        if email.get("email_type"):
            st.markdown(f"<span class='badge badge-action'>{email['email_type']}</span>", unsafe_allow_html=True)
        if email.get("is_flagged"):
            st.markdown(f"<span class='badge badge-priority'>High Priority</span>", unsafe_allow_html=True)
    with col2:
        if st.button("❌ Close"):
            st.session_state.selected_email = None
            st.rerun()
    
    st.markdown("---")
    
    # Email metadata
    st.markdown(f"**From:** {email.get('sender_email', 'Unknown')}")
    st.markdown(f"**To:** {', '.join(email.get('to_recipients', []))}")
    
    if email.get('cc_recipients'):
        st.markdown(f"**CC:** {', '.join(email['cc_recipients'])}")
    
    if email.get('bcc_recipients'):
        st.markdown(f"**BCC:** {', '.join(email['bcc_recipients'])}")
    
    # Received time
    received = email.get("received_date_time", "")
    if received:
        try:
            dt = datetime.fromisoformat(received.replace("Z", "+00:00"))
            st.markdown(f"**Received:** {dt.strftime('%B %d, %Y at %I:%M %p')}")
        except:
            pass
    
    st.markdown("---")
    
    # Action buttons
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.button("↩️ Reply"):
            st.info("Reply functionality would open compose form")
    
    with col2:
        if st.button("↪️ Reply All"):
            st.info("Reply All functionality")
    
    with col3:
        if st.button("➡️ Forward"):
            st.info("Forward functionality")
    
    with col4:
        is_read = email.get("is_read", False)
        if st.button(f"📧 Mark as {'Unread' if is_read else 'Read'}"):
            result = update_email(email["id"], is_read=not is_read)
            if result.get("success"):
                st.success("✅ Updated!")
                load_emails()
                st.rerun()
    
    st.markdown("---")
    
    # Email body
    st.markdown("### Email Content")
    body = email.get("body_preview", email.get("body", "No content"))
    st.markdown(body, unsafe_allow_html=True)
    
    # Attachments
    if email.get("has_attachments"):
        st.markdown("### 📎 Attachments")
        st.info("Attachment list would appear here")

def render_thread_conversation():
    """Render full conversation thread (Outlook style)"""
    thread_data = load_thread_details(st.session_state.selected_thread)
    
    if not thread_data:
        st.warning("Conversation not found")
        return
    
    # Thread header
    st.markdown(f"## {thread_data.get('subject', 'No Subject')}")
    
    # Badges and close button
    col1, col2 = st.columns([3, 1])
    with col1:
        if thread_data.get("email_type"):
            st.markdown(f"<span class='badge badge-action'>{thread_data['email_type']}</span>", unsafe_allow_html=True)
        if thread_data.get("is_flagged"):
            st.markdown(f"<span class='badge badge-priority'>High Priority</span>", unsafe_allow_html=True)
    with col2:
        if st.button("❌ Close"):
            st.session_state.selected_thread = None
            st.rerun()
    
    st.markdown("---")
    
    # Conversation info
    message_count = thread_data.get("message_count", 0)
    st.markdown(f"**💬 {message_count} message{'s' if message_count != 1 else ''}**")
    
    st.markdown("---")
    
    # Display all emails in thread (chronological order)
    emails = thread_data.get("emails", [])
    
    if not emails:
        st.info("No messages in this conversation")
        return
    
    # Sort to show oldest first (Outlook style)
    emails_sorted = sorted(emails, key=lambda e: e.get("received_date_time", "") or e.get("sent_date_time", ""))
    
    for i, email in enumerate(emails_sorted):
        direction = email.get("direction", "incoming")
        from_addr = email.get("from_address", "")
        from_name = email.get("from_name", "")
        to_recipients = email.get("to_recipients", [])
        timestamp = email.get("received_date_time") or email.get("sent_date_time", "")
        
        # Get body content with better fallback
        body = email.get("body")
        if not body or body.strip() == "":
            body = email.get("body_html")
        if not body or body.strip() == "":
            body = email.get("body_preview")
        if not body or body.strip() == "":
            body = "(No message content available)"
        
        has_attachments = email.get("has_attachments", False)
        
        # Format sender
        if from_name and from_addr:
            sender = f"{from_name} <{from_addr}>"
        elif from_name:
            sender = from_name
        elif from_addr:
            sender = from_addr
        else:
            sender = "Unknown"
        
        # Format timestamp
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            time_display = dt.strftime("%b %d, %Y at %I:%M %p")
        except:
            time_display = timestamp
        
        # Message container with styling based on direction
        if direction == "outgoing":
            st.markdown(f"### 📤 {sender}")
            st.caption(f"To: {', '.join(to_recipients) if to_recipients else 'Unknown'}")
        else:
            st.markdown(f"### 📥 {sender}")
        
        st.caption(f"🕒 {time_display}")
        
        if has_attachments:
            st.caption("📎 Has attachments")
        
        # Message body
        with st.expander("View message", expanded=(i == len(emails_sorted) - 1)):
            st.markdown(body, unsafe_allow_html=True)
        
        st.markdown("---")
    
    st.markdown("---")
    
    # Inline Reply Section
    if "reply_active_thread" not in st.session_state:
        st.session_state.reply_active_thread = None
        
    latest_email = emails_sorted[-1] if emails_sorted else None
    
    # Check if this thread has active reply
    is_replying = st.session_state.reply_active_thread == st.session_state.selected_thread
    
    if not is_replying:
        # Show Reply button
        if st.button("↩️ Reply to Thread", width='stretch', key="btn_init_reply"):
            st.session_state.reply_active_thread = st.session_state.selected_thread
            st.rerun()
    else:
        # Show Inline Reply Form
        st.markdown(f"### ↩️ Reply to {latest_email.get('from_name') or 'Sender'}")
        
        with st.form(key="inline_reply_form"):
            # Determine recipients
            default_to = ""
            if latest_email:
                if latest_email.get("direction") == "outgoing":
                    recipients = latest_email.get("to_recipients", [])
                    default_to = recipients[0] if recipients else ""
                else:
                    default_to = latest_email.get("from_address", "")
            
            # Hidden or read-only To field context
            st.caption(f"Replying to: {default_to}")
            
            reply_body = st.text_area("Message", height=200, placeholder="Type your reply here...")
            
            attachments = st.file_uploader("Attach files", accept_multiple_files=True)
            
            col1, col2 = st.columns([1, 1])
            with col1:
                submit = st.form_submit_button("📨 Send Reply", type="primary", use_container_width=True)
            with col2:
                cancel = st.form_submit_button("❌ Cancel", use_container_width=True)
            
            if cancel:
                st.session_state.reply_active_thread = None
                st.rerun()
                
            if submit and reply_body:
                # Prepare payload
                payload = {
                    "to_recipients": [default_to] if default_to else [],
                    "subject": latest_email.get("subject", "No Subject"),
                    "body": reply_body,
                    "body_type": "HTML",
                    "thread_id": st.session_state.selected_thread
                }
                
                # Check subject prefix
                if not payload["subject"].lower().startswith("re:"):
                    payload["subject"] = "Re: " + payload["subject"]
                
                # Handle attachments (basic implementation if needed, or skip for now)
                # To support attachments, we need to convert them to base64
                if attachments:
                    att_list = []
                    for att in attachments:
                        content = base64.b64encode(att.read()).decode()
                        att_list.append({
                            "name": att.name,
                            "content_bytes": content,
                            "content_type": att.type or "application/octet-stream"
                        })
                    payload["attachments"] = att_list

                with st.spinner("Sending reply..."):
                    response = make_api_call("POST", "/emails", data=payload)
                    
                    if response:
                        st.success("Reply sent!")
                        st.session_state.reply_active_thread = None
                        time.sleep(1) # Wait for backend sync?
                        # Trigger a sync to get the new sent item
                        make_api_call("GET", "/emails/sync?folder=sentitems&limit=1")
                        st.rerun()
def render_compose_email():
    """Render email composition form"""
    st.markdown("## ✉️ Compose New Email")
    
    if st.button("⬅️ Back"):
        st.session_state.show_compose = False
        st.rerun()
    
    st.markdown("---")
    
    # Template selection
    template_options = ["Select Email Template"] + [t.get("name", "") for t in st.session_state.templates]
    selected_template = st.selectbox("Template", template_options)
    
    # Form fields
    with st.form("compose_email_form"):
        # Recipients
        to_val = st.session_state.get("compose_to", "")
        to_input = st.text_input("To:", value=to_val, placeholder="email@example.com")
        
        cc_val = st.session_state.get("compose_cc", "")
        cc_input = st.text_input("CC:", value=cc_val, placeholder="email@example.com (optional)")
        
        bcc_val = st.session_state.get("compose_bcc", "")
        bcc_input = st.text_input("BCC:", value=bcc_val, placeholder="email@example.com (optional)")
        
        # Subject
        subj_val = st.session_state.get("compose_subject", "")
        subject = st.text_input("Subject:", value=subj_val, placeholder="Enter subject")
        
        # Body
        st.markdown("### Email Body")
        body_val = st.session_state.get("compose_body", "")
        body = st.text_area("Body", value=body_val, height=300, placeholder="Compose your email...", label_visibility="collapsed")
        
        # Attachments
        st.markdown("### 📎 Attachments")
        uploaded_files = st.file_uploader("Upload files", accept_multiple_files=True)
        
        # Options
        col1, col2 = st.columns(2)
        with col1:
            client_options = ["No Client"] + [c.get("name", "") for c in st.session_state.clients]
            selected_client = st.selectbox("Client", client_options)
        
        with col2:
            signature_options = ["No Signature"] + [s.get("name", "") for s in st.session_state.signatures]
            selected_signature = st.selectbox("Signature", signature_options)
        
        # Submit buttons
        col1, col2 = st.columns(2)
        with col1:
            send_button = st.form_submit_button("📤 Send", width='stretch')
        with col2:
            draft_button = st.form_submit_button("💾 Save Draft", width='stretch')
        
        if send_button:
            if not to_input or not subject:
                st.error("Please provide recipient and subject")
            else:
                to_list = [email.strip() for email in to_input.split(",")]
                cc_list = [email.strip() for email in cc_input.split(",")] if cc_input else None
                bcc_list = [email.strip() for email in bcc_input.split(",")] if bcc_input else None
                
                # Process attachments
                processed_attachments = []
                if uploaded_files:
                    for uploaded_file in uploaded_files:
                        bytes_data = uploaded_file.getvalue()
                        b64_data = base64.b64encode(bytes_data).decode()
                        processed_attachments.append({
                            "filename": uploaded_file.name,
                            "content_bytes": b64_data,
                            "content_type": uploaded_file.type or "application/octet-stream"
                        })
                
                with st.spinner("Sending email..."):
                    result = send_email(to_list, subject, body, cc_list, bcc_list, attachments=processed_attachments)
                    if result.get("success"):
                        st.success("✅ Email sent successfully!")
                        st.session_state.show_compose = False
                        st.rerun()
                    else:
                        st.error(f"❌ Failed to send: {result.get('error', 'Unknown error')}")

# Testing Panel
def render_testing_panel():
    """Render testing and admin panel"""
    st.markdown("## 🧪 Backend Testing Panel")
    
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
        if st.button("Check Health"):
            result = load_health_status()
            if result.get("success"):
                st.success("✅ Backend is healthy")
                st.json(result["data"])
            else:
                st.error("❌ Backend is down")
        
        if st.button("Get API Info"):
            result = make_api_call("GET", "/api/info", require_auth=False)
            if result.get("success"):
                st.json(result["data"])
    
    # Clients Tab
    with tabs[1]:
        st.markdown("### Client Management")
        
        if st.button("Load All Clients"):
            result = load_clients()
            st.success(f"Loaded {result.get('total', 0)} clients")
            st.json(result)
        
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
            st.success(f"Loaded {result.get('total', 0)} threads")
            

            if result.get("threads"):
                st.session_state.threads_list = result["threads"]
        
        # Display thread list if no thread is selected
        if not st.session_state.get("selected_thread_id") and st.session_state.get("threads_list"):
            st.markdown("#### Found Threads")
            for thread in st.session_state.threads_list:
                with st.container():
                    col1, col2 = st.columns([4, 1])
                    with col1:
                        if st.button(
                            f"📁 **{thread.get('subject', 'No Subject')}**\n{thread.get('message_count', 0)} messages",
                            key=f"thread_{thread.get('id')}",
                            width='stretch'
                        ):
                            st.session_state.selected_thread_id = thread.get('id')
                            st.rerun()
                    with col2:
                        st.caption(f"Status: {thread.get('status')}\nType: {thread.get('email_type')}")
                    st.markdown("---")
        
        # Check if we are viewing a specific thread
        if st.session_state.get("selected_thread_id"):
            thread_id = st.session_state.selected_thread_id
            if st.button("⬅️ Back to Thread List"):
                data = st.session_state.pop("selected_thread_id") 
                st.rerun()
            
            thread = load_thread_details(thread_id)
            if thread:
                st.markdown(f"### {thread.get('subject', 'No Subject')}")
                st.markdown(f"**Status:** `{thread.get('status')}` | **Client:** `{thread.get('client_id', 'None')}`")
                
                emails = thread.get("emails", [])
                st.markdown(f"#### Messages ({len(emails)})")
                
                for email in emails:
                    # Determine sender and recipients based on model structure
                    from_addr = email.get("from_address") or email.get("sender", {}).get("email_address", {}).get("address", "")
                    from_name = email.get("from_name") or email.get("sender", {}).get("email_address", {}).get("name", "")
                    if from_name and from_addr and from_name != from_addr:
                        sender = f"{from_name} <{from_addr}>"
                    elif from_name:
                        sender = from_name
                    elif from_addr:
                        sender = from_addr
                    else:
                        sender = "Unknown"
                    
                    recipients = email.get("to_recipients", [])
                    if recipients and isinstance(recipients[0], dict):
                        recipients_str = ', '.join([r.get('email_address', {}).get('address', '') for r in recipients])
                    else:
                        recipients_str = ', '.join([str(r) for r in recipients])
                    
                    is_outgoing = email.get("direction") == "outgoing" or email.get("is_from_me", False)
                    
                    with st.chat_message("assistant" if is_outgoing else "user"):
                        st.markdown(f"**From:** {sender}  \n**To:** {recipients_str}") 
                        st.markdown(f"**Subject:** {email.get('subject')}")
                        
                        # Preview logic
                        body = email.get("body") or email.get("body_html", "")
                        preview = email.get("body_preview")
                        if not preview and body:
                            # Create simple preview from body
                            import re
                            clean_body = re.sub('<[^<]+?>', '', body) # Remove HTML
                            preview = clean_body[:100] + "..." if len(clean_body) > 100 else clean_body
                            
                        st.markdown(preview or "No content")
                        
                        if body:
                            with st.expander("View Full Body"):
                                st.markdown(body, unsafe_allow_html=True)
                        st.caption(f"Sent: {email.get('sent_date_time') or email.get('received_date_time')}")
            else:
                st.error("Failed to load thread details")
                
        # Show Thread List
        elif st.session_state.get("threads_list"):
            df = pd.DataFrame(st.session_state.threads_list)
            st.dataframe(df[["id", "subject", "status", "message_count", "last_activity_at"]], width='stretch')
            
            st.markdown("### Select Thread to View")
            for thread in st.session_state.threads_list:
                col1, col2, col3 = st.columns([3, 1, 1])
                with col1:
                    st.text(f"{thread.get('subject', 'No Subject')[:50]}...")
                with col2:
                    st.caption(thread.get('status'))
                with col3:
                    if st.button("View", key=f"view_thread_{thread['id']}"):
                        st.session_state.selected_thread_id = thread["id"]
                        st.rerun()
        
        if st.button("Get Thread Statuses"):
            result = make_api_call("GET", "/threads/statuses")
            if result.get("success"):
                st.json(result["data"])
    
    # Templates Tab
    with tabs[3]:
        st.markdown("### Email Templates")
        
        if st.button("Load All Templates"):
            result = load_templates()
            st.success(f"Loaded {result.get('total', 0)} templates")
            
            if st.session_state.templates:
                for template in st.session_state.templates:
                    with st.expander(f"📝 {template.get('name', 'Unnamed')}"):
                        st.json(template)
    
    # Signatures Tab
    with tabs[4]:
        st.markdown("### Email Signatures")
        
        if st.button("Load All Signatures"):
            result = load_signatures()
            st.success(f"Loaded {result.get('total', 0)} signatures")
            
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
                if status.get("active"):
                    st.success("✅ Webhook subscription active")
                else:
                    st.warning("⚠️ No active subscription")
                st.json(status)
        
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
                    results = result["data"].get("results", [])
                    st.success(f"Found {len(results)} results")
                    
                    if results:
                        df = pd.DataFrame(results)
                        st.dataframe(df, width='stretch')
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
            
            st.dataframe(df, width='stretch')
        else:
            st.info("No test results yet. Run some tests to see results here.")

# Main Application
def main():
    """Main application entry point"""
    st.set_page_config(
        page_title="Email Module Test UI",
        page_icon="📧",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Initialize session state
    init_session_state()
    
    # Top navigation
    col1, col2, col3 = st.columns([2, 3, 2])
    
    with col1:
        st.markdown("## 📧 Email Module")
    
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
                        # Load initial data
                        load_clients()
                        load_templates()
                        load_signatures()
                        st.rerun()
                    else:
                        st.error("❌ Authentication failed")
            
            # OAuth Login Button
            st.markdown("### Or")
            
            # Helper function to get auth URL
            def get_auth_url_and_redirect():
                try:
                    result = make_api_call("GET", "/auth/login", params={"redirect_url": "http://localhost:8501"}, require_auth=False)
                    if result.get("success"):
                        auth_url = result["data"].get("auth_url")
                        if auth_url:
                            st.link_button("🔐 Login with Microsoft", auth_url, type="primary", width='stretch')
                        else:
                            st.error("Could not generate auth URL")
                    else:
                        st.error("Failed to connect to backend")
                except Exception as e:
                    st.error(f"Error: {e}")

            get_auth_url_and_redirect()
            
            # Check if token was just set from URL
            if st.session_state.auth_token and not st.session_state.current_user:
                if authenticate_user(st.session_state.auth_token):
                    st.success("✅ Authenticated via OAuth!")
                    load_clients()
                    load_templates()
                    load_signatures()
                    st.rerun()
    
    with col3:
        if st.session_state.current_user:
            user_name = st.session_state.current_user.get("full_name", "User")
            st.markdown(f"### 👤 {user_name}")
    
    st.markdown("---")
    
    # Main layout
    main_tabs = st.tabs(["📨 Inbox", "🧪 Testing Panel"])
    
    # Inbox Tab
    with main_tabs[0]:
        if not st.session_state.auth_token:
            st.warning("⚠️ Please login to access the email inbox")
        else:
            # Three-column layout
            col1, col2, col3 = st.columns([1, 2, 3])
            
            with col1:
                render_sidebar()
            
            with col2:
                render_email_list()
            
            with col3:
                render_email_viewer()
    
    # Testing Panel Tab
    with main_tabs[1]:
        if not st.session_state.auth_token:
            st.warning("⚠️ Please login to access testing panel")
        else:
            render_testing_panel()

if __name__ == "__main__":
    main()
