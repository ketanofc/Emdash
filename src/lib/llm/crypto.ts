const ENVELOPE_MAGIC = 0x01;
const IV_LENGTH = 12;
const KEY_VERSION_BYTES = 4;
const HEADER_LENGTH = 1 + KEY_VERSION_BYTES + IV_LENGTH; // 17 bytes

export type Keyring = string | Record<number, string>;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.trim();
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function encodeByteaHex(bytes: Uint8Array): string {
  let hex = "\\x";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function decodeBytea(input: Uint8Array | string): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  const trimmed = input.trim();
  if (trimmed.startsWith("\\x") || trimmed.startsWith("0x")) {
    const hex = trimmed.slice(2);
    if (hex.length % 2 !== 0) {
      throw new Error("Invalid hex bytea payload.");
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  return base64ToBytes(trimmed);
}

export function extractKeyLast4(plaintextKey: string): string {
  const trimmed = plaintextKey.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }
  return trimmed.slice(-4);
}

async function importAesKey(masterKeyBase64: string): Promise<CryptoKey> {
  if (!masterKeyBase64 || typeof masterKeyBase64 !== "string") {
    throw new Error("Encryption secret is not configured.");
  }
  const keyBytes = base64ToBytes(masterKeyBase64);
  if (keyBytes.byteLength !== 32) {
    throw new Error(
      "KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes (256 bits)."
    );
  }
  const rawBuffer = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength
  ) as ArrayBuffer;

  return await globalThis.crypto.subtle.importKey(
    "raw",
    rawBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function resolveMasterKey(keyring: Keyring, keyVersion: number): string {
  if (typeof keyring === "string") {
    return keyring;
  }
  const key = keyring[keyVersion];
  if (!key) {
    throw new Error(`No encryption key registered for key_version ${keyVersion}.`);
  }
  return key;
}

export interface EncryptApiKeyResult {
  encrypted: Uint8Array;
  encryptedHex: string;
  keyLast4: string;
  keyVersion: number;
}

export async function encryptApiKey(
  plaintext: string,
  masterKeyBase64: string,
  keyVersion = 1
): Promise<EncryptApiKeyResult> {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty.");
  }
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error("key_version must be a positive integer.");
  }

  const cryptoKey = await importAesKey(masterKeyBase64);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encodedText = new TextEncoder().encode(trimmed);

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encodedText
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  const envelope = new Uint8Array(HEADER_LENGTH + cipherBytes.byteLength);
  envelope[0] = ENVELOPE_MAGIC;
  const view = new DataView(envelope.buffer);
  view.setUint32(1, keyVersion, false);
  envelope.set(iv, 1 + KEY_VERSION_BYTES);
  envelope.set(cipherBytes, HEADER_LENGTH);

  return {
    encrypted: envelope,
    encryptedHex: encodeByteaHex(envelope),
    keyLast4: extractKeyLast4(trimmed),
    keyVersion,
  };
}

export interface DecryptApiKeyResult {
  plaintext: string;
  keyVersion: number;
}

export async function decryptApiKey(
  encryptedPayload: Uint8Array | string,
  keyring: Keyring
): Promise<DecryptApiKeyResult> {
  const envelope = decodeBytea(encryptedPayload);
  if (envelope.byteLength <= HEADER_LENGTH) {
    throw new Error("Encrypted API key payload is corrupted or truncated.");
  }
  if (envelope[0] !== ENVELOPE_MAGIC) {
    throw new Error("Unsupported encrypted key envelope version.");
  }

  const view = new DataView(
    envelope.buffer,
    envelope.byteOffset,
    envelope.byteLength
  );
  const keyVersion = view.getUint32(1, false);
  const iv = envelope.subarray(
    1 + KEY_VERSION_BYTES,
    1 + KEY_VERSION_BYTES + IV_LENGTH
  );
  const cipherBytes = envelope.subarray(HEADER_LENGTH);

  const masterKey = resolveMasterKey(keyring, keyVersion);
  const cryptoKey = await importAesKey(masterKey);

  const ivCopy = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength
  ) as ArrayBuffer;
  const cipherCopy = cipherBytes.buffer.slice(
    cipherBytes.byteOffset,
    cipherBytes.byteOffset + cipherBytes.byteLength
  ) as ArrayBuffer;

  const plainBuffer = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivCopy },
    cryptoKey,
    cipherCopy
  );

  return {
    plaintext: new TextDecoder().decode(plainBuffer),
    keyVersion,
  };
}

const SENSITIVE_KEY_RE =
  /(?:api_?key|secret|password|token|authorization|bearer|api_key_enc)/i;

export function redactSecrets(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (/^(?:AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z_-]{10,}|Bearer\s+\S+)/i.test(value)) {
      return "[REDACTED]";
    }
    return value;
  }
  if (value instanceof Uint8Array) {
    return "[REDACTED_BYTEA]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k) && k !== "key_last4" && k !== "key_version") {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}
