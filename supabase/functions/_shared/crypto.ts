// AES-256-GCM envelope encryption for provider API keys inside Supabase Edge Functions
// Wire format: [1 byte magic 0x01][4 bytes uint32 BE key_version][12 bytes random IV][ciphertext + tag]

const ENVELOPE_MAGIC = 0x01;
const IV_LENGTH = 12;
const KEY_VERSION_BYTES = 4;
const HEADER_LENGTH = 1 + KEY_VERSION_BYTES + IV_LENGTH;

export type Keyring = string | Record<number, string>;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.trim());
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
  if (input instanceof Uint8Array) return input;
  const trimmed = input.trim();
  if (trimmed.startsWith("\\x") || trimmed.startsWith("0x")) {
    const hex = trimmed.slice(2);
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
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}

export function getMasterKeyringFromEnv(): Keyring {
  const current = Deno.env.get("KEY_ENCRYPTION_SECRET")?.trim() || "";
  const prevRaw = Deno.env.get("KEY_ENCRYPTION_KEYRING")?.trim();
  if (prevRaw) {
    try {
      const parsed = JSON.parse(prevRaw) as Record<string, string>;
      const ring: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const num = Number(k);
        if (Number.isInteger(num) && typeof v === "string") ring[num] = v;
      }
      if (current && !Object.values(ring).includes(current)) {
        const nextVer = Math.max(1, ...Object.keys(ring).map(Number)) + 1;
        ring[nextVer] = current;
      }
      return ring;
    } catch {
      // fall through
    }
  }
  if (!current) {
    throw new Error("KEY_ENCRYPTION_SECRET is not set.");
  }
  return current;
}

async function importAesKey(masterKeyBase64: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(masterKeyBase64);
  if (keyBytes.byteLength !== 32) {
    throw new Error("KEY_ENCRYPTION_SECRET must decode to 32 bytes.");
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptApiKey(
  plaintext: string,
  masterKeyBase64: string,
  keyVersion = 1
): Promise<{ encryptedHex: string; keyLast4: string; keyVersion: number }> {
  const trimmed = plaintext.trim();
  if (!trimmed) throw new Error("API key cannot be empty.");

  const cryptoKey = await importAesKey(masterKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encodedText = new TextEncoder().encode(trimmed);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encodedText
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  const envelope = new Uint8Array(HEADER_LENGTH + cipherBytes.byteLength);
  envelope[0] = ENVELOPE_MAGIC;
  new DataView(envelope.buffer).setUint32(1, keyVersion, false);
  envelope.set(iv, 1 + KEY_VERSION_BYTES);
  envelope.set(cipherBytes, HEADER_LENGTH);

  return {
    encryptedHex: encodeByteaHex(envelope),
    keyLast4: extractKeyLast4(trimmed),
    keyVersion,
  };
}

export async function decryptApiKey(
  encryptedPayload: Uint8Array | string,
  keyring: Keyring
): Promise<{ plaintext: string; keyVersion: number }> {
  const envelope = decodeBytea(encryptedPayload);
  if (envelope.byteLength <= HEADER_LENGTH || envelope[0] !== ENVELOPE_MAGIC) {
    throw new Error("Invalid encrypted API key payload.");
  }
  const keyVersion = new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength).getUint32(1, false);
  const iv = envelope.subarray(1 + KEY_VERSION_BYTES, HEADER_LENGTH);
  const cipherBytes = envelope.subarray(HEADER_LENGTH);

  const masterKey =
    typeof keyring === "string" ? keyring : keyring[keyVersion];
  if (!masterKey) {
    throw new Error(`No key configured for key_version ${keyVersion}.`);
  }

  const cryptoKey = await importAesKey(masterKey);
  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer,
    },
    cryptoKey,
    cipherBytes.buffer.slice(cipherBytes.byteOffset, cipherBytes.byteOffset + cipherBytes.byteLength) as ArrayBuffer
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
  if (value instanceof Uint8Array) return "[REDACTED_BYTEA]";
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
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
