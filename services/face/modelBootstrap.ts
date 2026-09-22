/**
 * Ensure documentDirectory/models exists. Push real ONNX files with adb/scrcopy
 * or ship via CI after scripts/fetch-models.mjs.
 */
import * as FileSystem from "expo-file-system/legacy";
import { modelsDir } from "@/services/face/onnxSessions";

export async function bootstrapFaceModels() {
  await FileSystem.makeDirectoryAsync(modelsDir(), { intermediates: true }).catch(() => {});
}
