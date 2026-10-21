// Values provided by global-setup.ts to every db test via inject().
declare module 'vitest' {
  export interface ProvidedContext {
    pgServerUrl: string;
    pgVersionNum: number;
  }
}
export {};
