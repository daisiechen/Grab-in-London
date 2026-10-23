import * as SecureStore from 'expo-secure-store';

/** The removal reference is the only credential retained across session expiry/deletion. No personal content. */
export interface DeletionReceipt { ownerId: string; key: string; receiptToken: string }
export interface DeletionReceiptStore {
  read(): Promise<DeletionReceipt | null>;
  write(value: DeletionReceipt): Promise<void>;
  /** expectedToken prevents a late forget action from removing a newer reference. */
  clear(expectedToken?: string): Promise<void>;
}
const KEY = 'fancy.deletion.receipt.v1';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function valid(v: unknown): v is DeletionReceipt {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return Object.keys(x).sort().join(',') === 'key,ownerId,receiptToken' && uuid(x.ownerId) && uuid(x.key) && typeof x.receiptToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(x.receiptToken);
}
const project = (v: DeletionReceipt): DeletionReceipt => ({ ownerId: v.ownerId, key: v.key, receiptToken: v.receiptToken });
export function secureDeletionReceiptStore(): DeletionReceiptStore {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T,>(job: () => Promise<T>): Promise<T> => { const next = tail.then(job); tail = next.catch(() => undefined); return next; };
  const read = async () => {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { /* Invalid saved metadata is never used. */ }
    if (!valid(value)) { await SecureStore.deleteItemAsync(KEY, OPTIONS); throw new Error('Saved removal reference is unavailable'); }
    return project(value);
  };
  return {
    read: () => serial(read),
    write: value => serial(async () => {
      if (!valid(value)) throw new Error('Invalid removal reference metadata');
      await SecureStore.setItemAsync(KEY, JSON.stringify(project(value)), OPTIONS);
    }),
    clear: expectedToken => serial(async () => { if (expectedToken !== undefined && (await read())?.receiptToken !== expectedToken) return; await SecureStore.deleteItemAsync(KEY, OPTIONS); }),
  };
}
/** Isolated component tests share this object across services to model secure persistence. */
export function memoryDeletionReceiptStore(): DeletionReceiptStore {
  let value: DeletionReceipt | null = null;
  return { read: async () => value ? project(value) : null, write: async next => { if (!valid(next)) throw new Error('Invalid removal reference metadata'); value = project(next); }, clear: async expected => { if (expected === undefined || value?.receiptToken === expected) value = null; } };
}
