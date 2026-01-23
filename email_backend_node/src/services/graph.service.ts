// =============================================================================
// Microsoft Graph API Service
// =============================================================================
// Wrapper for Microsoft Graph API operations
// =============================================================================

import axios, { AxiosError, AxiosInstance } from 'axios';
import { config } from '../config';
import { GraphApiError } from '../utils/exceptions';
import {
    GraphMessage,
    GraphAttachment,
    GraphFolder,
    GraphSubscription,
    SendEmailRequest,
    EmailRecipient,
} from '../types';

// =============================================================================
// Types
// =============================================================================

interface GraphODataResponse<T> {
    value: T[];
    '@odata.nextLink'?: string;
    '@odata.deltaLink'?: string;
}

interface GraphApiErrorResponse {
    error: {
        code: string;
        message: string;
        innerError?: {
            'request-id'?: string;
            'client-request-id'?: string;
            date?: string;
        };
    };
}

// =============================================================================
// Graph Service Class
// =============================================================================

export class GraphService {
    private client: AxiosInstance;

    constructor(accessToken: string) {
        this.client = axios.create({
            baseURL: config.graph.baseUrl,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError<GraphApiErrorResponse>) => {
                const statusCode = error.response?.status || 500;
                const graphError = error.response?.data?.error;

                if (graphError) {
                    throw new GraphApiError(graphError.message, statusCode, {
                        code: graphError.code,
                        innerError: graphError.innerError,
                    });
                }

                throw new GraphApiError(
                    error.message || 'Microsoft Graph API request failed',
                    statusCode
                );
            }
        );
    }

    // ===========================================================================
    // User Operations
    // ===========================================================================

    /**
     * Gets current user information
     */
    async getCurrentUser(): Promise<Record<string, unknown>> {
        const response = await this.client.get('/me');
        return response.data;
    }

    // ===========================================================================
    // Message Operations
    // ===========================================================================

    /**
     * Lists messages with optional filtering
     * Can accept a nextLink to continue pagination
     */
    async listMessages(
        options: {
            folderId?: string | null;
            top?: number;
            skip?: number;
            select?: string[];
            filter?: string;
            search?: string;
            orderBy?: string;
            expand?: string[];
            nextLink?: string; // For pagination
        } = {}
    ): Promise<GraphODataResponse<GraphMessage>> {
        const {
            folderId,
            top = 50,
            skip = 0,
            select,
            filter,
            search,
            orderBy = 'receivedDateTime desc',
            expand,
            nextLink,
        } = options;

        // If nextLink is provided, use it directly (for pagination)
        if (nextLink) {
            const response = await this.client.get<GraphODataResponse<GraphMessage>>(nextLink);
            return response.data;
        }

        const params = new URLSearchParams();
        params.append('$top', top.toString());
        params.append('$skip', skip.toString());

        // $orderby cannot be used with $search or $filter (in some cases)
        if (orderBy && !search && !filter) {
            params.append('$orderby', orderBy);
        }

        if (search) {
            params.append('$search', search);
        }

        if (select?.length) {
            params.append('$select', select.join(','));
        }

        if (filter) {
            params.append('$filter', filter);
        }

        if (expand?.length) {
            params.append('$expand', expand.join(','));
        }

        // When folderId is explicitly null, search across all messages
        // When folderId is undefined, default to inbox
        // When folderId is a string, search in that specific folder
        const url =
            folderId === null
                ? `/me/messages?${params.toString()}`
                : folderId
                  ? `/me/mailFolders/${folderId}/messages?${params.toString()}`
                  : `/me/mailFolders/inbox/messages?${params.toString()}`;

        const response = await this.client.get<GraphODataResponse<GraphMessage>>(url);
        return response.data;
    }

    /**
     * Lists ALL messages by following pagination links
     * Use this for full sync operations
     */
    async listAllMessages(
        options: {
            folderId?: string | null;
            top?: number;
            select?: string[];
            filter?: string;
            orderBy?: string;
            expand?: string[];
        } = {}
    ): Promise<GraphMessage[]> {
        const allMessages: GraphMessage[] = [];
        let nextLink: string | undefined;
        let pageCount = 0;

        // Fetch first page
        let response = await this.listMessages(options);
        allMessages.push(...response.value);
        nextLink = response['@odata.nextLink'];
        pageCount++;

        // Follow pagination links
        while (nextLink) {
            pageCount++;
            response = await this.listMessages({ nextLink });
            allMessages.push(...response.value);
            nextLink = response['@odata.nextLink'];

            // Log progress
            if (pageCount % 10 === 0) {
                console.log(`Fetched ${pageCount} pages, ${allMessages.length} messages so far...`);
            }
        }

        console.log(`Completed fetching ${allMessages.length} messages across ${pageCount} pages`);
        return allMessages;
    }

    /**
     * Gets a single message by ID
     */
    async getMessage(messageId: string, includeHeaders = false): Promise<GraphMessage> {
        let url = `/me/messages/${messageId}`;

        if (includeHeaders) {
            url +=
                '?$select=id,subject,body,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,hasAttachments,importance,isRead,conversationId,conversationIndex,internetMessageId,parentFolderId,flag,internetMessageHeaders';
        }

        const response = await this.client.get<GraphMessage>(url);
        return response.data;
    }

    /**
     * Sends an email message
     */
    async sendEmail(email: SendEmailRequest & { taxEmailId?: string }): Promise<void> {
        const formatRecipients = (recipients: EmailRecipient[]) =>
            recipients.map((r) => ({
                emailAddress: { name: r.name, address: r.address },
            }));

        const message: any = {
            subject: email.subject,
            body: {
                contentType: email.bodyHtml ? 'HTML' : 'Text',
                content: email.bodyHtml || email.body,
            },
            toRecipients: formatRecipients(email.to),
            ccRecipients: email.cc ? formatRecipients(email.cc) : [],
            bccRecipients: email.bcc ? formatRecipients(email.bcc) : [],
            importance: email.importance || 'normal',
        };

        if (email.taxEmailId) {
            message.internetMessageHeaders = [{ name: 'X-Tax-Email-ID', value: email.taxEmailId }];
        }

        if (email.attachments && email.attachments.length > 0) {
            message.attachments = email.attachments.map((attachment) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: attachment.name,
                contentType: attachment.contentType,
                contentBytes: attachment.contentBytes,
            }));
        }

        const payload = {
            message,
            saveToSentItems: true,
        };

        await this.client.post('/me/sendMail', payload);
    }

    /**
     * Replies to an existing message
     */
    async replyToMessage(messageId: string, body: string, replyAll = false): Promise<void> {
        const endpoint = replyAll
            ? `/me/messages/${messageId}/replyAll`
            : `/me/messages/${messageId}/reply`;

        await this.client.post(endpoint, {
            message: {
                body: {
                    contentType: 'HTML',
                    content: body,
                },
            },
        });
    }

    /**
     * Forwards a message
     */
    async forwardMessage(messageId: string, to: EmailRecipient[], comment?: string): Promise<void> {
        await this.client.post(`/me/messages/${messageId}/forward`, {
            toRecipients: to.map((r) => ({
                emailAddress: { name: r.name, address: r.address },
            })),
            comment,
        });
    }

    /**
     * Updates message properties (read status, flag, etc.)
     */
    async updateMessage(
        messageId: string,
        updates: Partial<{
            isRead: boolean;
            flag: { flagStatus: string };
            categories: string[];
        }>
    ): Promise<GraphMessage> {
        const response = await this.client.patch<GraphMessage>(
            `/me/messages/${messageId}`,
            updates
        );
        return response.data;
    }

    /**
     * Deletes a message
     */
    async deleteMessage(messageId: string): Promise<void> {
        await this.client.delete(`/me/messages/${messageId}`);
    }

    /**
     * Moves a message to a different folder
     */
    async moveMessage(messageId: string, destinationFolderId: string): Promise<GraphMessage> {
        const response = await this.client.post<GraphMessage>(`/me/messages/${messageId}/move`, {
            destinationId: destinationFolderId,
        });
        return response.data;
    }

    // ===========================================================================
    // Attachment Operations
    // ===========================================================================

    /**
     * Lists attachments for a message
     */
    async listAttachments(messageId: string): Promise<GraphAttachment[]> {
        const response = await this.client.get<GraphODataResponse<GraphAttachment>>(
            `/me/messages/${encodeURIComponent(messageId)}/attachments`
        );
        return response.data.value;
    }

    /**
     * Gets a specific attachment with content
     */
    async getAttachment(messageId: string, attachmentId: string): Promise<GraphAttachment> {
        const response = await this.client.get<GraphAttachment>(
            `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
        );
        return response.data;
    }

    // ===========================================================================
    // Folder Operations
    // ===========================================================================

    /**
     * Lists mail folders
     */
    async listFolders(): Promise<GraphFolder[]> {
        const response = await this.client.get<GraphODataResponse<GraphFolder>>('/me/mailFolders');
        return response.data.value;
    }

    /**
     * Gets a specific folder
     */
    async getFolder(folderId: string): Promise<GraphFolder> {
        const response = await this.client.get<GraphFolder>(`/me/mailFolders/${folderId}`);
        return response.data;
    }

    // ===========================================================================
    // Delta (Incremental Sync)
    // ===========================================================================

    /**
     * Gets delta changes for messages
     */
    async getDelta(
        deltaLink?: string,
        folderId = 'inbox'
    ): Promise<{
        messages: GraphMessage[];
        deltaLink?: string;
    }> {
        let url = deltaLink || `/me/mailFolders/${folderId}/messages/delta`;

        const allMessages: GraphMessage[] = [];
        let nextLink: string | undefined = url;
        let finalDeltaLink: string | undefined;

        while (nextLink) {
            const response: { data: GraphODataResponse<GraphMessage> } =
                await this.client.get<GraphODataResponse<GraphMessage>>(nextLink);
            allMessages.push(...response.data.value);
            nextLink = response.data['@odata.nextLink'];
            finalDeltaLink = response.data['@odata.deltaLink'];
        }

        return {
            messages: allMessages,
            deltaLink: finalDeltaLink,
        };
    }

    // ===========================================================================
    // Webhook Subscriptions
    // ===========================================================================

    /**
     * Creates a webhook subscription for mail notifications
     */
    async createSubscription(
        notificationUrl: string,
        clientState: string
    ): Promise<GraphSubscription> {
        const expirationDateTime = new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000 // 3 days (max for mail)
        ).toISOString();

        const response = await this.client.post<GraphSubscription>('/subscriptions', {
            changeType: 'created,updated,deleted',
            notificationUrl,
            resource: '/me/mailFolders/inbox/messages',
            expirationDateTime,
            clientState,
        });

        return response.data;
    }

    /**
     * Renews an existing subscription
     */
    async renewSubscription(subscriptionId: string): Promise<GraphSubscription> {
        const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        const response = await this.client.patch<GraphSubscription>(
            `/subscriptions/${subscriptionId}`,
            { expirationDateTime }
        );

        return response.data;
    }

    /**
     * Deletes a subscription
     */
    async deleteSubscription(subscriptionId: string): Promise<void> {
        await this.client.delete(`/subscriptions/${subscriptionId}`);
    }

    /**
     * Lists all subscriptions
     */
    async listSubscriptions(): Promise<GraphSubscription[]> {
        const response =
            await this.client.get<GraphODataResponse<GraphSubscription>>('/subscriptions');
        return response.data.value;
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new GraphService instance with the provided access token
 */
export function createGraphService(accessToken: string): GraphService {
    return new GraphService(accessToken);
}

export default GraphService;
