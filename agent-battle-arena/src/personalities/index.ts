import type { Personality, Strategy } from '../types.ts';
import { memeHunter } from './memeHunter.ts';
import { conservativeDca } from './conservativeDca.ts';
import { degenSniper } from './degenSniper.ts';
import { whaleFollower } from './whaleFollower.ts';
import { aiNarrativeTrader } from './aiNarrativeTrader.ts';

export const STRATEGIES: Record<Personality, Strategy> = {
  'meme-hunter': memeHunter,
  'conservative-dca': conservativeDca,
  'degen-sniper': degenSniper,
  'whale-follower': whaleFollower,
  'ai-narrative-trader': aiNarrativeTrader,
};

export function getStrategy(p: Personality): Strategy {
  return STRATEGIES[p];
}
