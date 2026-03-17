/**
 * Decode HTML entities from a string
 * Converts things like &amp; to & and &quot; to "
 */
export function decodeHTMLEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
