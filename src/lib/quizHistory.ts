export interface QuizHistoryEntry {
  id: string;
  completedAt: string; // ISO date
  sourceFiles: string[];
  questionCount: number;
  difficulty: string;
  questionTypes: string[];
  score: number;
  totalQuestions: number;
  percentage: number;
}

const STORAGE_KEY = 'studywiz_quiz_history';

export function getQuizHistory(): QuizHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveQuizResult(entry: Omit<QuizHistoryEntry, 'id' | 'completedAt'>): QuizHistoryEntry {
  const history = getQuizHistory();
  const newEntry: QuizHistoryEntry = {
    ...entry,
    id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date().toISOString(),
  };
  history.unshift(newEntry); // newest first
  // Keep at most 50 entries
  if (history.length > 50) history.length = 50;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return newEntry;
}

export function clearQuizHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function deleteQuizEntry(id: string): void {
  const history = getQuizHistory().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

// ── Firestore-synced wrappers ──

import { saveQuizToFirestore, getQuizHistoryFromFirestore } from './firestoreService';

export async function saveQuizResultWithSync(
  entry: Omit<QuizHistoryEntry, 'id' | 'completedAt'>,
  uid: string | null
): Promise<QuizHistoryEntry> {
  const saved = saveQuizResult(entry);
  if (uid) {
    try {
      await saveQuizToFirestore(uid, saved);
    } catch (err) {
      console.error('Failed to sync quiz to Firestore:', err);
    }
  }
  return saved;
}

export async function getQuizHistoryWithSync(uid: string | null): Promise<QuizHistoryEntry[]> {
  if (uid) {
    try {
      return await getQuizHistoryFromFirestore(uid);
    } catch (err) {
      console.error('Failed to fetch from Firestore, using local:', err);
    }
  }
  return getQuizHistory();
}
