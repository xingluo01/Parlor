export type DocumentChunk = {
  id: string;
  text: string;
  documentId: string;
  index: number;
};

/**
 * Split text into overlapping chunks for RAG vectorization.
 * @param text The raw document text
 * @param documentId The parent document ID
 * @param chunkSize Max characters per chunk (default 400)
 * @param overlap Overlap between chunks (default 50)
 */
export function chunkDocument(text: string, documentId: string, chunkSize = 400, overlap = 50): DocumentChunk[] {
  // Split by paragraphs first, then by size
  const chunks: DocumentChunk[] = [];
  let idx = 0;
  let pos = 0;
  while (pos < text.length) {
    const end = Math.min(pos + chunkSize, text.length);
    chunks.push({
      id: `${documentId}-${idx}`,
      text: text.slice(pos, end).trim(),
      documentId,
      index: idx,
    });
    idx++;
    pos = end - overlap;
    if (pos >= text.length) break;
  }
  return chunks.filter(c => c.text.length > 0);
}
