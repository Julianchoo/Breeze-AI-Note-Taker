import assert from "node:assert/strict";
import { GET } from "../src/app/api/android/apk/route";

async function main() {
const originalFetch = globalThis.fetch;
const bytes = new Uint8Array(2048);
bytes.set([0x50, 0x4b, 3, 4]);
function upstream(body: Uint8Array | string, status = 200, length = 2048, url = "https://release-assets.githubusercontent.com/test.apk") {
  const response = new Response(body, { status, headers: { "content-length": String(length) } });
  Object.defineProperty(response, "url", { value: url });
  return response;
}
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://github.com/Julianchoo/Breeze-AI-Note-Taker/releases/download/android-latest/breeze.apk");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.headers, undefined);
    return upstream(bytes);
  };
  const success = await GET();
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.equal(success.headers.get("content-disposition"), 'attachment; filename="breeze.apk"');
  assert.equal(success.headers.get("cache-control"), "no-store");
  assert.deepEqual(new Uint8Array(await success.arrayBuffer()), bytes);
  for (const response of [
    upstream("missing", 404), upstream("<html>error</html>"), upstream(bytes, 200, 5 * 1024 * 1024),
    upstream(bytes, 200, 2048, "https://example.com/not-trusted"), upstream(bytes, 200, 3000),
  ]) {
    globalThis.fetch = async () => response;
    assert.equal((await GET()).status, 502);
  }
  globalThis.fetch = async () => { throw new Error("network unavailable"); };
  assert.equal((await GET()).status, 502);
  console.log("Android download tests passed");
} finally { globalThis.fetch = originalFetch; }
if (process.env.ANDROID_DOWNLOAD_LIVE === "1") {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/vnd.android.package-archive");
  const liveBytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(liveBytes.length, Number(response.headers.get("content-length")));
  assert.deepEqual([...liveBytes.slice(0, 4)], [0x50, 0x4b, 3, 4]);
  console.log("Live public Android APK download passed");
}

}

main().catch((error) => { console.error(error); process.exitCode = 1; });
