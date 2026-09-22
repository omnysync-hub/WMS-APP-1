# Bundled ONNX models (phase 2)

Required files (copied into the app document directory by `node scripts/fetch-models.mjs`):

| File | Purpose | Dim / notes | License check |
| :--- | :--- | :--- | :--- |
| `mobilefacenet_int8.onnx` | Face embedding | **Must output exactly 512 floats** (ERP contract) | Prefer Apache-2.0 / MIT commercial-friendly weights only |
| `silent_face_anti_spoof_int8.onnx` | Silent-Face / MiniFASNet anti-spoof | 2-class logits → softmax live vs spoof | MiniVision Silent-Face-Anti-Spoofing (verify Apache-2.0 before shipping) |

## Fetch

```bash
node scripts/fetch-models.mjs
```

Place files under `assets/models/` (repo) and they are also copied to the device document dir on first run when you ship via EAS with assets included — or load from documentDirectory after the script.

**Do not commit large binaries if your org policy forbids it** — use EAS secrets / CI artifact download instead.

## Runtime

- Inference via `onnxruntime-react-native` on the JS/native ORT thread.
- Set `EXPO_PUBLIC_FACE_ML_MOCK=1` only for Dev Client UI testing without models (stub scores).
