import { authOperations } from './operations/auth.ts';
import { peopleOperations } from './operations/people.ts';
import { mealOperations } from './operations/meals.ts';
import { socialOperations } from './operations/social.ts';
import { operationsAdmin } from './operations/operations-admin.ts';
import { assistantOperations } from './operations/assistant.ts';
import { receiptOperations } from './operations/receipts.ts';
import type { OperationDef } from './operation.ts';

export const API_PREFIX = '/v1';
export const CONTRACT_VERSION = '1.0.0';

export const operations = [...authOperations, ...peopleOperations, ...mealOperations, ...socialOperations, ...operationsAdmin, ...assistantOperations, ...receiptOperations] as const;
export type AnyOperation = (typeof operations)[number];
export type OperationId = AnyOperation['operationId'];
export type OperationMap = { [O in AnyOperation as O['operationId']]: O };
export type OperationById<I extends OperationId> = OperationMap[I];

export const operationsById: Readonly<Record<OperationId, OperationDef>> = Object.fromEntries(
  operations.map((o) => [o.operationId, o]),
) as unknown as Record<OperationId, OperationDef>;

/** Operations whose original-intent outcome getCommandReceipt may report (P1.1 P03). */
export const receiptOperationIds: ReadonlySet<string> = new Set(
  (operations as readonly OperationDef[]).filter((o) => o.receipt === true).map((o) => o.operationId),
);
