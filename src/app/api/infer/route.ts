import { NextRequest, NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { resolveModelDir } from "@/lib/model-path";

// ── Zod schema — validates every field at the boundary ──────────────────────
const ALLOWED_MODELS = [
  "meddef1_chest_xray.onnx",
  "meddef1_roct.onnx",
  "vista_no_def_tbcr.onnx",
] as const;

const ATTACK_TYPES = [
  "CLEAN",
  "FGSM",
  "PGD",
  "BIM",
  "MIM",
  "CW",
  "DEEPFOOL",
  "APGD",
  "SQUARE",
] as const;

const EXPECTED_FLOATS = 3 * 224 * 224; // 150 528
const EXPECTED_BYTES = EXPECTED_FLOATS * 4; // 602 112

const InferRequestSchema = z.object({
  modelFile: z.enum(ALLOWED_MODELS),
  // Base64-encoded little-endian float32 array (≈800 KB vs ≈2.5 MB JSON).
  // Avoids nginx 413 Payload Too Large when sending 150k floats as JSON text.
  tensorB64: z.string().min(1, "tensorB64 is required"),
  attack: z.enum(ATTACK_TYPES).default("CLEAN"),
  epsilon: z.number().min(0).max(1).default(0),
});

// ── Session cache (reuse across requests in the same process) ────────────────
const sessionCache = new Map<string, ort.InferenceSession>();

async function getSession(modelPath: string): Promise<ort.InferenceSession> {
  if (!sessionCache.has(modelPath)) {
    sessionCache.set(modelPath, await ort.InferenceSession.create(modelPath));
  }
  return sessionCache.get(modelPath)!;
}

// ── Adversarial perturbation (gradient-free ℓ∞ approximation) ───────────────
// True gradient-based attacks (FGSM, PGD) require model gradients which ONNX
// Runtime does not expose. We approximate with deterministic random-sign noise
// bounded to ε in ℓ∞ norm — sufficient to demonstrate robustness differences.
// Multi-step attacks (PGD, APGD, BIM, MIM) iterate for stronger perturbations.
function perturbTensor(
  tensor: Float32Array,
  attack: string,
  epsilon: number,
): Float32Array {
  if (attack === "CLEAN" || epsilon <= 0) return new Float32Array(tensor);

  // Seed RNG from the tensor content so same image always gets same noise
  let rng = tensor.slice(0, 16).reduce((s, v, i) => s + v * (i + 1), 0);
  const nextRng = () => {
    rng = ((rng * 1664525 + 1013904223) & 0xffffffff) / 0xffffffff;
    return Math.abs(rng);
  };

  const steps =
    attack === "PGD" || attack === "APGD"
      ? 10
      : attack === "BIM" || attack === "MIM"
        ? 5
        : 1;

  const stepEps = epsilon / steps;
  const perturbed = new Float32Array(tensor);

  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < perturbed.length; i++) {
      const sign = nextRng() < 0.5 ? -1 : 1;
      perturbed[i] += stepEps * sign;
      // Clip to ImageNet-normalized range (≈ [-2.64, 2.75])
      perturbed[i] = Math.max(-3, Math.min(3, perturbed[i]));
    }
  }
  return perturbed;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1. Parse JSON
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  // 2. Validate with Zod (catches wrong types, wrong modelFile, wrong shape, etc.)
  const parsed = InferRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`,
    );
    return NextResponse.json(
      { error: "Validation failed", issues },
      { status: 422 },
    );
  }

  const { modelFile, tensorB64, attack, epsilon } = parsed.data;

  // 3a. Decode base64 → Buffer → Float32Array and validate byte length.
  let cleanFloat32: Float32Array;
  try {
    const buf = Buffer.from(tensorB64, "base64");
    if (buf.byteLength !== EXPECTED_BYTES) {
      return NextResponse.json(
        {
          error: `tensorB64 decoded to ${buf.byteLength} bytes; expected ${EXPECTED_BYTES} (${EXPECTED_FLOATS} float32 values)`,
        },
        { status: 422 },
      );
    }
    // Use the underlying ArrayBuffer — offset 0, correct byte length.
    cleanFloat32 = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      EXPECTED_FLOATS,
    );
  } catch {
    return NextResponse.json(
      { error: "tensorB64 is not valid base64" },
      { status: 422 },
    );
  }

  // 3b. Resolve model path via shared helper (MODEL_DIR env var → known VPS
  //    path → local dev public/models/onnx).
  const modelDir = resolveModelDir();
  const modelPath = path.join(modelDir, modelFile);
  if (!fs.existsSync(modelPath)) {
    return NextResponse.json(
      { error: `Model file not found on server: ${modelFile}` },
      { status: 404 },
    );
  }

  try {
    const session = await getSession(modelPath);
    const inputName = session.inputNames[0];
    const outputKey = session.outputNames[0];

    // 4. Clean inference
    const cleanTensor = new ort.Tensor(
      "float32",
      cleanFloat32,
      [1, 3, 224, 224],
    );
    const t0 = Date.now();
    const cleanOutputs = await session.run({ [inputName]: cleanTensor });
    const cleanElapsedMs = Date.now() - t0;
    const cleanLogits = Array.from(
      cleanOutputs[outputKey].data as Float32Array,
    );

    // 5. Attacked inference (only when attack !== CLEAN and ε > 0)
    let attackedLogits: number[] | null = null;
    let attackedElapsedMs: number | null = null;

    if (attack !== "CLEAN" && epsilon > 0) {
      const perturbedFloat32 = perturbTensor(cleanFloat32, attack, epsilon);
      const perturbedTensor = new ort.Tensor(
        "float32",
        perturbedFloat32,
        [1, 3, 224, 224],
      );
      const t1 = Date.now();
      const attackedOutputs = await session.run({
        [inputName]: perturbedTensor,
      });
      attackedElapsedMs = Date.now() - t1;
      attackedLogits = Array.from(
        attackedOutputs[outputKey].data as Float32Array,
      );
    }

    return NextResponse.json({
      cleanLogits,
      cleanElapsedMs,
      attackedLogits,
      attackedElapsedMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown inference error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
