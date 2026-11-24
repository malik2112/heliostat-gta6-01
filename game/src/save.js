// HELIOSTAT — save / load. One small JSON blob in localStorage: cash,
// mission progress, best wanted level, kills, and play time. Nothing
// sensitive, nothing that needs a server.

import { CFG } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      v: 1,
      money: Math.round(game.player.money),
      missionIndex: game.missions.nextIndex,
      completed: game.missions.state.completed,
      bestStars: game.stats.bestStars,
      kills: game.stats.kills,
      playSeconds: Math.round(game.stats.playSeconds),
      savedAt: Date.now(),
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch (_e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (_e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CFG.saveKey);
  } catch (_e) {
    // Storage unavailable — the game simply starts fresh.
  }
}
