import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express from "express";
import { createLoginRateLimiter } from "./loginRateLimit.js";

async function withLoginServer(
  status: number,
  run: (url: string) => Promise<void>
) {
  const app = express();
  app.post("/login", createLoginRateLimiter(), (_request, response) => {
    response.status(status).json({ success: status === 200 });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}/login`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("limits repeated failed logins to five in fifteen minutes", async () => {
  await withLoginServer(401, async (url) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(url, { method: "POST" });
      assert.equal(response.status, 401);
      await response.text();
    }

    const blocked = await fetch(url, { method: "POST" });
    assert.equal(blocked.status, 429);
    const body = await blocked.json() as { error: { code: string } };
    assert.equal(body.error.code, "AUTH_RATE_LIMITED");
  });
});

test("successful login requests are excluded from the failure budget", async () => {
  await withLoginServer(200, async (url) => {
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await fetch(url, { method: "POST" });
      assert.equal(response.status, 200);
      await response.text();
    }
  });
});
