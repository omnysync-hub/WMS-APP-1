/**
 * Downloads / stages ONNX models into assets/models.
 * Usage: node scripts/fetch-models.mjs
 */
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "assets", "models");
fs.mkdirSync(ROOT, { recursive: true });

const MODELS = [
  {
    name: "mobilefacenet_int8.onnx",
    url: process.env.WMS_MOBILEFACENET_URL || "",
  },
  {
    name: "silent_face_anti_spoof_int8.onnx",
    url: process.env.WMS_ANTISPOOF_URL || "",
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    mod
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
}

for (const m of MODELS) {
  const dest = path.join(ROOT, m.name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log("ok (exists):", m.name);
    continue;
  }
  if (!m.url) {
    fs.writeFileSync(dest, Buffer.alloc(0));
    console.warn(
      `PLACEHOLDER: ${m.name} — set WMS_MOBILEFACENET_URL / WMS_ANTISPOOF_URL or copy licensed INT8 ONNX into assets/models/`
    );
    continue;
  }
  console.log("Downloading", m.name, "…");
  await download(m.url, dest);
  console.log("saved", dest, fs.statSync(dest).size, "bytes");
}

console.log(`
Next:
  1. Verify embedding model outputs exactly 512 floats
  2. npx expo prebuild
  3. eas build --profile development --platform android
`);
