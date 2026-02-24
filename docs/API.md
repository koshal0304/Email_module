# API Documentation - Node.js + Express Backend

## Base URL
```
http://localhost:8000
```

## Authentication
Currently no authentication. Add JWT middleware for production.

## Endpoints

### Documents API

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

Parameters:
- file: File (DOCX)
- doc_type: string (BOP | NTR | COI)
```

#### Get All Documents
```http
GET /api/documents
```

#### Get Editor Configuration
```http
GET /api/documents/{doc_id}/editor
```

#### Download Document
```http
GET /api/documents/{doc_id}/download
```

#### ONLYOFFICE Callback
```http
POST /api/documents/{doc_id}/callback
```

#### Get Document Status
```http
GET /api/documents/{doc_id}/status
```

### Diff API

#### Get Full Diff
```http
GET /api/diff/{doc_id}
```

#### Get Diff Summary
```http
GET /api/diff/{doc_id}/summary
```

### Health Check
```http
GET /health
```
