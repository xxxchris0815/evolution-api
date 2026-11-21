/**
 * Normalize media content for WhatsApp status sends.
 * Strips data-URI prefixes so base64 buffers decode correctly.
 */
export function normalizeStatusMediaContent(content: string): string {
  if (!content) {
    return content;
  }

  const dataUriMatch = content.match(/^data:[^;]+;base64,(.+)$/i);
  if (dataUriMatch?.[1]) {
    return dataUriMatch[1];
  }

  return content;
}
