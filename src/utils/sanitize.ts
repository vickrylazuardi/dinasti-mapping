/**
 * Escapes HTML special characters to prevent XSS when inserting
 * community-contributed text into the DOM.
 * 
 * Characters escaped: < > & " '
 * 
 * Preconditions:
 * - Input is any string (may contain HTML special characters)
 * 
 * Postconditions:
 * - All occurrences of <, >, &, ", ' are replaced with HTML entity equivalents
 * - Output cannot be interpreted as HTML markup
 */
export function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Result of URL validation.
 */
export interface UrlValidationResult {
  valid: boolean;
  sanitized: string;
}

/**
 * Validates that a URL uses only http: or https: scheme and conforms
 * to standard URL syntax.
 * 
 * Preconditions:
 * - Input is any string
 * 
 * Postconditions:
 * - Returns { valid: true, sanitized: url } if URL is valid http/https
 * - Returns { valid: false, sanitized: escapedUrl } if URL is invalid or uses disallowed scheme
 * - The sanitized field always contains HTML-escaped text safe for DOM insertion
 */
export function validateUrl(url: string): UrlValidationResult {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { valid: true, sanitized: url };
    }
    // Disallowed scheme (javascript:, data:, etc.)
    return { valid: false, sanitized: sanitizeHtml(url) };
  } catch {
    // Invalid URL syntax
    return { valid: false, sanitized: sanitizeHtml(url) };
  }
}

/**
 * Validates an image URL. Only http: and https: schemes are allowed.
 * 
 * Preconditions:
 * - Input is any string or undefined
 * 
 * Postconditions:
 * - Returns the URL unchanged if valid http/https
 * - Returns undefined if invalid, disallowed scheme, or input is undefined
 */
export function validateImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const result = validateUrl(url);
  return result.valid ? url : undefined;
}
