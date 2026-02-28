/**
 * Cryptographic utilities — Node.js runtime only.
 * Do NOT import in Edge runtime (middleware).
 */
import { createHash } from 'crypto';

/**
 * Returns a deterministic SHA-256 hash of the given string,
 * prefixed with "sha256:" for readability in logs.
 */
export function hashSHA256(input: string): string {
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}
