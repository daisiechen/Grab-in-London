export type AssistantCode = 'AI_UNAVAILABLE' | 'AI_SESSION_EXPIRED' | 'AI_RESULT_EXPIRED' | 'AI_SUPERSEDED' | 'AI_CONFLICT' | 'AI_INVALID_PREFERENCES' | 'AI_BUDGET_EXCEEDED' | 'AI_QUOTA_EXCEEDED' | 'DRAFT_EXPIRED' | 'TARGET_CHANGED' | 'EDITOR_CONFLICT';
export class AssistantError extends Error {
  readonly code: AssistantCode;
  constructor(code: AssistantCode) {
    super(code);
    this.name = 'AssistantError';
    this.code = code;
  }
}
