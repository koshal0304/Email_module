// =============================================================================
// Elasticsearch Client Configuration
// =============================================================================
// Singleton pattern for Elasticsearch with health checking
// =============================================================================

import { Client } from '@elastic/elasticsearch';
import { config } from './index';
import { createLogger } from '../utils/logger';

const logger = createLogger('Elasticsearch');

// =============================================================================
// Elasticsearch Client Singleton
// =============================================================================

let esClient: Client | null = null;

export function getElasticsearchClient(): Client | null {
    if (!config.elasticsearch.enabled) {
        return null;
    }

    if (!esClient) {
        esClient = new Client({
            node: config.elasticsearch.url,
            requestTimeout: 30000,
            maxRetries: 3,
        });
    }

    return esClient;
}

// =============================================================================
// Elasticsearch Health Check
// =============================================================================

export async function checkElasticsearchConnection(): Promise<boolean> {
    if (!config.elasticsearch.enabled) {
        logger.info('Elasticsearch disabled');
        return true;
    }

    try {
        const client = getElasticsearchClient();
        if (!client) return false;

        const health = await client.cluster.health();
        logger.info('Elasticsearch connected', { status: health.status });
        return true;
    } catch (error) {
        logger.error('Elasticsearch connection failed', error);
        return false;
    }
}

// =============================================================================
// Index Management
// =============================================================================

export const EMAIL_INDEX = 'emails';

export async function ensureEmailIndex(): Promise<void> {
    if (!config.elasticsearch.enabled) return;

    const client = getElasticsearchClient();
    if (!client) return;

    try {
        const indexExists = await client.indices.exists({ index: EMAIL_INDEX });

        if (!indexExists) {
            await client.indices.create({
                index: EMAIL_INDEX,
                body: {
                    settings: {
                        number_of_shards: 1,
                        number_of_replicas: 0,
                        analysis: {
                            analyzer: {
                                email_analyzer: {
                                    type: 'custom',
                                    tokenizer: 'standard',
                                    filter: ['lowercase', 'asciifolding'],
                                },
                            },
                        },
                    },
                    mappings: {
                        properties: {
                            id: { type: 'keyword' },
                            threadId: { type: 'keyword' },
                            subject: { type: 'text', analyzer: 'email_analyzer' },
                            body: { type: 'text', analyzer: 'email_analyzer' },
                            fromAddress: { type: 'keyword' },
                            fromName: { type: 'text' },
                            toRecipients: { type: 'keyword' },
                            emailType: { type: 'keyword' },
                            clientId: { type: 'keyword' },
                            userId: { type: 'keyword' },
                            receivedDateTime: { type: 'date' },
                            hasAttachments: { type: 'boolean' },
                            isRead: { type: 'boolean' },
                            importance: { type: 'keyword' },
                        },
                    },
                },
            });
            logger.info('Email index created successfully');
        }
    } catch (error) {
        logger.error('Failed to create email index', error);
    }
}

export default getElasticsearchClient;
