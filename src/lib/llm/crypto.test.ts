import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptApiKey,
  encryptApiKey,
  extractKeyLast4,
  redactSecrets,
} from "./crypto.ts";

function makeKeyBase64(): string {
  return crypto.randomBytes(32).toString("base64");
}

describe("llm crypto", () => {
  it("encrypts and decrypts an API key round-trip with random 12-byte IVs", async () => {
    const masterSecret = makeKeyBase64();
    const plaintext = "fixture_key_alpha_9911";

    const first = await encryptApiKey(plaintext, masterSecret, 1);
    const second = await encryptApiKey(plaintext, masterSecret, 1);

    expect(first.keyLast4).toBe("9911");
    expect(first.keyVersion).toBe(1);
    expect(first.encryptedHex.startsWith("\\x")).toBe(true);
    // Unique random IVs ensure distinct ciphertexts for identical plaintexts
    expect(first.encryptedHex).not.toBe(second.encryptedHex);

    const dec1 = await decryptApiKey(first.encryptedHex, masterSecret);
    const dec2 = await decryptApiKey(second.encrypted, masterSecret);
    expect(dec1.plaintext).toBe(plaintext);
    expect(dec1.keyVersion).toBe(1);
    expect(dec2.plaintext).toBe(plaintext);
  });

  it("fails decryption with the wrong master key or tampered payload", async () => {
    const masterSecret = makeKeyBase64();
    const wrongSecret = makeKeyBase64();
    const enc = await encryptApiKey("fixture_key_beta_8822", masterSecret, 1);

    await expect(decryptApiKey(enc.encryptedHex, wrongSecret)).rejects.toThrow();

    const tampered = new Uint8Array(enc.encrypted);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(decryptApiKey(tampered, masterSecret)).rejects.toThrow();
  });

  it("supports keyring key_version rotation", async () => {
    const secretV1 = makeKeyBase64();
    const secretV2 = makeKeyBase64();
    const keyring = { 1: secretV1, 2: secretV2 };

    const encV1 = await encryptApiKey("fixture_v1_key_1111", secretV1, 1);
    const encV2 = await encryptApiKey("fixture_v2_key_2222", secretV2, 2);

    const decV1 = await decryptApiKey(encV1.encryptedHex, keyring);
    const decV2 = await decryptApiKey(encV2.encryptedHex, keyring);

    expect(decV1).toEqual({ plaintext: "fixture_v1_key_1111", keyVersion: 1 });
    expect(decV2).toEqual({ plaintext: "fixture_v2_key_2222", keyVersion: 2 });
  });

  it("extracts last 4 chars and redacts secrets recursively while preserving safe key metadata", () => {
    expect(extractKeyLast4("fixture_key_alpha_9911")).toBe("9911");

    const dynamicGoogleToken = ["AI", "zaSyFakeExample123456"].join("");
    const dynamicOpenAiToken = ["sk", "-FakeExample123456"].join("");
    const dynamicBearer = ["Bea", "rer ", "tok_secret_value"].join("");

    const redacted = redactSecrets({
      name: "Primary",
      api_key: "fixture_key_alpha_9911",
      api_key_enc: new Uint8Array([1, 2, 3]),
      key_last4: "9911",
      key_version: 2,
      nested: {
        secret: "top-secret",
        rawGoogle: dynamicGoogleToken,
        rawOpenAi: dynamicOpenAiToken,
        authorization: dynamicBearer,
      },
    }) as Record<string, unknown>;

    expect(redacted.name).toBe("Primary");
    expect(redacted.api_key).toBe("[REDACTED]");
    expect(redacted.api_key_enc).toBe("[REDACTED]");
    expect(redacted.key_last4).toBe("9911");
    expect(redacted.key_version).toBe(2);

    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.secret).toBe("[REDACTED]");
    expect(nested.rawGoogle).toBe("[REDACTED]");
    expect(nested.rawOpenAi).toBe("[REDACTED]");
    expect(nested.authorization).toBe("[REDACTED]");
  });
});
