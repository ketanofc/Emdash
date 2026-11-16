// Origin-locked CORS helper for Supabase Edge Functions

export function getAllowedOrigin(): string {
  const configured =
    Deno.env.get("SITE_ORIGIN") ||
    Deno.env.get("APP_URL") ||
    "http://localhost:3000";
  return configured.replace(/\/+$/, "");
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigin = getAllowedOrigin();
  const requestOrigin = (req.headers.get("origin") || "").replace(/\/+$/, "");
  const originToReflect =
    requestOrigin && requestOrigin === allowedOrigin
      ? requestOrigin
      : allowedOrigin;

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
