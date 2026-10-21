import { createContext, useContext } from 'react';
import { browserPollerDeps, type PollerDeps } from './poller.ts';

/** Timers/visibility for LivePoller; tests provide deterministic deps. */
export const PollerDepsContext = createContext<() => PollerDeps>(browserPollerDeps);
export const usePollerDeps = () => useContext(PollerDepsContext);
