/**
 * Strips all undefined fields recursively from an object to ensure Firestore zero-crash compliance.
 */
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}
