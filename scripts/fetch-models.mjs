/**
 * Downloads ONNX models into assets/models (512-d MobileFaceNet + MiniFASNet anti-spoof).
 * Usage: node scripts/fetch-models.mjs
 */
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "assets", "models");
const TMP = path.join(__dirname, "..", ".tmp-models");
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const EMBED_NAME = "mobilefacenet_int8.onnx";
const LIVE_NAME = "silent_face_anti_spoof_int8.onnx";

/** Hailo MIT ArcFace MobileFaceNet zip → mbf.onnx (512-d, 112×112). */
const HAILO_ZIP =
  process.env.WMS_MOBILEFACENET_ZIP ||
  "https://hailo-model-zoo.s3.eu-west-2.amazonaws.com/FaceRecognition/arcface/arcface_mobilefacenet/pretrained/2022-08-24/arcface_mobilefacenet.zip";

/** Override direct URLs if you host your own INT8 exports. */
const EMBED_URL = process.env.WMS_MOBILEFACENET_URL || "";
const LIVE_URL = process.env.WMS_ANTISPOOF_URL || "";

function get(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const file = createWriteStream(dest);
        pipeline(res, file).then(resolve, reject);
      })
      .on("error", reject);
  });
}

function isGood(file) {
  return fs.existsSync(file) && fs.statSync(file).size > 50_000;
}

async function fetchEmbed() {
  const dest = path.join(ROOT, EMBED_NAME);
  if (isGood(dest)) {
    console.log("ok (exists):", EMBED_NAME, fs.statSync(dest).size, "bytes");
    return;
  }
  if (EMBED_URL) {
    console.log("Downloading embed from WMS_MOBILEFACENET_URL…");
    await get(EMBED_URL, dest);
    console.log("saved", dest, fs.statSync(dest).size);
    return;
  }

  const zipPath = path.join(TMP, "arcface_mobilefacenet.zip");
  console.log("Downloading Hailo MobileFaceNet zip (MIT)…");
  await get(HAILO_ZIP, zipPath);
  try {
    execSync(`tar -xf "${zipPath}" -C "${TMP}"`, { stdio: "inherit" });
  } catch {
    // Windows may need Expand-Archive
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${TMP}'"`,
      { stdio: "inherit" }
    );
  }
  const candidates = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".onnx")) candidates.push(p);
    }
  }
  walk(TMP);
  const mbf = candidates.find((p) => /mbf\.onnx$/i.test(p)) || candidates[0];
  if (!mbf) throw new Error("No .onnx found inside Hailo zip");
  fs.copyFileSync(mbf, dest);
  console.log("saved", dest, fs.statSync(dest).size, "bytes from", mbf);
}

async function fetchLiveness() {
  const dest = path.join(ROOT, LIVE_NAME);
  if (isGood(dest)) {
    console.log("ok (exists):", LIVE_NAME, fs.statSync(dest).size, "bytes");
    return;
  }
  if (LIVE_URL) {
    console.log("Downloading anti-spoof from WMS_ANTISPOOF_URL…");
    await get(LIVE_URL, dest);
    console.log("saved", dest, fs.statSync(dest).size);
    return;
  }

  // MiniVision Silent-Face MiniFASNetV2 ONNX (Apache-2.0 upstream)
  const DEFAULT_LIVE =
    "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/resolve/main/minifasnet_v2.onnx?download=true";
  const url = LIVE_URL || DEFAULT_LIVE;
  console.log("Downloading MiniFASNetV2 anti-spoof ONNX…");
  await get(url, dest);
  console.log("saved", dest, fs.statSync(dest).size, "bytes");
}

await fetchEmbed();
await fetchLiveness();

console.log(`
Next:
  1. Confirm ${EMBED_NAME} outputs exactly 512 floats
  2. Place a MiniFASNet ONNX as ${LIVE_NAME} (WMS_ANTISPOOF_URL=...)
  3. Rebuild Dev Client / APK so assets copy onto device
`);
