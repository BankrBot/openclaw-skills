import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArenaState } from '../types.ts';
import { generateSeason, type Season } from '../market/market.ts';

// Default the arena dir to the project root (src/store/ → ../../) so the same
// arena is found regardless of the working directory the CLI is run from.
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = process.env.ARENA_DIR ?? join(PROJECT_ROOT, '.arena');
const STATE_PATH = join(DIR, 'state.json');

export function statePath(): string {
  return STATE_PATH;
}

export function hasState(): boolean {
  return existsSync(STATE_PATH);
}

export function saveState(state: ArenaState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function loadState(): ArenaState {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`No arena found. Run "arena new" or "arena seed-demo" first. (looked in ${STATE_PATH})`);
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as ArenaState;
}

// The market is fully determined by (seed, seasonTicks), so we regenerate it on
// demand rather than persisting every snapshot.
export function seasonFor(state: ArenaState): Season {
  return generateSeason(state.seed, state.seasonTicks);
}
