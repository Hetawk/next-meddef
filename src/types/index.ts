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

export const ModelStageSchema = z.enum(["STAGE1", "DISTILL", "DISTILL_V2"]);
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
  },
  ccts: {
    name: "ccts",
    displayName: "Chest CT Scan",
    description: "4-class lung cancer classification from CT scans",
    classes: [
      "adenocarcinoma",
      "large.cell.carcinoma",
      "normal",
      "squamous.cell.carcinoma",
    ],
  },
  multic: {
    name: "multic",
    displayName: "Multi-Cancer",
    description: "8-class multi-organ cancer classification",
    classes: [
      "all_leukemia",
      "brain_cancer",
      "breast_cancer",
      "cervical_cancer",
      "kidney_cancer",
      "lung_colon_cancer",
      "lymphoma",
      "oral_cancer",
    ],
  },
  scisic: {
    name: "scisic",
    displayName: "Skin Cancer (ISIC)",
    description: "9-class dermoscopy classification",
    classes: [
      "actinic keratosis",
      "basal cell carcinoma",
      "dermatofibroma",
      "melanoma",
      "nevus",
      "pigmented benign keratosis",
      "seborrheic keratosis",
      "squamous cell carcinoma",
      "vascular lesion",
    ],
  },
} as const;

export type DatasetKey = keyof typeof DATASETS;

export const ATTACK_EPSILONS = [
  0.0, 0.005, 0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.3,
];
