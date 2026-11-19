import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AdminCredentials {
  adminEmail: string;
  adminPassword: string;
  keyEncryptionSecret: string;
  createdNewEnv: boolean;
  generatedPassword: boolean;
}

/**
 * Ensures a valid .env file exists with KEY_ENCRYPTION_SECRET and ADMIN credentials.
 * If .env or any required credential is missing, it creates/updates .env and loads
 * the values into process.env so that authentication works out of the box.
 */
export function ensureAdminEnvironmentAndCredentials(
  rootDir = path.resolve(__dirname, "../..")
): AdminCredentials {
  const envPath = path.join(rootDir, ".env");
  const envExamplePath = path.join(rootDir, ".env.example");

  let envContent = "";
  let createdNewEnv = false;

  if (fs.existsSync(envPath)) {
    try {
      envContent = fs.readFileSync(envPath, "utf8");
    } catch {
      envContent = "";
    }
  } else {
    createdNewEnv = true;
    if (fs.existsSync(envExamplePath)) {
      try {
        envContent = fs.readFileSync(envExamplePath, "utf8");
      } catch {
        envContent = "";
      }
    }
  }

  // Parse existing environment keys from .env content
  const envVars = new Map<string, string>();
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars.set(key, val);
    }
  }

  // 1. KEY_ENCRYPTION_SECRET
  let keySecret = process.env.KEY_ENCRYPTION_SECRET?.trim() || envVars.get("KEY_ENCRYPTION_SECRET") || "";
  if (!keySecret) {
    keySecret = crypto.randomBytes(32).toString("base64");
    process.env.KEY_ENCRYPTION_SECRET = keySecret;
  } else {
    process.env.KEY_ENCRYPTION_SECRET = keySecret;
  }

  // 2. ADMIN_EMAIL
  let adminEmail =
    process.env.ADMIN_EMAIL?.trim() ||
    envVars.get("ADMIN_EMAIL") ||
    "admin@emdash.build";
  process.env.ADMIN_EMAIL = adminEmail;

  // 3. ADMIN_PASSWORD
  let generatedPassword = false;
  let adminPassword =
    process.env.ADMIN_PASSWORD?.trim() ||
    envVars.get("ADMIN_PASSWORD") ||
    "";

  if (!adminPassword) {
    // Generate an authentic, secure default admin password
    const suffix = crypto.randomBytes(4).toString("hex");
    adminPassword = `Emdash@Admin_${suffix}!`;
    generatedPassword = true;
    process.env.ADMIN_PASSWORD = adminPassword;
  } else {
    process.env.ADMIN_PASSWORD = adminPassword;
  }

  // APP_URL / SITE_ORIGIN defaults
  if (!process.env.APP_URL && !envVars.has("APP_URL")) {
    process.env.APP_URL = "http://localhost:3000";
  }
  if (!process.env.SITE_ORIGIN && !envVars.has("SITE_ORIGIN")) {
    process.env.SITE_ORIGIN = "http://localhost:3000";
  }

  // Re-write or update .env file cleanly
  const linesToEnsure: Array<{ key: string; value: string; comment?: string }> = [
    {
      key: "KEY_ENCRYPTION_SECRET",
      value: `"${keySecret}"`,
      comment: "# AES-256-GCM encryption secret for provider API keys",
    },
    {
      key: "ADMIN_EMAIL",
      value: `"${adminEmail}"`,
      comment: "# Administrator account credentials for Emdash Control Plane (/admin)",
    },
    {
      key: "ADMIN_PASSWORD",
      value: `"${adminPassword}"`,
    },
    {
      key: "APP_URL",
      value: `"${process.env.APP_URL || "http://localhost:3000"}"`,
      comment: "# Allowed origin for CORS & links",
    },
    {
      key: "SITE_ORIGIN",
      value: `"${process.env.SITE_ORIGIN || "http://localhost:3000"}"`,
    },
  ];

  let updatedContent = envContent;

  for (const item of linesToEnsure) {
    const keyRegex = new RegExp(`^\\s*${item.key}\\s*=.*$`, "m");
    if (keyRegex.test(updatedContent)) {
      // If the key is empty in .env, update it with the value
      const match = updatedContent.match(keyRegex);
      if (match) {
        const valPart = match[0].slice(match[0].indexOf("=") + 1).trim();
        if (!valPart || valPart === '""' || valPart === "''") {
          updatedContent = updatedContent.replace(keyRegex, `${item.key}=${item.value}`);
        }
      }
    } else {
      // Append key with comment if needed
      const prefix = item.comment ? `\n${item.comment}\n` : "";
      updatedContent = `${updatedContent.trimEnd()}\n${prefix}${item.key}=${item.value}\n`;
    }
  }

  try {
    fs.writeFileSync(envPath, updatedContent.trim() + "\n", "utf8");
  } catch (err) {
    console.warn("[emdash] Notice: Could not write .env file directly (read-only filesystem):", err);
  }

  return {
    adminEmail,
    adminPassword,
    keyEncryptionSecret: keySecret,
    createdNewEnv,
    generatedPassword,
  };
}
