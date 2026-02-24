import { useState, useEffect } from 'react';
import DocumentList from './components/DocumentList';
import DocumentEditor from './components/DocumentEditor';
import DiffViewer from './components/DiffViewer';
import StatsPanel from './components/StatsPanel';
import { getDocuments } from './services/api';
import './styles/editor.css';
import './styles/diff.css';

export default function App() {
    const [documents, setDocuments] = useState([]);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'diff'
    const [loading, setLoading] = useState(true);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const docs = await getDocuments();
            setDocuments(docs);
        } catch (err) {
            console.error('Failed to load documents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleDocumentSelect = (doc) => {
        setSelectedDocument(doc);
        setActiveTab('editor');
    };

    const handleCloseEditor = () => {
        setSelectedDocument(null);
        loadDocuments(); // Refresh list after editing
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-content">
                    <h1>📄 Tax Document Editor</h1>
                    <p className="subtitle">Edit BOP & NTR Documents with Git-Style Change Tracking</p>
                </div>
            </header>

            <main className="app-main">
                {selectedDocument ? (
                    <div className="document-workspace">
                        <div className="workspace-header">
                            <div className="doc-info">
                                <h2>{selectedDocument.originalName}</h2>
                                <span className={`doc-type type-${selectedDocument.type.toLowerCase()}`}>
                                    {selectedDocument.type}
                                </span>
                            </div>

                            <div className="workspace-tabs">
                                <button
                                    className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('editor')}
                                >
                                    ✏️ Editor
                                </button>
                                <button
                                    className={`tab ${activeTab === 'diff' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('diff')}
                                >
                                    📊 View Changes
                                </button>
                            </div>

                            <button onClick={handleCloseEditor} className="btn btn-back">
                                ← Back to Documents
                            </button>
                        </div>

                        <div className="workspace-content">
                            {activeTab === 'editor' ? (
                                <div className="editor-layout">
                                    <div className="editor-main">
                                        <DocumentEditor
                                            documentId={selectedDocument.id}
                                            onClose={handleCloseEditor}
                                        />
                                    </div>
                                    <div className="editor-sidebar">
                                        <StatsPanel documentId={selectedDocument.id} />
                                    </div>
                                </div>
                            ) : (
                                <div className="diff-layout">
                                    <DiffViewer documentId={selectedDocument.id} />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="document-browser">
                        {loading ? (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Loading documents...</p>
                            </div>
                        ) : (
                            <DocumentList
                                documents={documents}
                                onDocumentSelect={handleDocumentSelect}
                                onRefresh={loadDocuments}
                            />
                        )}
                    </div>
                )}
            </main>

            <footer className="app-footer">
                <p>Tax Document Editor POC • Node.js + Express + Prisma + ONLYOFFICE</p>
            </footer>
        </div>
    );
}
