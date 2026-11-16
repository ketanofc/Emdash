import { z } from "zod";

const GEMINI_TYPE_MAP: Record<string, string> = {
  object: "OBJECT",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
};

/**
 * Converts one canonical lowercase JSON Schema into Gemini's uppercase Schema format.
 */
export function toGeminiSchema(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(schema)) {
    if (key === "additionalProperties" || key === "$schema") {
      continue;
    }

    if (key === "type" && typeof val === "string") {
      const lower = val.toLowerCase();
      out.type = GEMINI_TYPE_MAP[lower] ?? val.toUpperCase();
      continue;
    }

    if (key === "properties" && val && typeof val === "object" && !Array.isArray(val)) {
      const mappedProps: Record<string, unknown> = {};
      for (const [propKey, propSchema] of Object.entries(
        val as Record<string, unknown>
      )) {
        mappedProps[propKey] =
          propSchema && typeof propSchema === "object"
            ? toGeminiSchema(propSchema as Record<string, unknown>)
            : propSchema;
      }
      out.properties = mappedProps;
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

/**
 * Builds a Zod schema dynamically from canonical lowercase JSON Schema.
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const rawType =
    typeof schema.type === "string" ? schema.type.toLowerCase() : "any";

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const stringValues = schema.enum.filter(
      (item): item is string => typeof item === "string"
    );
    if (stringValues.length === schema.enum.length && stringValues.length >= 1) {
      return z.enum(stringValues as [string, ...string[]]);
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
    case "array": {
      const itemsSchema =
        schema.items && typeof schema.items === "object"
          ? jsonSchemaToZod(schema.items as Record<string, unknown>)
          : z.unknown();
      return z.array(itemsSchema);
    }
    case "object": {
      const props =
        schema.properties && typeof schema.properties === "object"
          ? (schema.properties as Record<string, Record<string, unknown>>)
          : {};
      const requiredSet = new Set(
        Array.isArray(schema.required)
          ? schema.required.filter((k): k is string => typeof k === "string")
          : []
      );

      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [propKey, propDef] of Object.entries(props)) {
        const zodProp = jsonSchemaToZod(propDef);
        shape[propKey] = requiredSet.has(propKey) ? zodProp : zodProp.optional();
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}

export function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function parseAndValidateWithSchema(
  rawText: string,
  schema: Record<string, unknown>
): { ok: true; jsonText: string } | { ok: false; error: string } {
  const candidate = extractJsonText(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }

  const validator = jsonSchemaToZod(schema);
  const result = validator.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; "),
    };
  }

  return { ok: true, jsonText: JSON.stringify(result.data) };
}
