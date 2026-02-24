import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { config } from '../config';

const ORIGINAL_DIR = path.join(config.storageRoot, 'original');
const MODIFIED_DIR = path.join(config.storageRoot, 'modified');

// Create directories if they don't exist
for (const dir of [ORIGINAL_DIR, MODIFIED_DIR]) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export class StorageService {
    originalDir = ORIGINAL_DIR;
    modifiedDir = MODIFIED_DIR;

    async saveOriginal(file: Express.Multer.File, docId: string): Promise<string> {
        const ext = path.extname(file.originalname) || '.docx';
        const filename = `${docId}_original${ext}`;
        const dest = path.join(ORIGINAL_DIR, filename);

        await fsPromises.writeFile(dest, file.buffer);
        return dest;
    }

    async saveModified(docId: string, content: Buffer): Promise<string> {
        const filename = `${docId}_modified.docx`;
        const dest = path.join(MODIFIED_DIR, filename);

        await fsPromises.writeFile(dest, content);
        return dest;
    }

    getOriginalPath(docId: string): string {
        const files = fs.readdirSync(ORIGINAL_DIR).filter(f => f.startsWith(`${docId}_original`));
        if (!files.length) {
            throw new Error('Original document not found');
        }
        return path.join(ORIGINAL_DIR, files[0]);
    }

    getModifiedPath(docId: string): string {
        const filename = `${docId}_modified.docx`;
        const filePath = path.join(MODIFIED_DIR, filename);

        if (!fs.existsSync(filePath)) {
            throw new Error('Modified document not found');
        }
        return filePath;
    }

    documentExists(docId: string): boolean {
        const files = fs.readdirSync(ORIGINAL_DIR).filter(f => f.startsWith(`${docId}_original`));
        return files.length > 0;
    }
}

export const storageService = new StorageService();
