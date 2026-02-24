export interface DocumentMetadata {
    id: string;
    type: 'BOP' | 'NTR' | 'COI';
    originalName: string;
    originalPath: string;
    modifiedPath?: string | null;
    sizeBytes: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface EditorConfig {
    documentId: string;
    editorUrl: string;
    config: OnlyofficeConfig;
    token: string;
}

export interface OnlyofficeConfig {
    document: {
        fileType: string;
        key: string;
        title: string;
        url: string;
        permissions: {
            edit: boolean;
            download: boolean;
            review: boolean;
        };
    };
    documentType: string;
    editorConfig: {
        callbackUrl: string;
        mode: string;
        lang?: string;
        user: {
            id: string;
            name: string;
        };
        customization: {
            autosave: boolean;
            forcesave: boolean;
            trackChanges: boolean;
            comments?: boolean;
            features?: {
                spellcheck?: boolean;
            };
        };
    };
}

export interface OnlyofficeCallback {
    status: number;
    url?: string;
    users?: string[];
    key?: string;
}

export interface DiffSegment {
    operation: 'equal' | 'insert' | 'delete';
    text: string;
}

export interface LineDiff {
    lineNumber: number;
    original: string;
    modified: string;
    changes: DiffSegment[];
}

export interface DiffResult {
    documentId: string;
    totalAdditions: number;
    totalDeletions: number;
    totalUnchanged: number;
    htmlDiff: string;
    lineDiffs: LineDiff[];
    summary: string;
}
