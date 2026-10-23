import type { Static, TSchema } from '@sinclair/typebox';
import type { OperationById, OperationId } from '@fancy/contracts';

type Def<I extends OperationId> = OperationById<I>;
type StaticOf<S> = S extends TSchema ? Static<S> : never;

type ParamsPart<D> = D extends { params: infer P } ? { params: StaticOf<P> } : { params?: never };
type QueryPart<D> = D extends { query: infer Q } ? { query?: StaticOf<Q> } : { query?: never };
type BodyPart<D> = D extends { body: infer B } ? { body: StaticOf<B> } : { body?: never };
/** Idempotent writes must carry the intent key so retries reuse it (API contract §1). */
type KeyPart<D> = D extends { write: 'idempotencyKey' } ? { idempotencyKey: string } : D extends { write: 'resourceKey' } ? { idempotencyKey?: string } : { idempotencyKey?: never };
type IfMatchPart<D> = D extends { ifMatch: true } ? { ifMatch: string } : { ifMatch?: never };

type RequestFor<D> = D extends unknown ? ParamsPart<D> & QueryPart<D> & BodyPart<D> & KeyPart<D> & IfMatchPart<D> : never;
/** Distribute once per operation, keeping its fields correlated instead of cross-multiplying unions. */
type RequestMap = { [I in OperationId]: RequestFor<Def<I>> };
export type RequestOf<I extends OperationId> = RequestMap[I];

export interface ResponseMeta {
  requestId: string;
  serverNow: string;
  version?: string;
  snapshotId?: string;
}
export interface Page {
  nextCursor: string | null;
  hasMore: boolean;
  scannedThroughSeq?: string;
}

type SuccessOf<D> = D extends { success: infer S } ? S : never;
export type ResponseOf<I extends OperationId> =
  SuccessOf<Def<I>> extends { status: 204 } ? undefined
  : SuccessOf<Def<I>> extends { data: infer T; list: true } ? { data: StaticOf<T>[]; page: Page; meta: ResponseMeta }
  : SuccessOf<Def<I>> extends { data: infer T } ? { data: StaticOf<T>; meta: ResponseMeta }
  : string;
