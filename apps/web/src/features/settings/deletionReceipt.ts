// Kept outside the private draft namespace so logout/deletion cannot erase the only receipt.
// The token is a bearer capability: never put it in URLs or telemetry.
const KEY = 'fancy-deletion-receipt';
type ReceiptStatus = {status:'PENDING'|'PROCESSING'|'COMPLETED'|'NEEDS_SUPPORT';requestedAt:string;completedAt:string|null};
export function readSavedDeletionStatus():ReceiptStatus|null {
  try {const value=JSON.parse(sessionStorage.getItem(`${KEY}:status`)??'null');return value&&['PENDING','PROCESSING','COMPLETED','NEEDS_SUPPORT'].includes(value.status)&&typeof value.requestedAt==='string'&&(value.completedAt===null||typeof value.completedAt==='string')?value:null;}catch{return null;}
}
export function rememberDeletionStatus(status:ReceiptStatus):void {try {sessionStorage.setItem(`${KEY}:status`,JSON.stringify(status));}catch{/* The pre-saved token remains usable for a fresh status lookup. */}}
export function readDeletionReceipt(): string | null {
  try {
    const token = sessionStorage.getItem(KEY);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch { return null; }
}
export function ensureDeletionReceipt(): string {
  const existing = readDeletionReceipt();
  if (existing && !readSavedDeletionStatus()) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  // Persistence must succeed before the server receives the destructive request.
  sessionStorage.setItem(KEY, token);
  sessionStorage.removeItem(`${KEY}:status`);
  if (sessionStorage.getItem(KEY) !== token) throw new Error('RECEIPT_STORAGE_UNAVAILABLE');
  return token;
}
