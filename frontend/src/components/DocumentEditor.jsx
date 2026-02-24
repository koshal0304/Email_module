import { useEffect, useRef, useState } from 'react';
import { getEditorConfig } from '../services/api';
import { ONLYOFFICE_URL } from '../config';

export default function DocumentEditor({ documentId, onClose }) {
    const editorRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let docEditor = null;

        const initEditor = async () => {
            try {
                setLoading(true);
                const editorData = await getEditorConfig(documentId);

                // Check if ONLYOFFICE API is available
                if (typeof window.DocsAPI === 'undefined') {
                    throw new Error('ONLYOFFICE Document Server is not available. Please ensure it is running.');
                }

                // Initialize ONLYOFFICE editor
                docEditor = new window.DocsAPI.DocEditor('onlyoffice-editor', {
                    ...editorData.config,
                    token: editorData.token,
                    events: {
                        onReady: () => {
                            console.log('ONLYOFFICE Editor is ready');
                            setLoading(false);
                        },
                        onError: (event) => {
                            console.error('ONLYOFFICE Error:', event);
                            setError('Editor error occurred');
                        },
                        onDocumentStateChange: (event) => {
                            console.log('Document state changed:', event.data);
                        },
                    },
                });

                editorRef.current = docEditor;
            } catch (err) {
                console.error('Failed to initialize editor:', err);
                setError(err.message || 'Failed to load editor');
                setLoading(false);
            }
        };

        initEditor();

        return () => {
            if (docEditor && docEditor.destroyEditor) {
                docEditor.destroyEditor();
            }
        };
    }, [documentId]);

    if (error) {
        return (
            <div className="editor-error">
                <div className="error-content">
                    <h3>⚠️ Editor Error</h3>
                    <p>{error}</p>
                    <p className="error-hint">
                        Make sure ONLYOFFICE Document Server is running at {ONLYOFFICE_URL}
                    </p>
                    <button onClick={onClose} className="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="document-editor">
            <div className="editor-header">
                <h2>Document Editor</h2>
                <button onClick={onClose} className="btn btn-close">
                    ✕ Close
                </button>
            </div>

            {loading && (
                <div className="editor-loading">
                    <div className="spinner"></div>
                    <p>Loading ONLYOFFICE Editor...</p>
                </div>
            )}

            <div
                id="onlyoffice-editor"
                className="editor-container"
                style={{ display: loading ? 'none' : 'block' }}
            />
        </div>
    );
}
