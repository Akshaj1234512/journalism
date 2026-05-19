/**
 * Extract plain text from a dropped or uploaded file.
 *
 * Supported:
 *   .docx  (Word, and Google Docs exported as Word)
 *   .txt   (plain text)
 *
 * Other types are rejected with a helpful message.
 *
 * Mammoth is loaded dynamically so it does not bloat the initial bundle.
 * It only loads the first time the user actually uploads a Word document.
 */

const MAX_BYTES = 2_000_000; // 2 MB ceiling on uploaded drafts

export interface ExtractResult {
  text: string;
  sourceName: string;
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1_000_000).toFixed(1)} MB. Please trim it to under ${(MAX_BYTES / 1_000_000).toFixed(0)} MB.`,
    );
  }

  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".txt") || file.type === "text/plain") {
    const text = await file.text();
    return { text: normalise(text), sourceName: name };
  }

  if (lower.endsWith(".docx")) {
    const text = await extractDocx(file);
    return { text: normalise(text), sourceName: name };
  }

  if (lower.endsWith(".doc")) {
    throw new Error(
      "This is an old Word .doc file. Open it in Word or Google Docs and save it as .docx, then try again.",
    );
  }

  if (lower.endsWith(".pdf")) {
    throw new Error(
      "PDF uploads aren't supported yet. Copy the text directly into the editor, or save the PDF as .docx first.",
    );
  }

  throw new Error(
    "Unsupported file type. Drop a .docx or .txt file. For Google Docs, choose File then Download then Microsoft Word (.docx).",
  );
}

async function extractDocx(file: File): Promise<string> {
  // Dynamic import keeps mammoth out of the initial bundle.
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Collapse Windows line endings, strip non-breaking spaces, trim. */
function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
