// =============================================================================
// Type Definitions
// =============================================================================
// Centralized TypeScript interfaces for the email backend module
// =============================================================================

import {
    User,
    Client,
    Email,
    EmailThread,
    EmailAttachment,
    EmailSignature,
    EmailFooter,
    EmailTemplate,
    AuditLog,
    EmailType,
    ThreadStatus,
    EmailDirection,
    EmailStatus,
    UserRole,
} from '@prisma/client';

// =============================================================================
// Re-export Prisma Types
// =============================================================================

export {
    User,
    Client,
    Email,
    EmailThread,
    EmailAttachment,
    EmailSignature,
    EmailFooter,
    EmailTemplate,
    AuditLog,
    EmailType,
    ThreadStatus,
    EmailDirection,
    EmailStatus,
    UserRole,
};

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

// =============================================================================
// Authentication Types
// =============================================================================

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
}

export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
}

// =============================================================================
// Microsoft Graph API Types
// =============================================================================

export interface GraphUser {
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
    givenName?: string;
    surname?: string;
}

export interface GraphEmailAddress {
    emailAddress: {
        name?: string;
        address: string;
    };
}

export interface GraphMessage {
    id: string;
    subject: string;
    body: {
        content: string;
        contentType: string;
    };
    bodyPreview: string;
    from: GraphEmailAddress;
    toRecipients: GraphEmailAddress[];
    ccRecipients: GraphEmailAddress[];
    bccRecipients: GraphEmailAddress[];
    replyTo: GraphEmailAddress[];
    receivedDateTime: string;
    sentDateTime: string;
    hasAttachments: boolean;
    importance: string;
    isRead: boolean;
    conversationId: string;
    conversationIndex: string;
    internetMessageId: string;
    parentFolderId: string;
    flag?: {
        flagStatus: string;
    };
    internetMessageHeaders?: Array<{
        name: string;
        value: string;
    }>;
}

export interface GraphAttachment {
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
    contentBytes?: string;
}

export interface GraphFolder {
    id: string;
    displayName: string;
    parentFolderId: string;
    childFolderCount: number;
    unreadItemCount: number;
    totalItemCount: number;
}

export interface GraphSubscription {
    id: string;
    resource: string;
    changeType: string;
    clientState: string;
    notificationUrl: string;
    expirationDateTime: string;
}

export interface GraphWebhookNotification {
    subscriptionId: string;
    subscriptionExpirationDateTime: string;
    changeType: string;
    resource: string;
    resourceData: {
        id: string;
        '@odata.type': string;
        '@odata.id': string;
        '@odata.etag': string;
    };
    clientState?: string;
    tenantId: string;
}

// =============================================================================
// Email Types
// =============================================================================

export interface EmailRecipient {
    name?: string;
    address: string;
}

export interface SendEmailRequest {
    to: EmailRecipient[];
    cc?: EmailRecipient[];
    bcc?: EmailRecipient[];
    subject: string;
    body: string;
    bodyHtml?: string;
    threadId?: string;
    clientId?: string;
    replyToMessageId?: string;
    importance?: 'low' | 'normal' | 'high';
    attachments?: Array<{
        name: string;
        contentType: string;
        contentBytes: string;
    }>;
}

export interface EmailFilters {
    emailType?: EmailType;
    clientId?: string;
    isRead?: boolean;
    isFlagged?: boolean;
    fromAddress?: string;
    startDate?: Date;
    endDate?: Date;
    folderId?: string;
    search?: string;
}

export interface ThreadFilters {
    status?: ThreadStatus;
    emailType?: EmailType;
    clientId?: string;
    isArchived?: boolean;
    isFlagged?: boolean;
    search?: string;
}

// =============================================================================
// Search Types
// =============================================================================

export interface SearchQuery {
    query: string;
    filters?: EmailFilters;
    pagination?: PaginationParams;
}

export interface SearchResult {
    id: string;
    subject: string;
    bodyPreview: string;
    fromAddress: string;
    fromName?: string;
    receivedDateTime: Date;
    emailType?: EmailType;
    score: number;
    highlights?: {
        subject?: string[];
        body?: string[];
    };
}

// =============================================================================
// Sync Types
// =============================================================================

export interface SyncResult {
    synced: number;
    created: number;
    updated: number;
    errors: number;
    lastSyncTime: Date;
}

export interface SyncStatus {
    userId: string;
    lastSyncTime: Date | null;
    isSyncing: boolean;
    subscriptionActive: boolean;
    subscriptionExpiresAt: Date | null;
}

// =============================================================================
// Audit Types
// =============================================================================

export type AuditAction =
    | 'viewed'
    | 'sent'
    | 'replied'
    | 'forwarded'
    | 'deleted'
    | 'archived'
    | 'flagged'
    | 'marked_read'
    | 'marked_unread'
    | 'thread_resolved'
    | 'thread_archived'
    | 'client_linked'
    | 'synced';

export interface AuditLogEntry {
    userId: string;
    action: AuditAction;
    emailId?: string;
    threadId?: string;
    clientId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
}

// =============================================================================
// Template Types
// =============================================================================

export interface TemplateContext {
    [key: string]: string | number | boolean | undefined;
}

export interface RenderedTemplate {
    subject: string;
    body: string;
    bodyHtml?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
}

// =============================================================================
// Request Extensions
// =============================================================================

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            startTime?: number;
        }
    }
}
