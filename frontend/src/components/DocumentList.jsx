import { useState, useRef } from 'react';
import { uploadDocument, getDocuments } from '../services/api';
import { FileText, Upload, Trash2, Eye } from 'lucide-react';

export default function DocumentList({ documents, onDocumentSelect, onRefresh }) {
    const [uploading, setUploading] = useState(false);
    const [docType, setDocType] = useState('BOP');
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.match(/\.docx?$/i)) {
            setError('Please upload a DOCX file');
            return;
        }

        try {
            setUploading(true);
            setError(null);
            await uploadDocument(file, docType);
            fileInputRef.current.value = '';
            onRefresh();
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.response?.data?.error?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="document-list">
            <div className="upload-section">
                <h3>Upload Document</h3>

                <div className="upload-controls">
                    <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="doc-type-select"
                    >
                        <option value="BOP">BOP - Basis of Preparation</option>
                        <option value="NTR">NTR - Notice to Reader</option>
                        <option value="COI">COI - Certificate of Incorporation</option>
                    </select>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        accept=".docx,.doc"
                        className="file-input"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="upload-btn">
                        <Upload size={18} />
                        {uploading ? 'Uploading...' : 'Choose File'}
                    </label>
                </div>

                {error && <div className="upload-error">{error}</div>}
            </div>

            <div className="documents-section">
                <div className="section-header">
                    <h3>Documents</h3>
                    <button onClick={onRefresh} className="refresh-btn">
                        ⟳ Refresh
                    </button>
                </div>

                {documents.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={48} />
                        <p>No documents uploaded yet</p>
                        <p className="hint">Upload a DOCX file to get started</p>
                    </div>
                ) : (
                    <div className="document-grid">
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="document-card"
                                onClick={() => onDocumentSelect(doc)}
                            >
                                <div className="doc-icon">
                                    <FileText size={32} />
                                </div>
                                <div className="doc-info">
                                    <h4 className="doc-name">{doc.originalName}</h4>
                                    <div className="doc-meta">
                                        <span className={`doc-type type-${doc.type.toLowerCase()}`}>
                                            {doc.type}
                                        </span>
                                        <span className="doc-size">{formatSize(doc.sizeBytes)}</span>
                                        <span className="doc-version">v{doc.version}</span>
                                    </div>
                                    <div className="doc-date">
                                        {formatDate(doc.createdAt)}
                                    </div>
                                    {doc.modifiedPath && (
                                        <div className="doc-modified">
                                            ✓ Has modifications
                                        </div>
                                    )}
                                </div>
                                <div className="doc-actions">
                                    <button className="action-btn" title="Open Editor">
                                        <Eye size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
