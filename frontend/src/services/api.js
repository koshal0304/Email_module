import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Document APIs
export const uploadDocument = async (file, docType = 'BOP') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    const response = await api.post('/api/documents/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const getDocuments = async () => {
    const response = await api.get('/api/documents');
    return response.data;
};

export const getEditorConfig = async (docId, mode = 'edit') => {
    const response = await api.get(`/api/documents/${docId}/editor`, {
        params: { mode },
    });
    return response.data;
};

export const getDocumentStatus = async (docId) => {
    const response = await api.get(`/api/documents/${docId}/status`);
    return response.data;
};

// Diff APIs
export const getDocumentDiff = async (docId) => {
    const response = await api.get(`/api/diff/${docId}`);
    return response.data;
};

export const getDiffSummary = async (docId) => {
    const response = await api.get(`/api/diff/${docId}/summary`);
    return response.data;
};

export default api;
