import { useState, useEffect } from 'react';
import { getDiffSummary } from '../services/api';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';

export default function StatsPanel({ documentId }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                setLoading(true);
                const data = await getDiffSummary(documentId);
                setStats(data);
                setError(null);
            } catch (err) {
                setError('No statistics available yet');
                setStats(null);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [documentId]);

    if (loading) {
        return (
            <div className="stats-panel loading">
                <div className="spinner small"></div>
                <span>Loading stats...</span>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="stats-panel empty">
                <FileText size={24} />
                <p>No changes recorded yet</p>
                <p className="hint">Edit and save the document to see statistics</p>
            </div>
        );
    }

    const totalChanges = stats.total_additions + stats.total_deletions;
    const additionPercent = totalChanges > 0
        ? Math.round((stats.total_additions / totalChanges) * 100)
        : 0;

    return (
        <div className="stats-panel">
            <h3>Change Statistics</h3>

            <div className="stats-grid">
                <div className="stat-card additions">
                    <div className="stat-icon">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-value">+{stats.total_additions}</div>
                    <div className="stat-label">Characters Added</div>
                </div>

                <div className="stat-card deletions">
                    <div className="stat-icon">
                        <TrendingDown size={24} />
                    </div>
                    <div className="stat-value">-{stats.total_deletions}</div>
                    <div className="stat-label">Characters Removed</div>
                </div>

                <div className="stat-card lines">
                    <div className="stat-icon">
                        <Minus size={24} />
                    </div>
                    <div className="stat-value">{stats.lines_changed}</div>
                    <div className="stat-label">Lines Changed</div>
                </div>
            </div>

            <div className="change-bar">
                <div
                    className="additions-bar"
                    style={{ width: `${additionPercent}%` }}
                />
                <div
                    className="deletions-bar"
                    style={{ width: `${100 - additionPercent}%` }}
                />
            </div>

            <div className="stats-summary">
                <p>{stats.summary}</p>
            </div>
        </div>
    );
}
