import type { AttachedFile } from "@/src/types";

export const MAX_ATTACHMENTS = 4;
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB per file

const GEMINI_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const GEMINI_INLINE_PREFIXES = ["audio/", "video/"];
const GEMINI_INLINE_EXACT = new Set(["application/pdf"]);

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "mts",
  "cts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "sql",
  "sh",
  "bash",
  "zsh",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "env",
  "csv",
  "tsv",
  "xml",
  "svg",
  "graphql",
  "gql",
  "prisma",
  "dockerfile",
  "gitignore",
]);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function looksLikeTextFile(file: File): Promise<boolean> {
  const ext = getExtension(file.name);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/xml" ||
    file.type === "application/javascript" ||
    file.type === "application/typescript" ||
    file.type === "image/svg+xml"
  ) {
    return true;
  }
  if (file.size === 0) return true;
  // Inspect first 8 KB for null bytes or heavy non-printable control chars
  const slice = file.slice(0, 8192);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let controlCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 7 || (b > 13 && b < 32 && b !== 27)) {
      controlCount++;
    }
  }
  return controlCount / bytes.length < 0.05;
}

async function rasterizeImageToPng(dataUrl: string): Promise<{
  mimeType: string;
  base64Data: string;
  previewUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const pngDataUrl = canvas.toDataURL("image/png");
      const base64Data = pngDataUrl.split(",")[1] || "";
      resolve({ mimeType: "image/png", base64Data, previewUrl: pngDataUrl });
    };
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });
}

function makeAttachmentId(file: File): string {
  return `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function processUploadedFile(file: File): Promise<AttachedFile> {
  const ext = getExtension(file.name);
  const rawMime = file.type || "application/octet-stream";

  // 1. SVG: read XML text so Gemini gets exact vector code, plus provide previewUrl
  if (rawMime === "image/svg+xml" || ext === "svg") {
    const [textContent, dataUrl] = await Promise.all([
      readAsText(file),
      readAsDataUrl(file),
    ]);
    return {
      id: makeAttachmentId(file),
      name: file.name,
      mimeType: "image/svg+xml",
      size: file.size,
      kind: "text",
      content: textContent.slice(0, 60_000),
      previewUrl: dataUrl,
    };
  }

  // 2. Raster images
  if (
    rawMime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif", "bmp", "ico", "avif"].includes(ext)
  ) {
    const dataUrl = await readAsDataUrl(file);
    const normalizedMime =
      rawMime === "image/jpg" ? "image/jpeg" : rawMime;

    if (GEMINI_IMAGE_MIMES.has(normalizedMime)) {
      const base64Data = dataUrl.split(",")[1] || "";
      return {
        id: makeAttachmentId(file),
        name: file.name,
        mimeType: normalizedMime,
        size: file.size,
        kind: "image",
        base64Data,
        previewUrl: dataUrl,
      };
    }

    // Convert less common image formats (bmp, avif, ico, tiff) to PNG for Gemini
    try {
      const converted = await rasterizeImageToPng(dataUrl);
      return {
        id: makeAttachmentId(file),
        name: file.name,
        mimeType: converted.mimeType,
        size: file.size,
        kind: "image",
        base64Data: converted.base64Data,
        previewUrl: converted.previewUrl,
      };
    } catch {
      return {
        id: makeAttachmentId(file),
        name: file.name,
        mimeType: rawMime,
        size: file.size,
        kind: "binary",
        previewUrl: dataUrl,
      };
    }
  }

  // 3. PDF, Audio, Video (Gemini native inlineData)
  const isGeminiInline =
    GEMINI_INLINE_EXACT.has(rawMime) ||
    ext === "pdf" ||
    GEMINI_INLINE_PREFIXES.some((prefix) => rawMime.startsWith(prefix)) ||
    ["mp3", "wav", "ogg", "m4a", "aac", "flac", "mp4", "webm", "mov"].includes(ext);

  if (isGeminiInline) {
    const dataUrl = await readAsDataUrl(file);
    const base64Data = dataUrl.split(",")[1] || "";
    const inferredMime =
      rawMime !== "application/octet-stream"
        ? rawMime
        : ext === "pdf"
          ? "application/pdf"
          : ext === "mp3"
            ? "audio/mpeg"
            : ext === "wav"
              ? "audio/wav"
              : ext === "mp4"
                ? "video/mp4"
                : ext === "webm"
                  ? "video/webm"
                  : rawMime;

    return {
      id: makeAttachmentId(file),
      name: file.name,
      mimeType: inferredMime,
      size: file.size,
      kind: "inline",
      base64Data,
    };
  }

  // 4. Text / code / structured data files
  if (await looksLikeTextFile(file)) {
    const content = await readAsText(file);
    return {
      id: makeAttachmentId(file),
      name: file.name,
      mimeType: rawMime === "application/octet-stream" ? "text/plain" : rawMime,
      size: file.size,
      kind: "text",
      content: content.slice(0, 60_000),
    };
  }

  // 5. Any other binary file (archives, office docs, fonts, design files, etc.)
  return {
    id: makeAttachmentId(file),
    name: file.name,
    mimeType: rawMime,
    size: file.size,
    kind: "binary",
  };
}
