import { useState, useEffect } from 'react';
import { getDocumentDiff } from '../services/api';

export default function DiffViewer({ documentId }) {
    const [diff, setDiff] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('unified'); // 'unified' | 'split'

    useEffect(() => {
        const loadDiff = async () => {
            try {
                setLoading(true);
                setError(null);
                const diffData = await getDocumentDiff(documentId);
                setDiff(diffData);
            } catch (err) {
                console.error('Failed to load diff:', err);
                setError(err.response?.data?.error?.message || 'No changes detected yet. Edit and save the document first.');
            } finally {
                setLoading(false);
            }
        };

        loadDiff();
    }, [documentId]);

    if (loading) {
        return (
            <div className="diff-loading">
                <div className="spinner"></div>
                <p>Generating diff...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="diff-error">
                <div className="error-icon">📝</div>
                <p>{error}</p>
            </div>
        );
    }

    if (!diff) {
        return null;
    }

    return (
        <div className="diff-viewer">
            <div className="diff-header">
                <h3>Document Changes</h3>
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${viewMode === 'unified' ? 'active' : ''}`}
                        onClick={() => setViewMode('unified')}
                    >
                        Unified
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
                        onClick={() => setViewMode('split')}
                    >
                        Split
                    </button>
                </div>
            </div>

            <div className="diff-stats">
                <span className="stat additions">+{diff.totalAdditions} added</span>
                <span className="stat deletions">-{diff.totalDeletions} removed</span>
                <span className="stat unchanged">{diff.totalUnchanged} unchanged</span>
            </div>

            <div className="diff-summary">
                <p>{diff.summary}</p>
            </div>

            {viewMode === 'unified' ? (
                <div className="diff-unified">
                    <div
                        className="html-diff"
                        dangerouslySetInnerHTML={{ __html: diff.htmlDiff }}
                    />
                </div>
            ) : (
                <div className="diff-split">
                    <div className="split-pane original">
                        <h4>Original</h4>
                        <div className="lines">
                            {diff.lineDiffs.map((line, idx) => (
                                <div key={idx} className="line deleted">
                                    <span className="line-number">{line.lineNumber}</span>
                                    <span className="line-content">{line.original || '(empty)'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="split-pane modified">
                        <h4>Modified</h4>
                        <div className="lines">
                            {diff.lineDiffs.map((line, idx) => (
                                <div key={idx} className="line added">
                                    <span className="line-number">{line.lineNumber}</span>
                                    <span className="line-content">{line.modified || '(empty)'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {diff.lineDiffs.length > 0 && (
                <div className="line-by-line">
                    <h4>Line-by-Line Changes</h4>
                    {diff.lineDiffs.map((line, idx) => (
                        <div key={idx} className="line-diff">
                            <div className="line-header">Line {line.lineNumber}</div>
                            <div className="line-changes">
                                {line.changes.map((change, changeIdx) => (
                                    <span
                                        key={changeIdx}
                                        className={`change ${change.operation}`}
                                    >
                                        {change.text}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
