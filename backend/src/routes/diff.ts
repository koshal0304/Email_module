import { Router } from 'express';
import createError from 'http-errors';
import { documentService } from '../services/documentService';
import { diffService } from '../services/diffService';
import { storageService } from '../services/storageService';

const router = Router();

// GET /api/diff/:id
router.get('/:id', async (req, res, next) => {
    try {
        const doc = await documentService.getDocument(req.params.id);

        if (!doc) {
            throw createError(404, 'Document not found');
        }

        if (!doc.modifiedPath) {
            throw createError(404, 'No modified version available yet. Please edit and save the document first.');
        }

        const originalPath = storageService.getOriginalPath(doc.id);
        const modifiedPath = storageService.getModifiedPath(doc.id);

        const diff = await diffService.generateDiff(doc.id, originalPath, modifiedPath);

        // Log action
        await documentService.logAction(doc.id, 'COMPARED');

        res.json(diff);
    } catch (err) {
        next(err);
    }
});

// GET /api/diff/:id/summary
router.get('/:id/summary', async (req, res, next) => {
    try {
        const doc = await documentService.getDocument(req.params.id);

        if (!doc) {
            throw createError(404, 'Document not found');
        }

        if (!doc.modifiedPath) {
            throw createError(404, 'No modified version available');
        }

        const originalPath = storageService.getOriginalPath(doc.id);
        const modifiedPath = storageService.getModifiedPath(doc.id);

        const result = await diffService.generateDiff(doc.id, originalPath, modifiedPath);

        res.json({
            document_id: result.documentId,
            total_additions: result.totalAdditions,
            total_deletions: result.totalDeletions,
            lines_changed: result.lineDiffs.length,
            summary: result.summary,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
