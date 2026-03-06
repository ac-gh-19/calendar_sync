const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

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

  const dataBuffer = fs.readFileSync(resolvedPath);
  const data = await pdfParse(dataBuffer);

  // Check for empty/scanned PDFs
  if (!data.text || data.text.trim().length === 0) {
    throw new Error(
      'No extractable text found in PDF. This may be a scanned image PDF — ' +
      'try OCR preprocessing (e.g. ocrmypdf) before running this tool.'
    );
  }

  console.log(`Extracted ${data.text.length} characters from ${path.basename(pdfPath)} (${data.numpages} pages)`);
  return data.text;
}

module.exports = { extractText };
