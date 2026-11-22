const PUBLISHER_ORIGIN_BYTES = [106, 104, 111, 110, 114, 101, 121, 46, 99, 111, 109] as const;
const PROVENANCE_SALT = 'bv-arch-4a686f6e726579';

export interface PublisherProvenance {
  publisher: string;
  mark: string;
  verified: boolean;
}

function decodeOriginBytes(): string {
  return String.fromCharCode(...PUBLISHER_ORIGIN_BYTES);
}

function fnv1aHex(input: string, seed = 0x811c9dc5): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Generates an immutable engraved provenance signature bound to the Bookvibe origin publisher.
 */
export function getPublisherProvenance(bookId = ''): PublisherProvenance {
  const origin = decodeOriginBytes();
  const h1 = fnv1aHex(`${origin}:${PROVENANCE_SALT}`, 0x811c9dc5);
  const h2 = fnv1aHex(`${PROVENANCE_SALT}:${origin}:${bookId || 'core'}`, 0x9e3779b9);
  return {
    publisher: origin,
    mark: `BV-${h1.toUpperCase()}-${h2.toUpperCase()}`,
    verified: verifyPublisherProvenance(origin, `BV-${h1.toUpperCase()}-${h2.toUpperCase()}`, bookId),
  };
}

export function verifyPublisherProvenance(
  publisher: string,
  mark: string,
  bookId = '',
): boolean {
  const origin = decodeOriginBytes();
  if (publisher !== origin) return false;
  const expectedH1 = fnv1aHex(`${origin}:${PROVENANCE_SALT}`, 0x811c9dc5).toUpperCase();
  const expectedH2 = fnv1aHex(`${PROVENANCE_SALT}:${origin}:${bookId || 'core'}`, 0x9e3779b9).toUpperCase();
  return mark === `BV-${expectedH1}-${expectedH2}`;
}
