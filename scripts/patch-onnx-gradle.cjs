/**
 * Patches onnxruntime-react-native for this Expo/RN stack:
 * 1) Gradle VersionNumber removed in Gradle 9
 * 2) 16 KB page-size link flags (Samsung / Android 15+)
 * 3) Guard OrtApi install so a missing/partial native module cannot white-screen the app
 */
const fs = require("fs");
const path = require("path");

const androidDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "onnxruntime-react-native",
  "android"
);
const libDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "onnxruntime-react-native",
  "lib"
);

const gradlePath = path.join(androidDir, "build.gradle");
const cmakePath = path.join(androidDir, "CMakeLists.txt");
const bindingPath = path.join(libDir, "binding.ts");
const backendPath = path.join(libDir, "backend.ts");
const indexPath = path.join(libDir, "index.ts");

if (!fs.existsSync(gradlePath)) process.exit(0);

// --- 1) VersionNumber ---
{
  let src = fs.readFileSync(gradlePath, "utf8");
  const needle =
    '  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {\n' +
    '    extractLibs "com.facebook.fbjni:fbjni:+:headers"\n' +
    '    extractLibs "com.facebook.fbjni:fbjni:+"\n' +
    "  }";
  const replacement =
    "  // patched: VersionNumber removed in Gradle 9 (RN >= 0.71 — fbjni extract unused)\n";

  if (src.includes("VersionNumber.parse(REACT_NATIVE_VERSION)")) {
    src = src.replace(needle, replacement);
    fs.writeFileSync(gradlePath, src);
    console.log("patched onnx VersionNumber");
  }
}

// --- 2) 16 KB page size cmake args ---
{
  let src = fs.readFileSync(gradlePath, "utf8");
  if (!src.includes("ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES")) {
    src = src.replace(
      '"-DANDROID_STL=c++_shared",\n            "-DNODE_MODULES_DIR=${nodeModules}",',
      '"-DANDROID_STL=c++_shared",\n' +
        '            "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON",\n' +
        '            "-DNODE_MODULES_DIR=${nodeModules}",'
    );
    fs.writeFileSync(gradlePath, src);
    console.log("patched onnx ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES");
  } else {
    console.log("onnx page-size gradle flag already present");
  }
}

// --- 3) CMake max-page-size for libonnxruntimejsi.so ---
{
  if (fs.existsSync(cmakePath)) {
    let cmake = fs.readFileSync(cmakePath, "utf8");
    if (!cmake.includes("max-page-size=16384")) {
      cmake = cmake.replace(
        "target_link_libraries(\n  onnxruntimejsi\n  ${onnxruntime-lib}\n  fbjni::fbjni\n  ${RN_LIBS}\n  ${log-lib} # <-- Logcat logger\n  android # <-- Android JNI core\n)",
        "target_link_libraries(\n  onnxruntimejsi\n  ${onnxruntime-lib}\n  fbjni::fbjni\n  ${RN_LIBS}\n  ${log-lib} # <-- Logcat logger\n  android # <-- Android JNI core\n)\n\n" +
          "# 16 KB page size (Android 15+ / Samsung)\n" +
          "target_link_options(onnxruntimejsi PRIVATE \"-Wl,-z,max-page-size=16384\")\n"
      );
      fs.writeFileSync(cmakePath, cmake);
      console.log("patched onnx CMakeLists 16KB link flag");
    } else {
      console.log("onnx CMake 16KB flag already present");
    }
  }
}

// --- 4) Safe binding (no white-screen if Onnxruntime native module missing) ---
{
  if (fs.existsSync(bindingPath)) {
    const safeBinding = `// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// patched by workman-mobile/scripts/patch-onnx-gradle.cjs — never crash app launch

import { NativeModules } from 'react-native';
import type { OrtApi as OrtApiType } from './api';

export const Module = NativeModules.Onnxruntime;

declare global {
  var OrtApi: OrtApiType; // eslint-disable-line no-var
}

try {
  if (typeof globalThis.OrtApi === 'undefined' && Module && typeof Module.install === 'function') {
    Module.install();
  }
} catch (e) {
  console.warn('[onnxruntime] Module.install failed', e);
}

export const OrtApi =
  globalThis.OrtApi ??
  new Proxy(
    {},
    {
      get: () => {
        throw new Error('OrtApi is not initialized. Please make sure Onnxruntime installation is successful.');
      },
    },
  );
`;
    fs.writeFileSync(bindingPath, safeBinding);
    console.log("patched onnx binding.ts (safe install)");
  }
}

// --- 5) Defer OrtApi.listSupportedBackends so import-time can't white-screen ---
{
  if (fs.existsSync(backendPath)) {
    let src = fs.readFileSync(backendPath, "utf8");
    if (src.includes("export const listSupportedBackends = OrtApi.listSupportedBackends;")) {
      src = src.replace(
        "export const listSupportedBackends = OrtApi.listSupportedBackends;",
        `export const listSupportedBackends = (): { name: string }[] => {
  try {
    const api = (globalThis as { OrtApi?: { listSupportedBackends?: () => { name: string }[] } }).OrtApi;
    if (!api || typeof api.listSupportedBackends !== 'function') return [];
    return api.listSupportedBackends();
  } catch {
    return [];
  }
};`
      );
      fs.writeFileSync(backendPath, src);
      console.log("patched onnx backend.ts (safe listSupportedBackends)");
    } else {
      console.log("onnx backend listSupportedBackends already patched or upstream changed");
    }
  }
}

// --- 6) index.ts: don't throw if backends empty ---
{
  if (fs.existsSync(indexPath)) {
    let src = fs.readFileSync(indexPath, "utf8");
    if (!src.includes("patched: safe backend register")) {
      src = src.replace(
        `const backends = listSupportedBackends();
for (const backend of backends) {
  registerBackend(backend.name, onnxruntimeBackend, 1);
}`,
        `// patched: safe backend register
const backends = typeof listSupportedBackends === 'function' ? listSupportedBackends() : [];
for (const backend of backends || []) {
  registerBackend(backend.name, onnxruntimeBackend, 1);
}`
      );
      fs.writeFileSync(indexPath, src);
      console.log("patched onnx index.ts (safe register)");
    } else {
      console.log("onnx index already patched");
    }
  }
}
