import { AI_KEYWORDS, STORAGE_KEY } from "./ecomonData";

export function buildAiKeywordMaps() {
  const wordMap = new Map();
  const phraseList = [];

  AI_KEYWORDS.forEach((hint) => {
    hint.keywords.forEach((keyword) => {
      const normalized = keyword.toLowerCase();
      if (normalized.includes(" ")) {
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
        phraseList.push({ id: hint.id, regex: new RegExp(`\\b${escaped}\\b`) });
        return;
      }
      if (!wordMap.has(normalized)) {
        wordMap.set(normalized, new Set());
      }
      wordMap.get(normalized).add(hint.id);
    });
  });

  return { wordMap, phraseList };
}

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function createDefaultState() {
  return { lastDate: getToday(), todayScans: 0, todayCollected: [], unlocked: {} };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();

  try {
    const parsed = JSON.parse(raw);
    return {
      lastDate: parsed.lastDate || getToday(),
      todayScans: Number(parsed.todayScans) || 0,
      todayCollected: Array.isArray(parsed.todayCollected) ? parsed.todayCollected : [],
      unlocked: parsed.unlocked && typeof parsed.unlocked === "object" ? parsed.unlocked : {}
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
