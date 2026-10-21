import { clearAll, readJson, remove, writeJson } from './storage.ts';

/**
 * Unsent user input (application intro, create-meal form, profile edits) kept across the
 * sign-in / profile-gate detour. Drafts are only ever restored into the form; submitting
 * again is always an explicit user action (core plan §5: no automatic replay).
 */
export type DraftKey = `apply:${string}` | 'create' | `edit:${string}` | 'profile' | `message:${string}`;

export const loadDraft = <T>(key: DraftKey): T | null => readJson<T>(`draft.${key}`);
export const saveDraft = (key: DraftKey, value: unknown): void => writeJson(`draft.${key}`, value);
export const clearDraft = (key: DraftKey): void => remove(`draft.${key}`);
export const clearAllPrivateState = clearAll;
