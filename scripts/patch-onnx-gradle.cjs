/**
 * onnxruntime-react-native android/build.gradle still uses Gradle's removed VersionNumber.
 * Safe for RN >= 0.71 (this app is 0.86) — those fbjni extractLibs lines never run.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "onnxruntime-react-native",
  "android",
  "build.gradle"
);

if (!fs.existsSync(target)) process.exit(0);

let src = fs.readFileSync(target, "utf8");
const needle =
  '  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {\n' +
  '    extractLibs "com.facebook.fbjni:fbjni:+:headers"\n' +
  '    extractLibs "com.facebook.fbjni:fbjni:+"\n' +
  "  }";
const replacement =
  "  // patched: VersionNumber removed in Gradle 9 (RN >= 0.71 — fbjni extract unused)\n";

if (src.includes("VersionNumber.parse(REACT_NATIVE_VERSION)")) {
  src = src.replace(needle, replacement);
  fs.writeFileSync(target, src);
  console.log("patched onnxruntime-react-native android/build.gradle");
} else {
  console.log("onnx gradle already patched or upstream fixed");
}
