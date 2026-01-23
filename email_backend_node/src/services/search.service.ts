// =============================================================================
// Search Service
// =============================================================================
// Elasticsearch integration for full-text email search
// =============================================================================

import { getElasticsearchClient, EMAIL_INDEX } from '../config/elasticsearch';

import { prisma } from '../config/database';
import { ElasticsearchError } from '../utils/exceptions';
import { Email } from '@prisma/client';
import { SearchQuery, SearchResult, PaginatedResponse } from '../types';

// =============================================================================
// Indexing
// =============================================================================

/**
 * Indexes a single email in Elasticsearch
 */
export async function indexEmail(email: Email): Promise<void> {
    const client = getElasticsearchClient();
    if (!client) return;

    try {
        await client.index({
            index: EMAIL_INDEX,
            id: email.id,
            document: {
                id: email.id,
                threadId: email.threadId,
                subject: email.subject,
                body: email.body,
                bodyPreview: email.bodyPreview,
                fromAddress: email.fromAddress,
                fromName: email.fromName,
                toRecipients: extractAddresses(email.toRecipients),
                ccRecipients: extractAddresses(email.ccRecipients),
                emailType: email.emailType,
                clientId: email.clientId,
                userId: email.userId,
                receivedDateTime: email.receivedDateTime,
                hasAttachments: email.hasAttachments,
                isRead: email.isRead,
                isFlagged: email.isFlagged,
                importance: email.importance,
            },
        });
    } catch (error) {
        console.error('Failed to index email:', error);
        throw new ElasticsearchError('Failed to index email');
    }
}

/**
 * Indexes multiple emails in bulk
 */
export async function bulkIndexEmails(emails: Email[]): Promise<{
    indexed: number;
    errors: number;
}> {
    const client = getElasticsearchClient();
    if (!client) return { indexed: 0, errors: 0 };

    const result = { indexed: 0, errors: 0 };

    try {
        const operations = emails.flatMap((email) => [
            { index: { _index: EMAIL_INDEX, _id: email.id } },
            {
                id: email.id,
                threadId: email.threadId,
                subject: email.subject,
                body: email.body,
                bodyPreview: email.bodyPreview,
                fromAddress: email.fromAddress,
                fromName: email.fromName,
                toRecipients: extractAddresses(email.toRecipients),
                ccRecipients: extractAddresses(email.ccRecipients),
                emailType: email.emailType,
                clientId: email.clientId,
                userId: email.userId,
                receivedDateTime: email.receivedDateTime,
                hasAttachments: email.hasAttachments,
                isRead: email.isRead,
                isFlagged: email.isFlagged,
                importance: email.importance,
            },
        ]);

        const response = await client.bulk({ operations });

        if (response.errors) {
            for (const item of response.items) {
                if (item.index?.error) {
                    result.errors++;
                } else {
                    result.indexed++;
                }
            }
        } else {
            result.indexed = emails.length;
        }
    } catch (error) {
        console.error('Bulk indexing failed:', error);
        result.errors = emails.length;
    }

    return result;
}

/**
 * Removes an email from the index
 */
export async function removeFromIndex(emailId: string): Promise<void> {
    const client = getElasticsearchClient();
    if (!client) return;

    try {
        await client.delete({
            index: EMAIL_INDEX,
            id: emailId,
        });
    } catch (error) {
        // Ignore if document doesn't exist
        console.error('Failed to remove from index:', error);
    }
}

// =============================================================================
// Search
// =============================================================================

/**
 * Performs full-text search across emails
 */
export async function searchEmails(
    userId: string,
    query: SearchQuery
): Promise<PaginatedResponse<SearchResult>> {
    const client = getElasticsearchClient();

    // Fall back to database search if Elasticsearch is not available
    if (!client) {
        return searchEmailsFromDatabase(userId, query);
    }

    const { page = 1, limit = 20 } = query.pagination || {};
    const from = (page - 1) * limit;

    try {
        // Build must clauses
        const must: object[] = [{ term: { userId: userId } }];

        // Add text search
        if (query.query) {
            must.push({
                multi_match: {
                    query: query.query,
                    fields: ['subject^3', 'body', 'bodyPreview', 'fromAddress', 'fromName'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                },
            });
        }

        // Build filter clauses
        const filter: object[] = [];

        if (query.filters?.emailType) {
            filter.push({ term: { emailType: query.filters.emailType } });
        }

        if (query.filters?.clientId) {
            filter.push({ term: { clientId: query.filters.clientId } });
        }

        if (query.filters?.isRead !== undefined) {
            filter.push({ term: { isRead: query.filters.isRead } });
        }

        if (query.filters?.isFlagged !== undefined) {
            filter.push({ term: { isFlagged: query.filters.isFlagged } });
        }

        if (query.filters?.fromAddress) {
            filter.push({ term: { fromAddress: query.filters.fromAddress } });
        }

        if (query.filters?.startDate || query.filters?.endDate) {
            const range: Record<string, unknown> = {};
            if (query.filters.startDate) {
                range.gte = query.filters.startDate;
            }
            if (query.filters.endDate) {
                range.lte = query.filters.endDate;
            }
            filter.push({ range: { receivedDateTime: range } });
        }

        const response = await client.search({
            index: EMAIL_INDEX,
            from,
            size: limit,
            query: {
                bool: {
                    must,
                    filter,
                },
            },
            highlight: {
                fields: {
                    subject: {},
                    body: { fragment_size: 150 },
                },
            },
            sort: [{ _score: { order: 'desc' } }, { receivedDateTime: 'desc' }],
        });

        const total =
            typeof response.hits.total === 'number'
                ? response.hits.total
                : response.hits.total?.value || 0;

        const results: SearchResult[] = response.hits.hits.map((hit) => {
            const source = hit._source as Record<string, unknown>;
            return {
                id: source.id as string,
                subject: source.subject as string,
                bodyPreview: source.bodyPreview as string,
                fromAddress: source.fromAddress as string,
                fromName: source.fromName as string | undefined,
                receivedDateTime: new Date(source.receivedDateTime as string),
                emailType: source.emailType as SearchResult['emailType'],
                score: hit._score || 0,
                highlights: hit.highlight
                    ? {
                          subject: hit.highlight.subject,
                          body: hit.highlight.body,
                      }
                    : undefined,
            };
        });

        return {
            data: results,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        };
    } catch (error) {
        console.error('Elasticsearch search failed:', error);
        // Fall back to database search
        return searchEmailsFromDatabase(userId, query);
    }
}

/**
 * Fallback database search when Elasticsearch is unavailable
 */
async function searchEmailsFromDatabase(
    userId: string,
    query: SearchQuery
): Promise<PaginatedResponse<SearchResult>> {
    const { page = 1, limit = 20 } = query.pagination || {};
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
        userId,
        OR: query.query
            ? [
                  { subject: { contains: query.query, mode: 'insensitive' } },
                  { bodyPreview: { contains: query.query, mode: 'insensitive' } },
                  { fromAddress: { contains: query.query, mode: 'insensitive' } },
              ]
            : undefined,
    };

    if (query.filters?.emailType) {
        where.emailType = query.filters.emailType;
    }

    if (query.filters?.clientId) {
        where.clientId = query.filters.clientId;
    }

    const [emails, total] = await Promise.all([
        prisma.email.findMany({
            where,
            skip,
            take: limit,
            orderBy: { receivedDateTime: 'desc' },
        }),
        prisma.email.count({ where }),
    ]);

    const results: SearchResult[] = emails.map((email) => ({
        id: email.id,
        subject: email.subject,
        bodyPreview: email.bodyPreview || '',
        fromAddress: email.fromAddress,
        fromName: email.fromName || undefined,
        receivedDateTime: email.receivedDateTime || new Date(),
        emailType: email.emailType || undefined,
        score: 1,
    }));

    return {
        data: results,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
        },
    };
}

// =============================================================================
// Suggestions
// =============================================================================

/**
 * Gets search suggestions based on partial input
 */
export async function getSuggestions(
    userId: string,
    prefix: string,
    limit = 10
): Promise<string[]> {
    const client = getElasticsearchClient();

    if (!client) {
        // Fall back to database
        const emails = await prisma.email.findMany({
            where: {
                userId,
                subject: { startsWith: prefix, mode: 'insensitive' },
            },
            select: { subject: true },
            take: limit,
            distinct: ['subject'],
        });

        return emails.map((e) => e.subject);
    }

    try {
        const response = await client.search({
            index: EMAIL_INDEX,
            size: 0,
            query: {
                bool: {
                    must: [{ term: { userId } }, { prefix: { subject: prefix.toLowerCase() } }],
                },
            },
            aggs: {
                suggestions: {
                    terms: {
                        field: 'subject.keyword',
                        size: limit,
                    },
                },
            },
        });

        const aggs = response.aggregations as Record<string, unknown>;
        const suggestions = aggs?.suggestions as { buckets: Array<{ key: string }> };

        return suggestions?.buckets?.map((b) => b.key) || [];
    } catch (error) {
        console.error('Failed to get suggestions:', error);
        return [];
    }
}

// =============================================================================
// Filter Options
// =============================================================================

/**
 * Gets available filter options for the current user
 */
export async function getFilterOptions(userId: string): Promise<{
    emailTypes: string[];
    senders: string[];
    hasUnread: boolean;
    hasFlagged: boolean;
}> {
    const [emailTypes, senders, unreadCount, flaggedCount] = await Promise.all([
        prisma.email.findMany({
            where: { userId, emailType: { not: null } },
            select: { emailType: true },
            distinct: ['emailType'],
        }),
        prisma.email.findMany({
            where: { userId },
            select: { fromAddress: true },
            distinct: ['fromAddress'],
            take: 50,
        }),
        prisma.email.count({ where: { userId, isRead: false } }),
        prisma.email.count({ where: { userId, isFlagged: true } }),
    ]);

    return {
        emailTypes: emailTypes.map((e) => e.emailType!).filter(Boolean),
        senders: senders.map((e) => e.fromAddress),
        hasUnread: unreadCount > 0,
        hasFlagged: flaggedCount > 0,
    };
}

// =============================================================================
// Helpers
// =============================================================================

function extractAddresses(recipients: unknown): string[] {
    if (!Array.isArray(recipients)) return [];

    return recipients
        .map((r) => {
            if (typeof r === 'object' && r !== null) {
                return (r as Record<string, unknown>).address as string;
            }
            return null;
        })
        .filter((addr): addr is string => typeof addr === 'string');
}

// =============================================================================
// Service Export
// =============================================================================

export const searchService = {
    indexEmail,
    bulkIndexEmails,
    removeFromIndex,
    searchEmails,
    getSuggestions,
    getFilterOptions,
};

export default searchService;
