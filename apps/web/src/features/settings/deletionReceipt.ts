// Kept outside the private draft namespace so logout/deletion cannot erase the only receipt.
// The token is a bearer capability: never put it in URLs or telemetry.
const KEY = 'fancy-deletion-receipt';
export function readDeletionReceipt(): string | null {
  try {
    const token = sessionStorage.getItem(KEY);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch { return null; }
}
export function ensureDeletionReceipt(): string {
  const existing = readDeletionReceipt();
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  // Persistence must succeed before the server receives the destructive request.
  sessionStorage.setItem(KEY, token);
  if (sessionStorage.getItem(KEY) !== token) throw new Error('RECEIPT_STORAGE_UNAVAILABLE');
  return token;
}
