const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

/**
 * Extracts raw text from a PDF file.
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(pdfPath) {
    const resolvedPath = path.resolve(pdfPath);

    // Check file exists
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`PDF file not found: ${resolvedPath}`);
    }

    const buffer = fs.readFileSync(resolvedPath);
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    await parser.load();

    const numPages = parser.doc.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
        const page = await parser.doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    // Check for empty/scanned PDFs
    if (!fullText || fullText.trim().length === 0) {
        throw new Error(
            'No extractable text found in PDF. This may be a scanned image PDF — ' +
            'try OCR preprocessing (e.g. ocrmypdf) before running this tool.'
        );
    }

    console.log(`Extracted ${fullText.length} characters from ${path.basename(pdfPath)} (${numPages} pages)`);
    return fullText;
}

module.exports = { extractText };
