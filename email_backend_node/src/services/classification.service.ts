// =============================================================================
// Email Classification Service
// =============================================================================
// Rule-based email classification for tax-related communications
// =============================================================================

import { EmailType } from '@prisma/client';

// =============================================================================
// Classification Rules
// =============================================================================

interface ClassificationRule {
    type: EmailType;
    priority: number;
    subjectPatterns: RegExp[];
    bodyPatterns: RegExp[];
}

const classificationRules: ClassificationRule[] = [
    {
        type: 'NIL_FILING',
        priority: 1,
        subjectPatterns: [/nil\s*filing/i, /nil\s*return/i, /zero\s*return/i, /no\s*transaction/i],
        bodyPatterns: [/nil\s*filing/i, /nil\s*return/i, /no\s*taxable\s*transaction/i],
    },
    {
        type: 'VAT_FILING',
        priority: 2,
        subjectPatterns: [
            /vat\s*filing/i,
            /vat\s*return/i,
            /vat\s*submission/i,
            /value\s*added\s*tax/i,
        ],
        bodyPatterns: [/vat\s*filing/i, /vat\s*return/i, /vat\s*compliance/i],
    },
    {
        type: 'GST_FILING',
        priority: 3,
        subjectPatterns: [
            /gst\s*filing/i,
            /gst\s*return/i,
            /gstr[\-\s]*\d/i,
            /goods\s*(and|&)\s*services\s*tax/i,
        ],
        bodyPatterns: [/gst\s*filing/i, /gst\s*return/i, /gstr[\-\s]*\d/i, /gstin/i],
    },
    {
        type: 'ITR_SUBMISSION',
        priority: 4,
        subjectPatterns: [
            /itr\s*submission/i,
            /itr\s*filing/i,
            /income\s*tax\s*return/i,
            /itr[\-\s]*\d/i,
        ],
        bodyPatterns: [
            /itr\s*submission/i,
            /itr\s*filing/i,
            /income\s*tax\s*return/i,
            /assessment\s*year/i,
        ],
    },
    {
        type: 'DOC_REQUEST',
        priority: 5,
        subjectPatterns: [
            /document\s*request/i,
            /documents?\s*required/i,
            /please\s*provide/i,
            /requesting\s*documents/i,
        ],
        bodyPatterns: [
            /please\s*provide/i,
            /kindly\s*share/i,
            /documents?\s*required/i,
            /attach\s*the\s*following/i,
        ],
    },
    {
        type: 'COMPLIANCE_NOTICE',
        priority: 6,
        subjectPatterns: [
            /compliance\s*notice/i,
            /tax\s*notice/i,
            /income\s*tax\s*department/i,
            /demand\s*notice/i,
            /scrutiny/i,
        ],
        bodyPatterns: [
            /compliance\s*notice/i,
            /tax\s*notice/i,
            /income\s*tax\s*department/i,
            /demand\s*notice/i,
            /section\s*\d+/i,
        ],
    },
    {
        type: 'RTI_SUBMISSION',
        priority: 7,
        subjectPatterns: [/rti\s*submission/i, /rti\s*application/i, /right\s*to\s*information/i],
        bodyPatterns: [/rti\s*submission/i, /rti\s*application/i, /right\s*to\s*information/i],
    },
];

// =============================================================================
// Classification Functions
// =============================================================================

/**
 * Classifies an email based on subject and body content
 */
export function classifyEmail(subject: string, body?: string): EmailType {
    const subjectLower = subject.toLowerCase();
    const bodyLower = body?.toLowerCase() || '';

    // Sort rules by priority (lower number = higher priority)
    const sortedRules = [...classificationRules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
        // Check subject patterns
        for (const pattern of rule.subjectPatterns) {
            if (pattern.test(subjectLower)) {
                return rule.type;
            }
        }

        // Check body patterns
        for (const pattern of rule.bodyPatterns) {
            if (pattern.test(bodyLower)) {
                return rule.type;
            }
        }
    }

    // Default classification
    return 'GENERAL';
}

/**
 * Gets confidence score for a classification
 */
export function getClassificationConfidence(
    subject: string,
    body: string | undefined,
    type: EmailType
): number {
    if (type === 'GENERAL') {
        return 0.5; // Low confidence for general classification
    }

    const rule = classificationRules.find((r) => r.type === type);
    if (!rule) {
        return 0;
    }

    const subjectLower = subject.toLowerCase();
    const bodyLower = body?.toLowerCase() || '';

    let matches = 0;
    let totalPatterns = rule.subjectPatterns.length + rule.bodyPatterns.length;

    for (const pattern of rule.subjectPatterns) {
        if (pattern.test(subjectLower)) {
            matches += 2; // Subject matches are weighted higher
        }
    }

    for (const pattern of rule.bodyPatterns) {
        if (pattern.test(bodyLower)) {
            matches += 1;
        }
    }

    return Math.min(matches / totalPatterns, 1);
}

/**
 * Gets all possible classifications with confidence scores
 */
export function getAllClassifications(
    subject: string,
    body?: string
): Array<{ type: EmailType; confidence: number }> {
    const results: Array<{ type: EmailType; confidence: number }> = [];

    for (const rule of classificationRules) {
        const confidence = getClassificationConfidence(subject, body, rule.type);
        if (confidence > 0) {
            results.push({ type: rule.type, confidence });
        }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    // Add GENERAL if no classifications found
    if (results.length === 0) {
        results.push({ type: 'GENERAL', confidence: 1 });
    }

    return results;
}

/**
 * Gets human-readable name for an email type
 */
export function getEmailTypeName(type: EmailType): string {
    const names: Record<EmailType, string> = {
        NIL_FILING: 'Nil Filing',
        VAT_FILING: 'VAT Filing',
        GST_FILING: 'GST Filing',
        ITR_SUBMISSION: 'ITR Submission',
        DOC_REQUEST: 'Document Request',
        COMPLIANCE_NOTICE: 'Compliance Notice',
        RTI_SUBMISSION: 'RTI Submission',
        GENERAL: 'General',
    };

    return names[type] || type;
}

/**
 * Gets all available email types
 */
export function getAllEmailTypes(): Array<{ type: EmailType; name: string }> {
    return Object.values(EmailType).map((type) => ({
        type,
        name: getEmailTypeName(type),
    }));
}

// =============================================================================
// Service Export
// =============================================================================

export const classificationService = {
    classifyEmail,
    getClassificationConfidence,
    getAllClassifications,
    getEmailTypeName,
    getAllEmailTypes,
};

export default classificationService;
