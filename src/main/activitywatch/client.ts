// Issue #17: thin client for the local ActivityWatch REST API (aw-server, /api/0).
import { ACTIVITYWATCH_URL } from '../../shared/constants';
import { notImplemented } from '../../shared/notImplemented';

export type BucketType = 'currentwindow' | 'web.tab.current' | 'afkstatus' | (string & {});

export interface AWBucket {
  id: string;
  type: BucketType;
  client: string;
  hostname: string;
}

export interface AWEvent<TData = Record<string, unknown>> {
  id?: number;
  /** ISO 8601 */
  timestamp: string;
  /** Seconds */
  duration: number;
  data: TData;
}

export interface WindowData {
  app: string;
  title: string;
}

export interface WebData {
  url: string;
  title: string;
  audible?: boolean;
  incognito?: boolean;
}

export interface AfkData {
  status: 'afk' | 'not-afk';
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export class ActivityWatchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ActivityWatchError';
  }
}

export interface ActivityWatchClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class ActivityWatchClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl = ACTIVITYWATCH_URL, fetch: fetchImpl = fetch }: ActivityWatchClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  /** True when aw-server answers; never throws. */
  async isAvailable(): Promise<boolean> {
    return notImplemented(`isAvailable(${this.baseUrl})`);
  }

  /** GET /api/0/buckets/ */
  async getBuckets(): Promise<AWBucket[]> {
    return notImplemented(`getBuckets(${typeof this.fetchImpl})`);
  }

  /** GET /api/0/buckets/{id}/events?start=&end=&limit=-1 */
  async getEvents<TData>(bucketId: string, range: TimeRange): Promise<AWEvent<TData>[]> {
    return notImplemented(`getEvents(${bucketId}, ${range.start.toISOString()})`);
  }
}
