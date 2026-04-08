import { z } from "zod";

// ─── Shared enums ────────────────────────────────────────────────────────────

export const AttackTypeSchema = z.enum([
  "CLEAN",
  "FGSM",
  "PGD",
  "BIM",
  "MIM",
  "CW",
  "DEEPFOOL",
  "APGD",
  "SQUARE",
]);
export type AttackType = z.infer<typeof AttackTypeSchema>;

export const ModelVariantSchema = z.enum([
  "FULL",
  "NO_DEF",
  "NO_FREQ",
  "NO_PATCH",
  "NO_CBAM",
  "BASELINE",
]);
export type ModelVariant = z.infer<typeof ModelVariantSchema>;

export const ModelStageSchema = z.enum(["STAGE1", "DISTILL_V2"]);
export type ModelStage = z.infer<typeof ModelStageSchema>;

// ─── API request schemas ─────────────────────────────────────────────────────

export const InferenceRequestSchema = z.object({
  modelId: z.string().cuid(),
  datasetId: z.string().cuid(),
  imageBase64: z.string().min(1, "Image data required"),
  imageName: z.string().min(1),
  attack: AttackTypeSchema.default("CLEAN"),
  epsilon: z.number().min(0).max(1).default(0.05),
});
export type InferenceRequest = z.infer<typeof InferenceRequestSchema>;

export const EvaluationRequestSchema = z.object({
  modelId: z.string().cuid(),
  datasetId: z.string().cuid(),
  attack: AttackTypeSchema,
  epsilon: z.number().min(0).max(1),
});
export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;

// ─── API response types ───────────────────────────────────────────────────────

export interface InferenceResult {
  id: string;
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  defenseHeld?: boolean;
  elapsedMs: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Dataset constants ───────────────────────────────────────────────────────

export const DATASETS = {
  tbcr: {
    name: "tbcr",
    displayName: "Tuberculosis Chest X-Ray",
    description: "Binary classification: Normal vs Tuberculosis chest X-rays",
    classes: ["Normal", "Tuberculosis"],
    onnxFile: "vista_no_def_tbcr.onnx",
    paper: "VISTA (MedDef2)",
    // Ultralytics DEFAULT_MEAN/STD: just ÷255, no mean subtraction
    normMean: [0.0, 0.0, 0.0] as [number, number, number],
    normStd: [1.0, 1.0, 1.0] as [number, number, number],
  },
  chest_xray: {
    name: "chest_xray",
    displayName: "Chest X-Ray (Pneumonia)",
    description: "Binary classification: Normal vs Pneumonia chest X-rays",
    classes: ["NORMAL", "PNEUMONIA"],
    onnxFile: "meddef1_chest_xray.onnx",
    paper: "MedDef1",
    // Dataset-specific normalization (grayscale X-ray statistics from training)
    normMean: [0.48230693, 0.48230693, 0.48230693] as [number, number, number],
    normStd: [0.22157896, 0.22157896, 0.22157896] as [number, number, number],
  },
  roct: {
    name: "roct",
    displayName: "Retinal OCT",
    description: "4-class retinal OCT classification: CNV, DME, Drusen, Normal",
    classes: ["CNV", "DME", "DRUSEN", "NORMAL"],
    onnxFile: "meddef1_roct.onnx",
    paper: "MedDef1",
    // Dataset-specific normalization (grayscale OCT statistics from training)
    normMean: [0.19338988, 0.19338988, 0.19338988] as [number, number, number],
    normStd: [0.1933612, 0.1933612, 0.1933612] as [number, number, number],
  },
} as const;

export type DatasetKey = keyof typeof DATASETS;

export const ATTACK_EPSILONS = [
  0.0, 0.005, 0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.3,
];
