import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { QuizHistoryEntry } from './quizHistory';

// ── Quiz History ──

export async function saveQuizToFirestore(uid: string, entry: QuizHistoryEntry): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'quizHistory', entry.id), {
    ...entry,
    savedAt: serverTimestamp(),
  });
}

export async function getQuizHistoryFromFirestore(uid: string): Promise<QuizHistoryEntry[]> {
  const q = query(
    collection(db, 'users', uid, 'quizHistory'),
    orderBy('completedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as QuizHistoryEntry);
}

export async function deleteQuizFromFirestore(uid: string, quizId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'quizHistory', quizId));
}

export async function clearQuizHistoryFromFirestore(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, 'quizHistory'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ── Migration from localStorage ──

const MIGRATION_KEY = 'studywiz_migrated_to_firestore';

export async function migrateLocalQuizHistory(uid: string): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    const raw = localStorage.getItem('studywiz_quiz_history');
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    const entries: QuizHistoryEntry[] = JSON.parse(raw);
    if (entries.length === 0) {
      localStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    const batch = writeBatch(db);
    entries.forEach(entry => {
      const ref = doc(db, 'users', uid, 'quizHistory', entry.id);
      batch.set(ref, { ...entry, savedAt: serverTimestamp() });
    });
    await batch.commit();
    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch (err) {
    console.error('Quiz history migration failed:', err);
  }
}

// ── Chat Sessions ──

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: any;
  updatedAt: any;
}

export async function saveChatSession(
  uid: string,
  sessionId: string,
  messages: ChatMessage[]
): Promise<void> {
  const ref = doc(db, 'users', uid, 'chatSessions', sessionId);
  const existing = await getDoc(ref);

  await setDoc(ref, {
    id: sessionId,
    messages,
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getChatSessions(uid: string): Promise<ChatSession[]> {
  const q = query(
    collection(db, 'users', uid, 'chatSessions'),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ChatSession);
}

export async function deleteChatSession(uid: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'chatSessions', sessionId));
}

// ── File Metadata ──

export interface FileMetadataEntry {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export async function saveFileMetadata(uid: string, files: FileMetadataEntry[]): Promise<void> {
  const batch = writeBatch(db);
  files.forEach(file => {
    const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ref = doc(db, 'users', uid, 'fileMetadata', id);
    batch.set(ref, { ...file, savedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function getFileMetadata(uid: string): Promise<FileMetadataEntry[]> {
  const q = query(
    collection(db, 'users', uid, 'fileMetadata'),
    orderBy('uploadedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FileMetadataEntry);
}
