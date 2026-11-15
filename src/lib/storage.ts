import type { AppVersion } from "../types.ts";

const DB_NAME = "emdash_db";
const DB_VERSION = 1;
const CRYPTO_STORE = "crypto_keys";
const VERSIONS_STORE = "versions";
const CRYPTO_KEY_ID = "gemini_aes_key";

const LS_KEY_CIPHERTEXT = "emdash_gemini_key_enc";
const LS_MODEL_KEY = "emdash_gemini_model";
const NON_TEXT_MODEL_RE = /(?:tts|audio|image|live|robotics|computer-use)/i;
const DEPRECATED_MODEL_RE = /^gemini-(?:1\.|2\.0|pro\b)/i;

interface EncryptedPayload {
  iv: string;
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CRYPTO_STORE)) {
        db.createObjectStore(CRYPTO_STORE);
      }
      if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
        db.createObjectStore(VERSIONS_STORE, { keyPath: "version" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function getOrCreateAesKey(): Promise<CryptoKey> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto unavailable");
  }
  const db = await openDatabase();
  try {
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(CRYPTO_STORE, "readonly");
      const store = tx.objectStore(CRYPTO_STORE);
      const req = store.get(CRYPTO_KEY_ID);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) return existing;

    const generated = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CRYPTO_STORE, "readwrite");
      const store = tx.objectStore(CRYPTO_STORE);
      const req = store.put(generated, CRYPTO_KEY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return generated;
  } finally {
    db.close();
  }
}

export function hasSavedEncryptedApiKey(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY_CIPHERTEXT);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<EncryptedPayload>;
    return Boolean(parsed.iv && parsed.ciphertext);
  } catch {
    return false;
  }
}

export async function saveEncryptedApiKey(apiKey: string): Promise<boolean> {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  try {
    const cryptoKey = await getOrCreateAesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(trimmed);
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encoded
    );
    const payload: EncryptedPayload = {
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(cipherBuf)),
    };
    localStorage.setItem(LS_KEY_CIPHERTEXT, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export async function loadEncryptedApiKey(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(LS_KEY_CIPHERTEXT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EncryptedPayload>;
    if (!parsed.iv || !parsed.ciphertext) return null;

    const db = await openDatabase();
    let cryptoKey: CryptoKey | undefined;
    try {
      cryptoKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
        const tx = db.transaction(CRYPTO_STORE, "readonly");
        const req = tx.objectStore(CRYPTO_STORE).get(CRYPTO_KEY_ID);
        req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }

    if (!cryptoKey || typeof crypto === "undefined" || !crypto.subtle) {
      return null;
    }

    const ivBytes = fromBase64(parsed.iv);
    const cipherBytes = fromBase64(parsed.ciphertext);
    const plainBuf = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes.buffer.slice(
          ivBytes.byteOffset,
          ivBytes.byteOffset + ivBytes.byteLength
        ) as ArrayBuffer,
      },
      cryptoKey,
      cipherBytes.buffer.slice(
        cipherBytes.byteOffset,
        cipherBytes.byteOffset + cipherBytes.byteLength
      ) as ArrayBuffer
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}

export async function removeEncryptedApiKey(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEY_CIPHERTEXT);
  } catch {
    // ignore storage errors
  }
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CRYPTO_STORE, "readwrite");
        const req = tx.objectStore(CRYPTO_STORE).delete(CRYPTO_KEY_ID);
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
