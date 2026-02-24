import { Router } from 'express';
import multer from 'multer';
import createError from 'http-errors';
import axios from 'axios';
import { documentService } from '../services/documentService';
import { storageService } from '../services/storageService';
import { OnlyofficeCallback } from '../types';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST /api/documents/upload
router.post(
    '/upload',
    upload.single('file'),
    async (req, res, next) => {
        try {
            const file = req.file;
            const type = (req.body.doc_type || 'BOP') as 'BOP' | 'NTR' | 'COI';

            if (!file) {
                throw createError(400, 'File is required');
            }

            if (!file.originalname.match(/\.(docx|doc)$/i)) {
                throw createError(400, 'Only DOCX files are supported');
            }

            // Create DB record first to get ID
            const doc = await documentService.createDocument({
                type,
                originalName: file.originalname,
                originalPath: '',
                sizeBytes: file.size,
            });

            // Save file to storage
            const originalPath = await storageService.saveOriginal(file, doc.id);

            // Update document with path
            await documentService.updateOriginalPath(doc.id, originalPath);

            // Log action
            await documentService.logAction(doc.id, 'CREATED');

            res.json({
                id: doc.id,
                type: doc.type,
                title: doc.originalName,
                file_type: doc.type,
                original_filename: doc.originalName,
                file_size: doc.sizeBytes,
                version: doc.version,
                created_at: doc.createdAt,
                modified_at: doc.updatedAt,
            });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/documents
router.get('/', async (req, res, next) => {
    try {
        const documents = await documentService.getAllDocuments();
        res.json(documents);
    } catch (err) {
        next(err);
    }
});

// GET /api/documents/:id/editor
router.get('/:id/editor', async (req, res, next) => {
    try {
        const doc = await documentService.getDocument(req.params.id);

        if (!doc) {
            throw createError(404, 'Document not found');
        }

        const editorConfig = documentService.buildEditorConfig({
            id: doc.id,
            type: doc.type,
            originalPath: doc.originalPath,
            originalName: doc.originalName,
        });

        res.json(editorConfig);
    } catch (err) {
        next(err);
    }
});

// GET /api/documents/:id/download (for ONLYOFFICE)
router.get('/:id/download', async (req, res, next) => {
    try {
        const doc = await documentService.getDocument(req.params.id);

        if (!doc) {
            throw createError(404, 'Document not found');
        }

        const filePath = storageService.getOriginalPath(doc.id);
        res.download(filePath, doc.originalName);
    } catch (err) {
        next(err);
    }
});

// POST /api/documents/:id/callback (from ONLYOFFICE)
router.post('/:id/callback', async (req, res, next) => {
    try {
        const callback: OnlyofficeCallback = req.body;
        const { status, url } = callback;

        // Status codes:
        // 0 - Document not found
        // 1 - Document editing
        // 2 - Document ready for saving
        // 3 - Document saving error
        // 4 - Document closed without changes
        // 6 - Document being edited, forcesave
        // 7 - Error during forcesave

        if (status === 2 || status === 6) {
            if (!url) {
                return res.json({ error: 1 });
            }

            try {
                // Download modified document from ONLYOFFICE
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                });

                const buffer = Buffer.from(response.data);

                // Save modified document
                const modifiedPath = await storageService.saveModified(req.params.id, buffer);

                // Update document record
                await documentService.setModifiedPath(req.params.id, modifiedPath);

                // Log action
                await documentService.logAction(req.params.id, 'EDITED');

                return res.json({ error: 0 });
            } catch (error) {
                console.error('Error saving document:', error);
                return res.json({ error: 1 });
            }
        }

        res.json({ error: 0 });
    } catch (err) {
        next(err);
    }
});

// GET /api/documents/:id/status
router.get('/:id/status', async (req, res, next) => {
    try {
        const doc = await documentService.getDocument(req.params.id);

        if (!doc) {
            throw createError(404, 'Document not found');
        }

        res.json({
            document_id: doc.id,
            has_modifications: !!doc.modifiedPath,
            original_path: doc.originalPath,
            modified_path: doc.modifiedPath,
            version: doc.version,
            updated_at: doc.updatedAt,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
