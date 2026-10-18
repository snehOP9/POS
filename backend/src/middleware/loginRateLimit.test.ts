import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";

import { createLoginAccountLimiter, createLoginIpLimiter } from "./loginRateLimit.js";

test("login limiter is account-aware and resets after its window", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post("/login", createLoginAccountLimiter({ windowMs: 200, limit: 2 }), (_request, response) => {
    response.status(200).json({ success: true });
  });

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  const url = "http://127.0.0.1:" + address.port + "/login";

  try {
    const send = (email: string, ip = "198.51.100.10") => fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email })
    });

    assert.equal((await send("one@example.test")).status, 200);
    assert.equal((await send("one@example.test")).status, 200);
    assert.equal((await send("one@example.test")).status, 429);
    assert.equal((await send(" ONE@EXAMPLE.TEST ")).status, 429);
    assert.equal((await send("one@example.test", "198.51.100.11")).status, 200);
    assert.equal((await send("two@example.test")).status, 200);

    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal((await send("one@example.test")).status, 200);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("IP login budget blocks account spraying across different emails", async () => {
  const app = express();
  app.use(express.json());
  app.post("/login", createLoginIpLimiter({ windowMs: 5000, limit: 2 }), (_request, response) => {
    response.status(200).json({ success: true });
  });
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  try {
    const send = (email: string) => fetch("http://127.0.0.1:" + address.port + "/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    assert.equal((await send("first@example.test")).status, 200);
    assert.equal((await send("second@example.test")).status, 200);
    assert.equal((await send("third@example.test")).status, 429);
  } finally {
    server.close();
    await once(server, "close");
  }
});
