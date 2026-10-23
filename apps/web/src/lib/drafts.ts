import { clearAll, readJson, remove, writeJson } from './storage.ts';

/**
 * Unsent user input (application intro, create-meal form, profile edits) kept across the
 * sign-in / profile-gate detour. Drafts are only ever restored into the form; submitting
 * again is always an explicit user action (core plan §5: no automatic replay).
 */
export type DraftKey = `apply:${string}` | 'create' | `edit:${string}` | 'profile' | `message:${string}`;

export const loadDraft = <T>(key: DraftKey): T | null => readJson<T>(`draft.${key}`);
export const saveDraft = (key: DraftKey, value: unknown): void => {
  if ((key === 'create' || key.startsWith('edit:')) && value && typeof value === 'object' && 'venue' in value) {
    const venue = value.venue;
    if (venue && typeof venue === 'object') {
      // Provider display data stays in component memory; durable drafts retain IDs only.
      writeJson(`draft.${key}`, { ...value, venue: { ...venue, name: null, address: null, location: null, attributions: [], displayExpiresAt: null } });
      return;
    }
  }
  writeJson(`draft.${key}`, value);
};
export const clearDraft = (key: DraftKey): void => remove(`draft.${key}`);
const memoryResets = new Set<() => void>();
/** In-memory private state (e.g. pending feedback intents) registers here to die with the session. */
export const onPrivateStateClear = (reset: () => void): (() => void) => { memoryResets.add(reset); return () => { memoryResets.delete(reset); }; };
/** Every sign-out / 401 / account switch / deletion path: storage and registered memory together. */
export const clearAllPrivateState = (): void => { clearAll(); for (const reset of memoryResets) reset(); };

const EXPIRED_APPLICATION='auth.expiredApplication';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
interface ExpiredApplication {ownerUserId:string;mealId:string;intro:string}
/** Capture only this authenticated editor before private-state destruction, never another form or cache. */
export function captureExpiredApplication(ownerUserId:string,pathname:string):ExpiredApplication|null{
 const match=/^\/meals\/([^/]+)\/apply$/.exec(pathname);const mealId=match?.[1];
 if(!UUID.test(ownerUserId)||!mealId||!UUID.test(mealId))return null;
 const value=loadDraft<{intro?:unknown}>(`apply:${mealId}`);
 return typeof value?.intro==='string'&&value.intro.length>0&&value.intro.length<=300?{ownerUserId,mealId,intro:value.intro}:null;
}
/** Same-tab lifetime only. Guests never read this key as a normal application draft. */
export function quarantineExpiredApplication(value:ExpiredApplication|null){if(value)writeJson(EXPIRED_APPLICATION,value);}
/** Only a trusted authenticated session may consume this; a different owner discards it. */
export function restoreExpiredApplication(userId:string):void{
 const value:unknown=readJson(EXPIRED_APPLICATION);remove(EXPIRED_APPLICATION);
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const p=value as Record<string,unknown>;
 if(Object.keys(p).sort().join(',')!=='intro,mealId,ownerUserId'||p.ownerUserId!==userId||!UUID.test(userId)||typeof p.mealId!=='string'||!UUID.test(p.mealId)||typeof p.intro!=='string'||!p.intro.length||p.intro.length>300)return;
 saveDraft(`apply:${p.mealId}`,{intro:p.intro});
}
