/**
 * Append-only event store backed by node:sqlite (no native dependencies).
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DomainEvent, NewEvent } from '../shared/types.ts';

export class EventStore {
  private db: DatabaseSync;
  private insert;
  private listeners = new Set<(events: DomainEvent[]) => void>();

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS events (
        seq     INTEGER PRIMARY KEY AUTOINCREMENT,
        at      TEXT    NOT NULL,
        type    TEXT    NOT NULL,
        payload TEXT    NOT NULL
      );
    `);
    this.insert = this.db.prepare('INSERT INTO events (at, type, payload) VALUES (?, ?, ?) RETURNING seq');
  }

  all(): DomainEvent[] {
    const rows = this.db.prepare('SELECT seq, at, type, payload FROM events ORDER BY seq').all() as {
      seq: number;
      at: string;
      type: string;
      payload: string;
    }[];
    return rows.map((r) => ({ ...JSON.parse(r.payload), seq: r.seq, at: r.at, type: r.type }) as DomainEvent);
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number }).n;
  }

  /** Appends atomically. `at` may be supplied (for seeding history), otherwise now. */
  append(events: (NewEvent & { at?: string })[]): DomainEvent[] {
    const out: DomainEvent[] = [];
    this.db.exec('BEGIN');
    try {
      for (const { at = new Date().toISOString(), ...rest } of events) {
        const { type, ...payload } = rest;
        const { seq } = this.insert.get(at, type, JSON.stringify(payload)) as { seq: number };
        out.push({ ...rest, seq, at } as DomainEvent);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    for (const l of this.listeners) l(out);
    return out;
  }

  subscribe(fn: (events: DomainEvent[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    this.db.exec("DELETE FROM events; DELETE FROM sqlite_sequence WHERE name = 'events';");
  }

  close(): void {
    this.db.close();
  }
}
