import DiffMatchPatch from 'diff-match-patch';
import { extractTextFromDocx, extractParagraphsFromDocx } from '../utils/docxParser';
import { DiffResult, LineDiff, DiffSegment } from '../types';

const dmp = new DiffMatchPatch();

export class DiffService {
    async generateDiff(
        docId: string,
        originalPath: string,
        modifiedPath: string
    ): Promise<DiffResult> {
        // Extract text from both documents
        const originalText = await extractTextFromDocx(originalPath);
        const modifiedText = await extractTextFromDocx(modifiedPath);

        // Generate character-level diffs
        const diffs = dmp.diff_main(originalText, modifiedText);
        dmp.diff_cleanupSemantic(diffs);

        // Generate HTML diff with colors
        const htmlDiff = dmp.diff_prettyHtml(diffs);

        // Calculate statistics
        const totalAdditions = diffs
            .filter(d => d[0] === DiffMatchPatch.DIFF_INSERT)
            .reduce((acc, d) => acc + d[1].length, 0);

        const totalDeletions = diffs
            .filter(d => d[0] === DiffMatchPatch.DIFF_DELETE)
            .reduce((acc, d) => acc + d[1].length, 0);

        const totalUnchanged = diffs
            .filter(d => d[0] === DiffMatchPatch.DIFF_EQUAL)
            .reduce((acc, d) => acc + d[1].length, 0);

        // Generate line-by-line diffs
        const lineDiffs = await this.buildLineDiffs(originalPath, modifiedPath);

        // Generate summary
        const summary = this.generateSummary(totalAdditions, totalDeletions, lineDiffs.length);

        return {
            documentId: docId,
            totalAdditions,
            totalDeletions,
            totalUnchanged,
            htmlDiff,
            lineDiffs,
            summary,
        };
    }

    private async buildLineDiffs(
        originalPath: string,
        modifiedPath: string
    ): Promise<LineDiff[]> {
        const originalLines = await extractParagraphsFromDocx(originalPath);
        const modifiedLines = await extractParagraphsFromDocx(modifiedPath);

        const maxLines = Math.max(originalLines.length, modifiedLines.length);
        const result: LineDiff[] = [];

        for (let i = 0; i < maxLines; i++) {
            const origLine = originalLines[i] || '';
            const modLine = modifiedLines[i] || '';

            if (origLine === modLine) continue;

            // Generate character-level diff for this line
            const charDiffs = dmp.diff_main(origLine, modLine);
            dmp.diff_cleanupSemantic(charDiffs);

            const changes: DiffSegment[] = charDiffs.map(([op, text]) => ({
                operation:
                    op === DiffMatchPatch.DIFF_EQUAL ? 'equal' :
                        op === DiffMatchPatch.DIFF_INSERT ? 'insert' : 'delete',
                text,
            }));

            result.push({
                lineNumber: i + 1,
                original: origLine,
                modified: modLine,
                changes,
            });
        }

        return result;
    }

    private generateSummary(
        additions: number,
        deletions: number,
        changedLines: number
    ): string {
        return `${changedLines} lines changed: +${additions} characters added, -${deletions} characters removed`;
    }
}

export const diffService = new DiffService();
