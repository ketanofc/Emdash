import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeminiError,
  gemini,
  listGeminiModels,
  pickDefaultFlashModel,
  runPipelineViaServer,
} from "./gemini";

describe("server-backed gemini client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries once on 429 and returns text from /api/gemini/generate when retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "RATE_LIMIT", error: "Too many requests" }), {
          status: 429,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: "hello world" }), { status: 200 })
      );

    vi.stubGlobal("fetch", fetchMock);

    const output = await gemini({
      model: "gemini-4-hydrogen",
      system: "sys",
      prompt: "hi",
      retryDelayMs: 1,
    });

    expect(output).toBe("hello world");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/gemini/generate");
    const headers = (init.headers as Record<string, string>) ?? {};
    expect(headers["x-goog-api-key"]).toBeUndefined();
  });

  it("throws RATE_LIMIT when 429 persists after retry", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ code: "RATE_LIMIT", error: "Quota exhausted" }), {
        status: 429,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      gemini({
        model: "gemini-4-hydrogen",
        system: "sys",
        prompt: "hi",
        retryDelayMs: 1,
      })
    ).rejects.toMatchObject({
      name: "GeminiError",
      code: "RATE_LIMIT",
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps 403 and 503 server key errors cleanly without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "INVALID_KEY", error: "API key invalid" }), {
        status: 403,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await gemini({
        model: "gemini-4-hydrogen",
        system: "sys",
        prompt: "hi",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(GeminiError);
    expect((caught as GeminiError).code).toBe("INVALID_KEY");
    expect((caught as GeminiError).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches server models from /api/gemini/models and picks general Flash/Hydrogen over TTS", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            {
              id: "gemini-2.5-flash-preview-tts",
              displayName: "Gemini 2.5 Flash Preview TTS",
            },
            {
              id: "gemini-4-argon",
              displayName: "Gemini 4 Argon",
            },
            {
              id: "gemini-4-hydrogen",
              displayName: "Gemini 4 Hydrogen",
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = await listGeminiModels();
    expect(models.map((m) => m.id)).toEqual([
      "gemini-2.5-flash-preview-tts",
      "gemini-4-argon",
      "gemini-4-hydrogen",
    ]);
    expect(pickDefaultFlashModel(models)).toBe("gemini-4-hydrogen");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/gemini/models");
  });

  it("streams stages and final result from /api/gemini/pipeline SSE", async () => {
    const encoder = new TextEncoder();
    const ssePayload = [
      'event: stage\ndata: {"stage":"brief"}\n\n',
      'event: stage\ndata: {"stage":"build"}\n\n',
      'event: result\ndata: {"brief":{"appName":"Demo"},"plan":{"files":[],"components":[],"state":[],"interactions":[]},"files":{"index.html":"<html></html>"},"summary":"Built Demo."}\n\n',
    ].join("");

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    );

    const stages: string[] = [];
    const result = await runPipelineViaServer(
      "Build a demo app",
      { model: "gemini-4-hydrogen" },
      (s) => stages.push(s)
    );

    expect(stages).toEqual(["brief", "build"]);
    expect(result.summary).toBe("Built Demo.");
    expect(result.files["index.html"]).toBe("<html></html>");
  });

  it("formats model display names with clear Gemini branding", async () => {
    const { formatModelDisplayName } = await import("./gemini");
    expect(formatModelDisplayName("gemini-3.5-flash")).toBe("Gemini 3.5 Flash");
    expect(formatModelDisplayName("gemini-3.5-flash-lite")).toBe("Gemini 3.5 Flash Lite");
    expect(formatModelDisplayName("gemini-4-hydrogen")).toBe("Gemini 4 Hydrogen");
    expect(formatModelDisplayName("gemini-2.5-flash")).toBe("Gemini 2.5 Flash");
    expect(formatModelDisplayName("gemini-4-argon")).toBe("Gemini 4 Argon");
    expect(formatModelDisplayName("gemini-2.5-pro")).toBe("Gemini 2.5 Pro");
  });

  it("falls back to default Gemini models without throwing when /api/gemini/models returns 404 and no key is set", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("Not Found", { status: 404 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = await listGeminiModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].displayName).toContain("Gemini");
  });
});

