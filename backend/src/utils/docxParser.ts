import mammoth from 'mammoth';
import fs from 'fs/promises';

export async function extractTextFromDocx(filePath: string): Promise<string> {
    try {
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } catch (error) {
        throw new Error(`Error extracting text from DOCX: ${error}`);
    }
}

export async function extractParagraphsFromDocx(filePath: string): Promise<string[]> {
    try {
        const text = await extractTextFromDocx(filePath);
        return text.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
        throw new Error(`Error extracting paragraphs: ${error}`);
    }
}

export async function extractHtmlFromDocx(filePath: string): Promise<string> {
    try {
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.convertToHtml({ buffer });
        return result.value;
    } catch (error) {
        throw new Error(`Error converting DOCX to HTML: ${error}`);
    }
}
