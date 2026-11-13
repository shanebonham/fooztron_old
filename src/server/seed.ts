/**
 * Seeds the event store with simulated demo history.
 *
 *   npm run seed                            # wipe + regenerate
 *   FOOZTRON_ROSTER="A,B,C,D" npm run seed  # bring your own coworkers
 */
import { pathToFileURL } from 'node:url';
import { EventStore } from './eventStore.ts';
import { DEFAULT_ROSTER, generateHistory } from './simulate.ts';

export function seed(store: EventStore, roster = rosterFromEnv()) {
  store.append(generateHistory(roster));
}

export function rosterFromEnv(): string[] {
  const raw = process.env.FOOZTRON_ROSTER;
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ROSTER;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = new EventStore(process.env.FOOZTRON_DB ?? 'data/fooztron.db');
  if (store.count() > 0 && !process.argv.includes('--force')) {
    console.log('Database not empty; pass --force to wipe and reseed.');
  } else {
    store.reset();
    seed(store);
    console.log(`🌱 Seeded ${store.count()} events of glorious fictional foosball.`);
  }
  store.close();
}
