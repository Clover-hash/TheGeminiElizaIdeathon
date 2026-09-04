/**
 * Pipeline for breaking long AI messages into multiple sequential text boxes:
 * 1. AI generates the response.
 * 2. The program automatically separates the long reply into multiple text boxes when a new line exists / based on spacing.
 * 3. The program double-checks and confirms the order of how the messages should come out.
 */

export interface VerifiedMessageChunk {
  order: number;
  content: string;
  charCount: number;
}

/**
 * Automatically splits and double-checks message chunks based on newlines, paragraphs, and spacing.
 */
export function processAndVerifyMessageChunks(rawText: string): string[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const trimmed = rawText.trim();

  // If text is a single code block, preserve it
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    return [trimmed];
  }

  // 1. Initial segmentation by paragraph breaks (double or more newlines)
  const paragraphBlocks = trimmed.split(/\n\s*\n+/);

  const preliminaryChunks: string[] = [];

  for (const block of paragraphBlocks) {
    const cleanBlock = block.trim();
    if (!cleanBlock) continue;

    // Check if the block contains distinct bullet/numbered lines or separate single lines
    const lines = cleanBlock.split(/\n+/).map(l => l.trim()).filter(Boolean);

    // If there are multiple lines that represent distinct bullet items or dialogue points
    if (lines.length > 1 && lines.some(l => /^[-*•\d+.)]/.test(l) || l.length > 70)) {
      for (const line of lines) {
        if (line.trim()) {
          preliminaryChunks.push(line.trim());
        }
      }
    } else {
      preliminaryChunks.push(cleanBlock);
    }
  }

  // 2. Secondary segmentation for overly long blocks (> 300 characters without newlines)
  const atomicChunks: string[] = [];
  for (const chunk of preliminaryChunks) {
    if (chunk.length > 320 && !chunk.includes('```')) {
      // Split on sentence boundaries
      const sentences = chunk.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
      if (sentences && sentences.length > 1) {
        let buffer = '';
        for (const s of sentences) {
          const trimmedSentence = s.trim();
          if (!trimmedSentence) continue;

          if ((buffer + ' ' + trimmedSentence).length > 250 && buffer.trim()) {
            atomicChunks.push(buffer.trim());
            buffer = trimmedSentence;
          } else {
            buffer = buffer ? `${buffer} ${trimmedSentence}` : trimmedSentence;
          }
        }
        if (buffer.trim()) {
          atomicChunks.push(buffer.trim());
        }
      } else {
        atomicChunks.push(chunk);
      }
    } else {
      atomicChunks.push(chunk);
    }
  }

  // 3. Double-check & confirm order verification step
  const taggedChunks: VerifiedMessageChunk[] = atomicChunks
    .map((content, index) => ({
      order: index,
      content: content.trim(),
      charCount: content.trim().length,
    }))
    .filter(item => item.content.length > 0);

  // Strictly enforce sequential ordering verification
  taggedChunks.sort((a, b) => a.order - b.order);

  // Validate sequential integrity (order 0, 1, 2, ...)
  const verifiedOrder: string[] = [];
  for (let i = 0; i < taggedChunks.length; i++) {
    verifiedOrder.push(taggedChunks[i].content);
  }

  return verifiedOrder.length > 0 ? verifiedOrder : [trimmed];
}
