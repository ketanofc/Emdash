import { z } from "https://esm.sh/zod@3.24.2";

const GEMINI_TYPE_MAP: Record<string, string> = {
  object: "OBJECT",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
};

export function toGeminiSchema(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(schema)) {
    if (key === "additionalProperties" || key === "$schema") continue;
    if (key === "type" && typeof val === "string") {
      out.type = GEMINI_TYPE_MAP[val.toLowerCase()] ?? val.toUpperCase();
      continue;
    }
    if (key === "properties" && val && typeof val === "object" && !Array.isArray(val)) {
      const mapped: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(val as Record<string, unknown>)) {
        mapped[pk] =
          pv && typeof pv === "object"
            ? toGeminiSchema(pv as Record<string, unknown>)
            : pv;
      }
      out.properties = mapped;
      continue;
    }
    if (key === "items" && val && typeof val === "object" && !Array.isArray(val)) {
      out.items = toGeminiSchema(val as Record<string, unknown>);
      continue;
    }
    out[key] = val;
  }
  return out;
}

export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const rawType = typeof schema.type === "string" ? schema.type.toLowerCase() : "any";
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const strEnums = schema.enum.filter((v): v is string => typeof v === "string");
    if (strEnums.length === schema.enum.length) {
      return z.enum(strEnums as [string, ...string[]]);
    }
  }
  switch (rawType) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "integer":
      return z.number().int();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(
        schema.items && typeof schema.items === "object"
          ? jsonSchemaToZod(schema.items as Record<string, unknown>)
          : z.unknown()
      );
    case "object": {
      const props =
        schema.properties && typeof schema.properties === "object"
          ? (schema.properties as Record<string, Record<string, unknown>>)
          : {};
      const required = new Set(
        Array.isArray(schema.required)
          ? schema.required.filter((k): k is string => typeof k === "string")
          : []
      );
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [k, def] of Object.entries(props)) {
        const inner = jsonSchemaToZod(def);
        shape[k] = required.has(k) ? inner : inner.optional();
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}

export function parseAndValidateWithSchema(
  rawText: string,
  schema: Record<string, unknown>
): { ok: true; jsonText: string } | { ok: false; error: string } {
  let candidate = rawText.trim();
  if (candidate.startsWith("```")) {
    const match = candidate.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (match?.[1]) candidate = match[1].trim();
  }
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first !== -1 && last > first) {
    candidate = candidate.slice(first, last + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }

  const result = jsonSchemaToZod(schema).safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, jsonText: JSON.stringify(result.data) };
}
