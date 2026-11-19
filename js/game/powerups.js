import { weightedIndex } from './util.js';

// Every power-up pill. `color` is a name from the palette in themes.js. `weight` sets how often it
// drops relative to the others;
// bad ones are scaled up by each level's `bad` factor.
export const POWERUPS = {
  tiff:    { label: 'TIFF',    name: 'Uncompressed master',            desc: 'Bigger paddle',               good: true,  weight: 10,  dur: 20, color: 'cyan' },
  lockss:  { label: 'LOCKSS',  name: 'Lots Of Copies Keep Stuff Safe', desc: '+2 balls',                    good: true,  weight: 8,            color: 'green' },
  cold:    { label: 'COLD',    name: 'Cold storage',                   desc: 'Ball slows down',             good: true,  weight: 8,   dur: 12, color: 'ice' },
  ingest:  { label: 'INGEST',  name: 'Ingest',                         desc: 'Catch the ball - SPACE to launch', good: true, weight: 7, dur: 15, color: 'yellow' },
  scan:    { label: 'SCAN',    name: 'Digitization',                   desc: 'Lasers - SPACE to fire',          good: true, weight: 7, dur: 10, color: 'orange' },
  crawl:   { label: 'CRAWL',   name: 'Web crawler',                    desc: 'Ball plows through bricks',   good: true,  weight: 5,   dur: 8,  color: 'pink' },
  backup:  { label: 'BACKUP',  name: 'Backup copy',                    desc: 'Saves your next miss',        good: true,  weight: 6,            color: 'blue' },
  restore: { label: 'RESTORE', name: 'Restore from backup',            desc: 'Extra life',                  good: true,  weight: 2,            color: 'white' },
  migrate: { label: 'MIGRATE', name: 'Format migration',               desc: 'Skip to the next level',      good: true,  weight: 1.2, minLevel: 4, maxLevel: 11, color: 'lilac' },
  rot:     { label: 'ROT',     name: 'Bit rot',                        desc: 'Paddle shrinks',              good: false, weight: 6,   dur: 12, color: 'danger' },
  deluge:  { label: 'DELUGE',  name: 'Data deluge',                    desc: 'Ball speeds up',              good: false, weight: 6,   dur: 10, color: 'danger' },
  linkrot: { label: '404',     name: 'Link rot',                       desc: 'Ball goes missing',           good: false, weight: 4,   dur: 3,  minLevel: 9, color: 'danger' },
};

export const POWERUP_KEYS = Object.keys(POWERUPS);

// Pick a power-up for a level (1-based level number and its definition).
export function pickPowerup(levelNumber, levelDef, rnd) {
  const weights = POWERUP_KEYS.map((k) => {
    const p = POWERUPS[k];
    if (p.minLevel && levelNumber < p.minLevel) return 0;
    if (p.maxLevel && levelNumber > p.maxLevel) return 0;
    return p.good ? p.weight : p.weight * levelDef.bad;
  });
  return POWERUP_KEYS[weightedIndex(weights, rnd)];
}
