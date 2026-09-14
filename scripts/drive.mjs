/**
 * Drives the built app over CDP for a visual smoke test:
 * starts a new game, fast-forwards, screenshots the dashboard.
 * Run: electron must be launched with --remote-debugging-port=9222 first,
 * then: node scripts/drive.mjs <out.png>
 */
import WebSocket from "ws";
import { writeFileSync } from "fs";

const out = process.argv[2] ?? "dashboard.png";
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
let id = 0;
const pending = new Map();
ws.on("message", (d) => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
await new Promise((r) => ws.on("open", r));

const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("page error: " + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
};

// Fresh start, then found the company from the setup screen.
await evaluate(`localStorage.clear(); location.reload(); "ok"`);
await new Promise((r) => setTimeout(r, 1500));
await evaluate(`
  document.querySelector("#cname").value = "PixelWorks";
  document.querySelector("#go").click();
  "started"
`);

// Let the game tick a bit at max speed, then pause on the dashboard.
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "3" })); "fast"`);
await new Promise((r) => setTimeout(r, 6000));
await evaluate(`
  // dismiss any event modal so the dashboard is visible
  document.querySelector(".overlay button.choice")?.click();
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
  "paused"
`);
await new Promise((r) => setTimeout(r, 400));

const week = await evaluate(`document.querySelector(".top-stat .v")?.textContent ?? "?"`);
const errors = await evaluate(`window.__errs ?? []`);
console.log("game week reached:", week.trim(), "| page errors:", JSON.stringify(errors));

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("saved", out);
ws.close();
