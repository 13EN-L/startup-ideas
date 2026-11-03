// Issue #17: thin client for the local ActivityWatch REST API (aw-server, /api/0).
import { ACTIVITYWATCH_URL } from '../../shared/constants';

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
    try {
      await this.request('/api/0/info');
      return true;
    } catch {
      return false;
    }
  }

  /** GET /api/0/buckets/ */
  async getBuckets(): Promise<AWBucket[]> {
    const buckets = await this.request<Record<string, AWBucket>>('/api/0/buckets/');
    return Object.values(buckets);
  }

  /** GET /api/0/buckets/{id}/events?start=&end=&limit=-1 */
  async getEvents<TData>(bucketId: string, range: TimeRange): Promise<AWEvent<TData>[]> {
    const query = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      limit: '-1',
    });
    return this.request(`/api/0/buckets/${encodeURIComponent(bucketId)}/events?${query}`);
  }

  private async request<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`);
    } catch (error) {
      throw new ActivityWatchError(
        `ActivityWatch is not running at ${this.baseUrl} (${(error as Error).message}).`,
      );
    }
    if (!response.ok) {
      throw new ActivityWatchError(
        `ActivityWatch request ${path} failed with HTTP ${response.status}.`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }
}
