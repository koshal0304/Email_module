import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { signOnlyofficePayload } from '../utils/jwtHelper';
import { EditorConfig, OnlyofficeConfig } from '../types';

const prisma = new PrismaClient();

export class DocumentService {
    async createDocument(params: {
        type: 'BOP' | 'NTR' | 'COI';
        originalName: string;
        originalPath: string;
        sizeBytes: number;
    }) {
        return prisma.document.create({
            data: {
                type: params.type,
                originalName: params.originalName,
                originalPath: params.originalPath,
                sizeBytes: params.sizeBytes,
            },
        });
    }

    async getDocument(id: string) {
        return prisma.document.findUnique({ where: { id } });
    }

    async setModifiedPath(id: string, modifiedPath: string) {
        return prisma.document.update({
            where: { id },
            data: {
                modifiedPath,
                version: { increment: 1 },
                updatedAt: new Date()
            },
        });
    }

    async updateOriginalPath(id: string, originalPath: string) {
        return prisma.document.update({
            where: { id },
            data: { originalPath },
        });
    }

    async getAllDocuments() {
        return prisma.document.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    buildEditorConfig(doc: {
        id: string;
        type: string;
        originalPath: string;
        originalName: string;
    }): EditorConfig {
        const docKey = `${doc.id}_${Date.now()}`;
        const fileUrl = `http://localhost:${config.port}/api/documents/${doc.id}/download`;
        const callbackUrl = `http://localhost:${config.port}/api/documents/${doc.id}/callback`;

        const onlyofficeConfig: OnlyofficeConfig = {
            document: {
                fileType: 'docx',
                key: docKey,
                title: `${doc.type}_${doc.originalName}`,
                url: fileUrl,
                permissions: {
                    edit: true,
                    download: true,
                    review: true,
                },
            },
            documentType: 'word',
            editorConfig: {
                callbackUrl,
                mode: 'edit',
                lang: 'en',
                user: {
                    id: 'tax-analyst-001',
                    name: 'Tax Analyst',
                },
                customization: {
                    autosave: true,
                    forcesave: true,
                    trackChanges: true,
                    comments: true,
                    features: {
                        spellcheck: true,
                    },
                },
            },
        };

        const token = signOnlyofficePayload(onlyofficeConfig);

        return {
            documentId: doc.id,
            editorUrl: config.onlyofficeUrl,
            config: onlyofficeConfig,
            token,
        };
    }

    async logAction(documentId: string, action: string, userId?: string, metadata?: any) {
        return prisma.auditLog.create({
            data: {
                documentId,
                action,
                userId,
                metadata,
            },
        });
    }
}

export const documentService = new DocumentService();
