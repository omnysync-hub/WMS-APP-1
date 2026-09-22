# Phase 2 face ML — manual QA checklist (real devices)

Pilot thresholds live in `services/face/thresholds.ts` — **do not lock** cosine/liveness numbers until this checklist produces a score log.

## Environment
- [ ] Custom Dev Client installed (Expo Go will not work)
- [ ] ONNX models present (`mobilefacenet_int8.onnx` 512-d, `silent_face_anti_spoof_int8.onnx`)
- [ ] ERP geofence zones active; employee face enrolled

## Lighting / appearance
- [ ] Normal office light — capture succeeds; log cosine + liveness
- [ ] Backlighting (window behind subject)
- [ ] Low light / evening office
- [ ] Subject wearing glasses
- [ ] Partial occlusion (mask off one ear / hand near cheek) — expect fail or low score

## Spoof / replay
- [ ] Printed color photo of enrollee — **must reject** on liveness
- [ ] Phone screen video/photo of enrollee — **must reject** on liveness
- [ ] Live enrollee — accept when inside geofence

## Match accuracy (5–10 employees)
- [ ] Each enrollee checks in successfully (≥3 times)
- [ ] Cross-employee attempt (A tries to match as B) — reject
- [ ] Export / copy `[face-pilot]` console logs; calibrate `cosineSimilarityMin` and `livenessMin`

## Active challenge (~15–20% of check-ins)
- [ ] Blink prompt appears sometimes; completes before capture
- [ ] Head-turn prompt appears sometimes; completes before capture

## Fallbacks
- [ ] After 2 failed matches → PIN override path; attendance flagged for HR
- [ ] Offline queue still shows **pending sync** (not false success)

## Geofence (unchanged phase 1)
- [ ] Far from office warning; server may flag
- [ ] Inside zone + live face → accepted
