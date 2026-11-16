// Origin-locked CORS helper for Supabase Edge Functions

export function getAllowedOrigins(): string[] {
  const raw = [
    Deno.env.get("SITE_ORIGIN") || "",
    Deno.env.get("APP_URL") || "",
    "https://emdashworld.vercel.app",
    "http://localhost:3000",
  ]
    .join(",")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return Array.from(new Set(raw));
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = (req.headers.get("origin") || "").replace(/\/+$/, "");
  const originToReflect =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": originToReflect,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }
  return null;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}
