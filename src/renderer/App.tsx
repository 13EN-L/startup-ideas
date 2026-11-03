// Issue #20: loads persisted state, restores the launch route, routes between
// pages and saves after every change.
import { notImplemented } from '../shared/notImplemented';
import type { FocusGardenBridge } from '../shared/bridge';

export interface AppProps {
  bridge: FocusGardenBridge;
  /** Injectable for tests; default Date.now / Math.random / crypto.randomUUID. */
  clock?: () => number;
  random?: () => number;
  createId?: () => string;
}

export function App({ bridge }: AppProps) {
  return notImplemented(`App(${typeof bridge})`);
}
