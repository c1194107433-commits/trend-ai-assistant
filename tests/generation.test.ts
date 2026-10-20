import test from "node:test";
import assert from "node:assert/strict";
import { createGenerationHandler, createLimiter } from "../lib/generation-server.ts";
import { parseGeneratedNote, parseProduct, productInputErrors } from "../lib/generation-schema.ts";
import { demos } from "../lib/content.ts";

const fakeKey = "sk-TEST-ONLY-NOT-A-REAL-KEY-123456789";
const product = demos[0].input;
test("front-end validation catches bypassed limits, accepts boundaries and retains required-field errors", () => {
  const boundary = { ...product, name: "名".repeat(160), facts: "料".repeat(6000), audience: "人".repeat(200) };
  assert.deepEqual(productInputErrors(boundary), {});
  assert.deepEqual(Object.keys(productInputErrors({ ...boundary, name: boundary.name + "名", facts: boundary.facts + "料", audience: boundary.audience + "人" })), ["name", "facts", "audience"]);
  assert.equal(productInputErrors({ ...product, name: "  " }).name, "请填写商品名称");
  assert.ok(productInputErrors({ ...product, name: "🧸".repeat(81) }).name);
  assert.deepEqual(productInputErrors(product), {});
});
const generated = { titles: ["云朵标题一", "云朵标题二", "云朵标题三"], body: "虚构课堂示例：云朵造型搭配奶白与淡紫。", tags: ["潮玩", "云朵", "摆件", "配色", "桌面"], notes: ["材质与尺寸未提供，已省略。"] };
function req(payload: unknown = { apiKey: fakeKey, input: product }, headers: Record<string, string> = {}, signal?: AbortSignal) {
  return new Request("http://localhost:3000/api/generate", {
    method: "POST", headers: { "Origin": "http://localhost:3000", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload), signal,
  });
}
function answer(content: unknown = generated, finish = "stop") {
  return Response.json({
    choices: [{ finish_reason: finish, message: { content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 800, completion_tokens: 400 },
  });
}

test("official endpoint, fixed budget and model; key stays outside model messages and response", async () => {
  let calls = 0;
  const handler = createGenerationHandler({ fetcher: async (url, options) => {
    calls++;
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${fakeKey}`);
    const body = JSON.parse(options?.body as string);
    assert.equal(body.model, "deepseek-flash");
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal(body.max_tokens, 1800);
    assert.equal(body.stream, false);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.messages.length, 2);
    assert.ok(!JSON.stringify(body).includes(fakeKey));
    assert.equal(body.tools, undefined);
    return answer();
  } });
  const response = await handler(req({ apiKey: fakeKey, input: product, model: "expensive-model", baseUrl: "https://untrusted.invalid", max_tokens: 999999 }));
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
  const result = await response.json();
  assert.equal(result.note.titles.length, 3);
  assert.equal(result.note.tags.length, 5);
  assert.deepEqual(result.usage, { inputTokens: 800, outputTokens: 400 });
  assert.ok(!JSON.stringify(result).includes(fakeKey));
  assert.equal(calls, 1);
});

test("missing key, foreign origin, unsupported content-type and invalid input make no upstream call", async () => {
  let calls = 0;
  const handler = createGenerationHandler({ fetcher: async () => { calls++; return answer(); } });
  assert.equal((await handler(req({ input: product }))).status, 401);
  assert.equal((await handler(req({ input: product }, { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" }))).status, 401);
  assert.equal((await handler(req(undefined, { Host: "127.0.0.1:3000", Origin: "http://localhost:3000" }))).status, 403);
  assert.equal((await handler(req(undefined, { Origin: "https://untrusted.invalid" }))).status, 403);
  assert.equal((await handler(req(undefined, { Origin: "null" }))).status, 403);
  assert.equal((await handler(req(undefined, { "Sec-Fetch-Site": "cross-site" }))).status, 403);
  assert.equal((await handler(req(undefined, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await handler(req({ apiKey: fakeKey, input: { ...product, name: "" } }))).status, 400);
  assert.equal((await handler(req({ apiKey: fakeKey, input: { ...product, facts: "字".repeat(6001) } }))).status, 400);
  assert.equal((await handler(req({ apiKey: fakeKey, input: { ...product, style: "unknown" } }))).status, 400);
  assert.equal(calls, 0);
});

test("request byte limit works even without content-length", async () => {
  const handler = createGenerationHandler({ fetcher: async () => { throw new Error("Must not call"); } });
  const response = await handler(req({ apiKey: fakeKey, input: product, extra: "中".repeat(12000) }));
  assert.equal(response.status, 413);
});

test("upstream auth, balance, busy and server errors are sanitized without retries", async () => {
  for (const [status, expected] of [[401, "INVALID_KEY"], [402, "INSUFFICIENT_BALANCE"], [429, "PROVIDER_BUSY"], [500, "PROVIDER_ERROR"]] as const) {
    let calls = 0;
    const handler = createGenerationHandler({ fetcher: async () => {
      calls++;
      return new Response(`Private upstream body ${fakeKey} ${product.facts}`, { status });
    } });
    const response = await handler(req());
    const data = await response.json();
    assert.equal(data.code, expected);
    assert.ok(!JSON.stringify(data).includes(fakeKey));
    assert.ok(!JSON.stringify(data).includes(product.facts));
    assert.equal(calls, 1);
  }
});

test("invalid and truncated output cannot replace a valid draft", async () => {
  for (const upstream of [
    answer(generated, "length"),
    answer({ ...generated, titles: ["only one"] }),
    answer({ ...generated, tags: ["x", "x", "x", "x", "x"] }),
    answer({ ...generated, notes: ["x".repeat(201)] }),
    Response.json({ choices: [{ finish_reason: "stop", message: { content: "" } }] }),
  ]) {
    const handler = createGenerationHandler({ fetcher: async () => upstream });
    const response = await handler(req());
    assert.equal(response.status, 502);
    const data = await response.json();
    assert.equal(data.code, "INVALID_OUTPUT");
    assert.equal(data.note, undefined);
  }
});

test("network failures are sanitized and never retried", async () => {
  let calls = 0;
  const handler = createGenerationHandler({ fetcher: async () => { calls++; throw new Error(fakeKey); } });
  const response = await handler(req());
  const data = await response.json();
  assert.equal(data.code, "UPSTREAM_UNAVAILABLE");
  assert.ok(!JSON.stringify(data).includes(fakeKey));
  assert.equal(calls, 1);
});

test("timeout aborts upstream and releases concurrency slot", async () => {
  const limiter = createLimiter();
  const handler = createGenerationHandler({
    limiter,
    timeoutMs: 10,
    fetcher: async (_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    }),
  });
  // Keep the test event loop alive while AbortSignal.timeout uses an unref'ed timer.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const response = await handler(req());
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, "TIMEOUT");
    const release = limiter.acquire(fakeKey);
    assert.ok(release);
    release();
  } finally { clearInterval(keepAlive); }
});

test("client cancellation reaches upstream without an automatic retry", async () => {
  const controller = new AbortController();
  let signal: AbortSignal | null | undefined;
  const handler = createGenerationHandler({ fetcher: async (_url, options) => {
    signal = options?.signal;
    controller.abort();
    signal?.throwIfAborted();
    return answer();
  } });
  const response = await handler(req(undefined, {}, controller.signal));
  assert.ok(signal?.aborted);
  assert.equal(response.status, 504);
});

test("limiter blocks concurrent/six-per-minute key use and expires entries", () => {
  const limiter = createLimiter();
  const release = limiter.acquire(fakeKey, 1000);
  assert.ok(release);
  assert.equal(limiter.acquire(fakeKey, 1001), null);
  release(); release();
  for (let i = 0; i < 5; i++) {
    const finish = limiter.acquire(fakeKey, 1002 + i);
    assert.ok(finish); finish();
  }
  assert.equal(limiter.acquire(fakeKey, 2000), null);
  const afterWindow = limiter.acquire(fakeKey, 62000);
  assert.ok(afterWindow); afterWindow();
});

test("global limiter caps key rotation and active provider work", () => {
  const limiter = createLimiter();
  const releases = [0, 1, 2].map((i) => limiter.acquire(`fake-key-${i}`, 1000));
  assert.ok(releases.every(Boolean));
  assert.equal(limiter.acquire("fourth-key", 1001), null);
  releases.forEach((release) => release?.());
  for (let i = 3; i < 12; i++) {
    const release = limiter.acquire(`fake-key-${i}`, 1002);
    assert.ok(release); release();
  }
  assert.equal(limiter.acquire("thirteenth-key", 1003), null);
});

test("input/output validators reject missing data and normalize tag prefixes", () => {
  assert.equal(parseProduct(null), null);
  assert.equal(parseProduct({ ...product, audience: " " }), null);
  assert.equal(parseGeneratedNote({ ...generated, body: " " }), null);
  assert.equal(parseGeneratedNote({ ...generated, tags: ["#", "a", "b", "c", "d"] }), null);
  assert.deepEqual(parseGeneratedNote({ ...generated, tags: ["#潮玩", "＃云朵", "摆件", "配色", "桌面"] })?.note.tags, generated.tags);
});
