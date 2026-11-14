# Bundled ONNX models (on-device face attendance)

| File | Purpose | Notes |
| :--- | :--- | :--- |
| `mobilefacenet_int8.onnx` | 512-d face embedding | Hailo MIT ArcFace MobileFaceNet (`mbf.onnx`), 112×112 |
| `silent_face_anti_spoof_int8.onnx` | Anti-spoof / liveness | MiniFASNetV2 ONNX (Silent-Face), 80×80, 3-class live/print/replay |

## Fetch

```bash
npm run models:fetch
```

Override URLs with `WMS_MOBILEFACENET_URL` / `WMS_ANTISPOOF_URL` if needed.

## Runtime

- Copied to `documentDirectory/models` on launch via `bootstrapFaceModels`
- Inference: `onnxruntime-react-native`
- `EXPO_PUBLIC_FACE_ML_MOCK=1` only in `__DEV__` for UI stubs — never in release

Rebuild the Dev Client / APK after changing models.
