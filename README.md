# Workman Field Companion (Mobile)

Native Expo (SDK 57) companion for **Workman Services ERP** — dual persona + phase-2 on-device face ML.

> **Expo Go is no longer supported.** Phase 2 requires a **custom Dev Client** (`expo-dev-client` + Vision Camera + ONNX Runtime).

## Quick start (Dev Client)

```bash
cd workman-mobile
cp .env.example .env
node scripts/fetch-models.mjs   # stage ONNX paths (set WMS_*_URL for real models)
npx expo prebuild
eas build --profile development --platform android
# install the APK, then:
npx expo start --dev-client
```

ERP must be running (default `http://localhost:3001`).

| Platform | Base URL |
| :--- | :--- |
| Android emulator | `http://10.0.2.2:3001` |
| iOS simulator | `http://localhost:3001` |
| Physical device | `http://<your-LAN-IP>:3001` |

## Face ML (phase 2)

- **Detector**: `react-native-vision-camera-face-detector` (ML Kit) — blink / yaw challenges; preferred over MediaPipe for smaller native surface on VC5
- **Embedding**: MobileFaceNet ONNX INT8 → **512 floats** (ERP contract)
- **Liveness**: Silent-Face / MiniFASNet ONNX INT8
- **Thresholds**: `services/face/thresholds.ts` — **pilot defaults only**; ask before locking after real-employee score logs
- **QA**: `docs/FACE_ML_QA_CHECKLIST.md`
- Mock inference (UI only): `EXPO_PUBLIC_FACE_ML_MOCK=1`

Enrollment: Profile / Attendance → Face enrollment (uploads embedding only; `faceTemplateUrl` unused).

## Stack

Expo Router · Dev Client · Vision Camera 5 · ONNX Runtime · TanStack Query · Zustand · Expo SQLite · NativeWind v4

## EAS

```bash
eas build:configure   # set extra.eas.projectId in app.json
eas build --profile development --platform android
eas build --profile preview --platform android
```
