import { STORAGE_KEY } from './config.js';

// Settings and scores live in this browser only. Every access is wrapped because
// private windows and some privacy settings make localStorage throw.
export function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function save(patch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), ...patch }));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
