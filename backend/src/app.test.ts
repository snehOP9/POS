import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/emberserve-test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-that-is-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-that-is-at-least-32-characters";

const { createApp } = await import("./app.js");

async function withServer(app: ReturnType<typeof createApp>, run: (url: string) => Promise<void>) {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("liveness remains public and does not expose database state", async () => {
  await withServer(createApp({ readinessToken: "test-readiness-token-with-more-than-32-characters" }), async (url) => {
    const response = await fetch(url + "/health");
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.equal(body.includes("database"), false);
    assert.equal(body.includes("connected"), false);
  });
});

test("protected readiness rejects missing credentials", async () => {
  await withServer(createApp({ readinessToken: "test-readiness-token-with-more-than-32-characters" }), async (url) => {
    const response = await fetch(url + "/health/ready");
    assert.equal(response.status, 401);
  });
});

test("protected readiness accepts its token and returns only safe status fields", async () => {
  await withServer(createApp({ readinessToken: "test-readiness-token-with-more-than-32-characters" }), async (url) => {
    const response = await fetch(url + "/health/ready", {
      headers: { authorization: "Bearer test-readiness-token-with-more-than-32-characters" }
    });
    assert.notEqual(response.status, 401);
    assert.ok([200, 503].includes(response.status));
    const body = await response.json() as { data?: Record<string, unknown> };
    assert.deepEqual(Object.keys(body.data ?? {}).sort(), ["status", "timestamp"]);
  });
});
