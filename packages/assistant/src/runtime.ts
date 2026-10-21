import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AssistantError } from './errors.ts';
import {emptyPreferences,type Preferences} from './preferences.ts';

export const SESSION_TTL_MS = 30 * 60_000;
export const tokenHash = (value: string): string => createHash('sha256').update(value).digest('hex');
const matches = (value: string, hash: string) => timingSafeEqual(Buffer.from(tokenHash(value)), Buffer.from(hash));
export interface SessionBinding { subject: string; deviceToken: string; generation: number; preferenceEpoch: string }
interface Context {
  id: string; subject: string; deviceHash: string; revokeHash: string; generation: number;
  preferenceEpoch: string;guestPreferences:Preferences; lastActivity: number; events: Set<string>; text: string[];messages:Array<{role:'user'|'assistant';text:string}>;
  results: Map<string, unknown>; artifacts:Map<string,unknown>; conditions:{hard:Record<string,unknown>;cleared:string[]}; controller: AbortController | null;
}

/** Single-API-instance RAM only. No text serialization, log, filesystem or database interfaces. */
export class AssistantRuntime {
  private readonly contexts = new Map<string, Context>();
  private readonly now: () => number;
  private readonly maxSessions: number;
  constructor(options: { now?: () => number; maxSessions?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.maxSessions = options.maxSessions ?? 200;
  }
  create(subject: string, preferenceEpoch: string) {
    this.sweep();
    if (this.contexts.size >= this.maxSessions) throw new AssistantError('AI_UNAVAILABLE');
    const deviceToken = randomBytes(32).toString('base64url');
    const revokeHandle = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const context: Context = { id, subject, deviceHash: tokenHash(deviceToken), revokeHash: tokenHash(revokeHandle), generation: 1,
      preferenceEpoch,guestPreferences:emptyPreferences(), lastActivity: this.now(), events: new Set(), text: [], messages:[],results: new Map(), artifacts:new Map(),conditions:{hard:{},cleared:[]}, controller: null };
    this.contexts.set(id, context);
    return { id, generation: context.generation, deviceToken, revokeHandle, expiresAt: context.lastActivity + SESSION_TTL_MS };
  }
  private get(id: string, binding: SessionBinding): Context {
    const c = this.contexts.get(id);
    if (!c) throw new AssistantError('AI_SESSION_EXPIRED');
    if (this.now() >= c.lastActivity + SESSION_TTL_MS) {
      this.destroy(id);
      throw new AssistantError('AI_SESSION_EXPIRED');
    }
    if (c.subject !== binding.subject || !matches(binding.deviceToken, c.deviceHash)) throw new AssistantError('AI_SESSION_EXPIRED');
    if (c.generation !== binding.generation || c.preferenceEpoch !== binding.preferenceEpoch) throw new AssistantError('AI_SUPERSEDED');
    return c;
  }
  read(id: string, binding: SessionBinding) {
    const c = this.get(id, binding);
    return { text: [...c.text],messages:structuredClone(c.messages), expiresAt: c.lastActivity + SESSION_TTL_MS };
  }
  activity(id: string, binding: SessionBinding, eventId: string, kind: 'SEND' | 'EDIT' | 'EXPLICIT_ACTION') {
    const c = this.get(id, binding);
    if (!['SEND', 'EDIT', 'EXPLICIT_ACTION'].includes(kind) || !/^[a-zA-Z0-9_-]{1,100}$/.test(eventId)) throw new AssistantError('AI_CONFLICT');
    if (!c.events.has(eventId)) {
      if (c.events.size >= 10_000) throw new AssistantError('AI_UNAVAILABLE');
      c.events.add(eventId);
      c.lastActivity = this.now();
    }
    return c.lastActivity + SESSION_TTL_MS;
  }
  append(id: string, binding: SessionBinding, text: string) {
    const c = this.get(id, binding);
    if (text.length > 2000) throw new AssistantError('AI_CONFLICT');
    c.text.push(text);
    // Conservative UTF-8 byte window, below the 16k token input ceiling. Token counting remains
    // the provider admission gate; never truncate the currently submitted user input.
    while ((Buffer.byteLength(c.text.join('\n'), 'utf8') > 16_000 || c.text.length>100) && c.text.length > 1) c.text.shift();
  }
  appendMessage(id:string,binding:SessionBinding,role:'user'|'assistant',text:string){
    this.append(id,binding,text);
    const c=this.get(id,binding);c.messages.push({role,text});
    while((Buffer.byteLength(JSON.stringify(c.messages),'utf8')>16_000||c.messages.length>100)&&c.messages.length>1)c.messages.shift();
  }
  begin(id: string, binding: SessionBinding): AbortSignal {
    const c = this.get(id, binding);
    if (c.controller) throw new AssistantError('AI_CONFLICT');
    c.controller = new AbortController();
    return c.controller.signal;
  }
  publish(id: string, binding: SessionBinding, requestId: string, result: unknown) {
    const c = this.get(id, binding);
    const serialized = JSON.stringify(result);
    if (Buffer.byteLength(serialized, 'utf8') > 32_000 || c.results.size >= 50) throw new AssistantError('AI_UNAVAILABLE');
    c.results.set(requestId, structuredClone(result));
    c.controller = null;
  }
  result(id: string, binding: SessionBinding, requestId: string) {
    const c = this.get(id, binding);
    if (!c.results.has(requestId)) throw new AssistantError('AI_RESULT_EXPIRED');
    return structuredClone(c.results.get(requestId));
  }
  guestPreferences(id:string,binding:SessionBinding){return structuredClone(this.get(id,binding).guestPreferences);}
  confirmGuestPreferences(id:string,binding:SessionBinding,fields:Preferences){
    if(!binding.subject.startsWith('guest:'))throw new AssistantError('AI_CONFLICT');
    this.get(id,binding).guestPreferences=structuredClone(fields);
  }
  conditions(id:string,binding:SessionBinding){return structuredClone(this.get(id,binding).conditions);}
  saveConditions(id:string,binding:SessionBinding,value:{hard:Record<string,unknown>;cleared:string[]}){this.get(id,binding).conditions=structuredClone(value);}
  saveArtifact(id:string,binding:SessionBinding,artifactId:string,value:unknown){
    const c=this.get(id,binding);
    if(c.artifacts.size>=100||Buffer.byteLength(JSON.stringify(value),'utf8')>32_000)throw new AssistantError('AI_UNAVAILABLE');
    c.artifacts.set(artifactId,structuredClone(value));
  }
  artifact(id:string,binding:SessionBinding,artifactId:string):unknown{
    const c=this.get(id,binding);if(!c.artifacts.has(artifactId))throw new AssistantError('AI_RESULT_EXPIRED');
    return structuredClone(c.artifacts.get(artifactId));
  }
  finish(id: string, binding: SessionBinding) { this.get(id, binding).controller = null; }
  revoke(subject: string, revokeHandle: string): boolean {
    for (const c of this.contexts.values()) if (c.subject === subject && matches(revokeHandle, c.revokeHash)) { this.destroy(c.id); return true; }
    return false;
  }
  invalidateSubject(subject: string) {
    for (const c of [...this.contexts.values()]) if (c.subject === subject) this.destroy(c.id);
  }
  destroy(id: string) {
    const c = this.contexts.get(id);
    if (c) { c.controller?.abort(); c.text.length = 0; c.messages.length=0; c.results.clear(); c.artifacts.clear(); c.conditions={hard:{},cleared:[]}; c.guestPreferences=emptyPreferences(); c.events.clear(); this.contexts.delete(id); }
  }
  sweep() { for (const c of [...this.contexts.values()]) if (this.now() >= c.lastActivity + SESSION_TTL_MS) this.destroy(c.id); }
  shutdown() { for (const id of [...this.contexts.keys()]) this.destroy(id); }
}
