export type DocumentChunk = {
  id: string;
  text: string;
  documentId: string;
  index: number;
};

/**
 * Split text into overlapping chunks for RAG vectorization.
 * Async to avoid blocking the main thread on large files.
 * @param text The raw document text
 * @param documentId The parent document ID
 * @param chunkSize Max characters per chunk (default 400)
 * @param overlap Overlap between chunks (default 50)
 */
export async function chunkDocument(text: string, documentId: string, chunkSize = 400, overlap = 50): Promise<DocumentChunk[]> {
  // Yield once at the start so the calling context can breathe
  await new Promise(resolve => setTimeout(resolve, 0));

  const chunks: DocumentChunk[] = [];
  let idx = 0;
  let pos = 0;
  while (pos < text.length) {
    // Every 100 chunks, yield to the event loop to keep the UI responsive
    if (idx > 0 && idx % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
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
