import type { AppVersion } from "../types.ts";

const DB_NAME = "emdash_db";
const DB_VERSION = 1;
const VERSIONS_STORE = "versions";

const LS_MODEL_KEY = "emdash_gemini_model";
const NON_TEXT_MODEL_RE = /(?:tts|audio|image|live|robotics|computer-use)/i;
const DEPRECATED_MODEL_RE = /^gemini-(?:1\.|2\.0|pro\b)/i;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
        db.createObjectStore(VERSIONS_STORE, { keyPath: "version" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

export function saveSelectedModel(modelId: string): void {
  try {
    const clean = modelId.trim();
    if (clean) {
      localStorage.setItem(LS_MODEL_KEY, clean);
    }
  } catch {
    // ignore storage errors
  }
}

export function loadSelectedModel(fallbackModel: string): string {
  try {
    const saved = localStorage.getItem(LS_MODEL_KEY)?.trim();
    if (
      saved &&
      !NON_TEXT_MODEL_RE.test(saved) &&
      !DEPRECATED_MODEL_RE.test(saved)
    ) {
      return saved;
    }
    return fallbackModel;
  } catch {
    return fallbackModel;
  }
}

export async function saveVersionToDb(version: AppVersion): Promise<void> {
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, "readwrite");
        const req = tx.objectStore(VERSIONS_STORE).put(version);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // ignore IndexedDB errors
  }
}

export async function loadVersionsFromDb(): Promise<AppVersion[]> {
  try {
    const db = await openDatabase();
    try {
      const items = await new Promise<AppVersion[]>((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, "readonly");
        const req = tx.objectStore(VERSIONS_STORE).getAll();
        req.onsuccess = () => resolve((req.result as AppVersion[]) || []);
        req.onerror = () => reject(req.error);
      });
      return items.sort((a, b) => a.version - b.version);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function clearVersionsFromDb(): Promise<void> {
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(VERSIONS_STORE, "readwrite");
        const req = tx.objectStore(VERSIONS_STORE).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // ignore IndexedDB errors
  }
}
