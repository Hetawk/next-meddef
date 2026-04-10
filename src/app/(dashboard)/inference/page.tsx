"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DATASETS, ATTACK_EPSILONS, type AttackType } from "@/types/index";
import { formatConfidence } from "@/lib/utils";
import {
  Upload,
  Play,
  Loader2,
  AlertCircle,
  FlaskConical,
  CheckCircle2,
  Images,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import { z } from "zod";

// ── Static model registry ────────────────────────────────────────────────────
const MODEL_REGISTRY = [
  {
    id: "meddef1_roct",
    label: "MedDef1 FULL",
    paper: "MedDef1",
    dataset: "roct" as keyof typeof DATASETS,
    onnxFile: "meddef1_roct.onnx",
    disabled: false,
  },
  {
    id: "meddef1_chest_xray",
    label: "MedDef1 FULL",
    paper: "MedDef1",
    dataset: "chest_xray" as keyof typeof DATASETS,
    onnxFile: "meddef1_chest_xray.onnx",
    disabled: false,
  },
  {
    id: "vista_no_def_tbcr",
    label: "VISTA NO_DEF — Distill v2",
    paper: "VISTA (MedDef2)",
    dataset: "tbcr" as keyof typeof DATASETS,
    onnxFile: "vista_no_def_tbcr.onnx",
    disabled: false,
  },
];

// ── Sample images per dataset ────────────────────────────────────────────────
const SAMPLE_IMAGES: Record<
  keyof typeof DATASETS,
  { src: string; label: string }[]
> = {
  tbcr: [
    { src: "/datasets/samples/tbcr/Normal-2253.png", label: "Normal" },
    { src: "/datasets/samples/tbcr/Normal-961.png", label: "Normal" },
    {
      src: "/datasets/samples/tbcr/Tuberculosis-351.png",
      label: "Tuberculosis",
    },
    {
      src: "/datasets/samples/tbcr/Tuberculosis-263.png",
      label: "Tuberculosis",
    },
  ],
  chest_xray: [
    {
      src: "/datasets/samples/chest_xray/NORMAL-IM-0001.jpeg",
      label: "Normal",
    },
    {
      src: "/datasets/samples/chest_xray/NORMAL-IM-0003.jpeg",
      label: "Normal",
    },
    {
      src: "/datasets/samples/chest_xray/PNEUMONIA-person82_virus_155.jpeg",
      label: "Pneumonia",
    },
    {
      src: "/datasets/samples/chest_xray/PNEUMONIA-person71_virus_131.jpeg",
      label: "Pneumonia",
    },
  ],
  roct: [
    { src: "/datasets/samples/roct/CNV-1016042-1.jpeg", label: "CNV" },
    { src: "/datasets/samples/roct/DME-2105194-1.jpeg", label: "DME" },
    { src: "/datasets/samples/roct/DRUSEN-1083159-1.jpeg", label: "Drusen" },
    { src: "/datasets/samples/roct/NORMAL-443980-1.jpeg", label: "Normal" },
  ],
};

const ATTACK_TYPES: AttackType[] = [
  "CLEAN",
  "FGSM",
  "PGD",
  "BIM",
  "MIM",
  "CW",
  "DEEPFOOL",
  "APGD",
  "SQUARE",
];

interface ClassResult {
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  elapsedMs: number;
}

interface InferenceResult {
  clean: ClassResult;
  attacked: ClassResult | null; // null when attack === CLEAN
  isRobust: boolean | null; // null when attack === CLEAN
  confidenceDelta: number | null;
}

// ── Image preprocessing (runs in browser via Canvas API) ────────────────────
async function preprocessImage(
  file: File,
  mean: [number, number, number],
  std: [number, number, number],
): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 224, 224);
      const pixels = ctx.getImageData(0, 0, 224, 224).data;
      const tensor = new Float32Array(3 * 224 * 224);
      for (let i = 0; i < 224 * 224; i++) {
        for (let c = 0; c < 3; c++) {
          tensor[c * 224 * 224 + i] =
            (pixels[i * 4 + c] / 255 - mean[c]) / std[c];
        }
      }
      URL.revokeObjectURL(url);
      resolve(tensor);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// ── Zod schema for API response validation ───────────────────────────────────
const ApiResponseSchema = z.object({
  cleanLogits: z.array(z.number()).min(1),
  cleanElapsedMs: z.number(),
  attackedLogits: z.array(z.number()).nullable(),
  attackedElapsedMs: z.number().nullable(),
});

// ── ResultColumn sub-component ───────────────────────────────────────────────
type AccentColor = "indigo" | "emerald" | "red";

function ResultColumn({
  label,
  res,
  classes,
  accentColor,
  highlightMismatch = false,
  groundTruth = null,
}: {
  label: string;
  res: ClassResult;
  classes: readonly string[];
  accentColor: AccentColor;
  highlightMismatch?: boolean;
  groundTruth?: string | null;
}) {
  const isCorrect =
    groundTruth !== null
      ? res.prediction.toLowerCase() === groundTruth.toLowerCase()
      : null;

  const barColor =
    accentColor === "emerald"
      ? "bg-emerald-500"
      : accentColor === "red"
        ? "bg-red-400"
        : "bg-indigo-500";
  const topTextColor =
    accentColor === "emerald"
      ? "text-emerald-600"
      : accentColor === "red"
        ? "text-red-500"
        : "text-indigo-600";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <span className="text-[10px] text-slate-400">
          {res.elapsedMs.toFixed(0)} ms
        </span>
      </div>

      <div
        className={`rounded-lg border px-3 py-2 ${
          highlightMismatch
            ? "border-red-200 bg-red-50"
            : isCorrect === false
              ? "border-amber-200 bg-amber-50"
              : "border-slate-100 bg-slate-50"
        }`}
      >
        <p className="text-[10px] uppercase tracking-wide text-slate-400">
          Prediction
        </p>
        <p
          className={`mt-0.5 text-base font-bold ${
            highlightMismatch
              ? "text-red-700"
              : isCorrect === false
                ? "text-amber-700"
                : "text-slate-900"
          }`}
        >
          {res.prediction}
        </p>
        <p className={`text-sm font-semibold ${topTextColor}`}>
          {formatConfidence(res.confidence)}
        </p>
        {isCorrect !== null && (
          <p
            className={`mt-1 text-[11px] font-medium ${
              isCorrect ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {isCorrect ? "\u2713 Correct" : `\u2717 Should be: ${groundTruth}`}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {classes.map((cls) => {
          const prob = res.probabilities[cls] ?? 0;
          const isTop = cls === res.prediction;
          return (
            <div key={cls} className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span
                  className={
                    isTop ? "font-semibold text-slate-900" : "text-slate-500"
                  }
                >
                  {cls}
                </span>
                <span
                  className={
                    isTop ? topTextColor + " font-semibold" : "text-slate-400"
                  }
                >
                  {formatConfidence(prob)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isTop ? barColor : "bg-slate-200"
                  }`}
                  style={{ width: `${(prob * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function InferencePage() {
  const [selectedModelId, setSelectedModelId] = useState(
    MODEL_REGISTRY.find((m) => !m.disabled)!.id,
  );
  const [attack, setAttack] = useState<AttackType>("CLEAN");
  const [epsilon, setEpsilon] = useState(0.05);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedSampleSrc, setSelectedSampleSrc] = useState<string | null>(
    null,
  );
  const [groundTruth, setGroundTruth] = useState<string | null>(null);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = MODEL_REGISTRY.find((m) => m.id === selectedModelId)!;
  const dataset = DATASETS[selectedModel.dataset];
  const classes = dataset.classes as readonly string[];
  const samples = SAMPLE_IMAGES[selectedModel.dataset];

  const loadFile = useCallback(
    (
      file: File,
      preview: string,
      sampleSrc: string | null = null,
      gt: string | null = null,
    ) => {
      setImageFile(file);
      setImagePreview(preview);
      setSelectedSampleSrc(sampleSrc);
      setGroundTruth(gt);
      setResult(null);
      setError(null);
    },
    [],
  );

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadFile(file, ev.target?.result as string, null);
      reader.readAsDataURL(file);
    },
    [loadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) =>
          loadFile(file, ev.target?.result as string, null);
        reader.readAsDataURL(file);
      }
    },
    [loadFile],
  );

  const handleSampleSelect = useCallback(
    async (src: string, label: string) => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const filename = src.split("/").pop() ?? "sample.jpg";
        const file = new File([blob], filename, {
          type: blob.type || "image/jpeg",
        });
        loadFile(file, src, src, label);
      } catch {
        setError("Failed to load sample image");
      }
    },
    [loadFile],
  );

  const handleModelChange = (id: string) => {
    setSelectedModelId(id);
    setImageFile(null);
    setImagePreview(null);
    setSelectedSampleSrc(null);
    setGroundTruth(null);
    setResult(null);
    setError(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setSelectedSampleSrc(null);
    setGroundTruth(null);
    setResult(null);
    setError(null);
  };

  const runInference = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setLoadingStep("Preprocessing image\u2026");
      const tensor = await preprocessImage(
        imageFile,
        [...dataset.normMean] as [number, number, number],
        [...dataset.normStd] as [number, number, number],
      );

      setLoadingStep(
        attack === "CLEAN"
          ? "Running inference\u2026"
          : `Running clean + ${attack} attack\u2026`,
      );
      // Encode Float32Array as base64 binary (~800 KB) instead of a JSON
      // number array (~2.5 MB) to stay under nginx's 1 MB body limit.
      const tensorB64 = btoa(
        String.fromCharCode(...new Uint8Array(tensor.buffer)),
      );

      const res = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelFile: selectedModel.onnxFile,
          tensorB64,
          attack,
          epsilon,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.issues
          ? `Validation: ${(body.issues as string[]).join("; ")}`
          : (body?.error ?? `Server error ${res.status}`);
        throw new Error(msg);
      }

      const rawJson = await res.json();
      const parsed = ApiResponseSchema.safeParse(rawJson);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        throw new Error(`Unexpected API response: ${issues}`);
      }

      const { cleanLogits, cleanElapsedMs, attackedLogits, attackedElapsedMs } =
        parsed.data;

      const toResult = (logits: number[], ms: number): ClassResult => {
        const probs = softmax(logits);
        const predIdx = probs.indexOf(Math.max(...probs));
        const probMap: Record<string, number> = {};
        classes.forEach((cls, i) => {
          probMap[cls] = probs[i] ?? 0;
        });
        return {
          prediction: classes[predIdx] ?? `class_${predIdx}`,
          confidence: probs[predIdx],
          probabilities: probMap,
          elapsedMs: ms,
        };
      };

      const clean = toResult(cleanLogits, cleanElapsedMs);
      const attacked =
        attackedLogits && attackedElapsedMs != null
          ? toResult(attackedLogits, attackedElapsedMs)
          : null;

      const isRobust = attacked
        ? attacked.prediction === clean.prediction
        : null;
      const confidenceDelta = attacked
        ? attacked.confidence - clean.confidence
        : null;

      setResult({ clean, attacked, isRobust, confidenceDelta });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inference failed");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Model Inference</h1>
          <p className="mt-1 text-sm text-slate-500">
            Select a sample image or upload your own, then run on-device ONNX
            inference (CPU).
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm font-semibold text-slate-700 leading-snug">
            MedDef: An Attention Based Model For Adversarial Resilience in
            Medical Imaging
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Enoch Kwateh Dongbo &nbsp;·&nbsp; Student ID: 202324100003
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Config panel ── */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Model
              </label>
              <Select
                value={selectedModelId}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {MODEL_REGISTRY.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.disabled}>
                    [{m.paper}] {m.label} &mdash;{" "}
                    {DATASETS[m.dataset].displayName}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-400">
                Dataset:{" "}
                <span className="font-medium text-slate-600">
                  {dataset.displayName}
                </span>
                {" \u00b7 "}
                {classes.length} classes
              </p>
            </div>

            {/* Attack */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Attack Type
              </label>
              <Select
                value={attack}
                onChange={(e) => setAttack(e.target.value as AttackType)}
              >
                {ATTACK_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>

            {/* Epsilon */}
            {attack !== "CLEAN" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Epsilon:{" "}
                  <span className="font-normal text-slate-500">{epsilon}</span>
                </label>
                <Select
                  value={epsilon.toString()}
                  onChange={(e) => setEpsilon(Number(e.target.value))}
                >
                  {ATTACK_EPSILONS.filter((v) => v > 0).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Image preview or upload zone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Image
                </label>
                {imageFile && (
                  <button
                    onClick={clearImage}
                    className="text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {imagePreview ? (
                <div className="relative overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Selected image"
                    className="h-44 w-full object-contain p-2"
                  />
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                      {imageFile?.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/30 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-1 py-3 text-indigo-400">
                    <Upload className="h-5 w-5" />
                    <p className="text-xs font-medium text-indigo-500">
                      Drop image or click to browse
                    </p>
                    <p className="text-xs text-slate-400">
                      Or pick a sample below
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={runInference}
              disabled={!imageFile || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loadingStep || "Running\u2026"}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Inference
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Results panel ── */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Inference error</p>
                  <p className="mt-0.5 text-xs">{error}</p>
                </div>
              </div>
            )}

            {!result && !error && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
                <FlaskConical className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">
                  {imageFile
                    ? "Ready \u2014 click Run Inference"
                    : "Select a sample or upload an image to begin"}
                </p>
              </div>
            )}

            {result &&
              (() => {
                const cleanCorrect =
                  groundTruth !== null
                    ? result.clean.prediction.toLowerCase() ===
                      groundTruth.toLowerCase()
                    : null;
                const baselineError = cleanCorrect === false;

                return (
                  <div className="space-y-4">
                    {/* ── Baseline misclassification warning ── */}
                    {baselineError && (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-amber-800">
                            Misclassified &mdash; ground truth is &ldquo;
                            {groundTruth}&rdquo;
                          </p>
                          <p className="mt-0.5 text-xs text-amber-700">
                            {result.attacked
                              ? result.isRobust
                                ? `Prediction unchanged under ${attack} (still wrong). The attack had no effect on this incorrect output.`
                                : `Prediction flipped under ${attack}, but the clean baseline was already wrong.`
                              : "The model classified this image incorrectly without any attack applied."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Robustness verdict (only when attack applied & baseline was correct) ── */}
                    {result.attacked &&
                      result.isRobust !== null &&
                      !baselineError && (
                        <div
                          className={`flex items-center gap-3 rounded-lg border p-3 ${
                            result.isRobust
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-red-200 bg-red-50"
                          }`}
                        >
                          {result.isRobust ? (
                            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
                          ) : (
                            <ShieldAlert className="h-6 w-6 shrink-0 text-red-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${
                                result.isRobust
                                  ? "text-emerald-800"
                                  : "text-red-800"
                              }`}
                            >
                              {result.isRobust
                                ? "Model is ROBUST under this attack"
                                : "Model is VULNERABLE \u2014 prediction flipped"}
                            </p>
                            {result.confidenceDelta !== null && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Confidence change:{" "}
                                <span
                                  className={
                                    result.confidenceDelta < -0.05
                                      ? "font-medium text-red-600"
                                      : result.confidenceDelta < 0
                                        ? "font-medium text-amber-600"
                                        : "font-medium text-emerald-600"
                                  }
                                >
                                  {result.confidenceDelta >= 0 ? "+" : ""}
                                  {(result.confidenceDelta * 100).toFixed(1)}%
                                </span>
                                {" \u00b7 "}
                                Attack: {attack} (\u03b5={epsilon})
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    {/* ── Side-by-side columns ── */}
                    <div
                      className={`grid gap-4 ${
                        result.attacked ? "grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {/* Clean */}
                      <ResultColumn
                        label="Clean"
                        res={result.clean}
                        classes={classes}
                        accentColor="indigo"
                        groundTruth={groundTruth}
                      />
                      {/* Attacked */}
                      {result.attacked && (
                        <ResultColumn
                          label={`${attack} (\u03b5=${epsilon})`}
                          res={result.attacked}
                          classes={classes}
                          accentColor={result.isRobust ? "emerald" : "red"}
                          highlightMismatch={
                            result.attacked.prediction !==
                            result.clean.prediction
                          }
                          groundTruth={groundTruth}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}
          </CardContent>
        </Card>
      </div>

      {/* ── Sample image gallery ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Images className="h-4 w-4 text-indigo-500" />
              Sample Test Images
            </CardTitle>
            <span className="text-xs text-slate-400">
              {dataset.displayName}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Click any thumbnail to select it &mdash; images switch automatically
            when you change the model
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {samples.map((sample) => {
              const isActive = selectedSampleSrc === sample.src;
              return (
                <button
                  key={sample.src}
                  onClick={() => handleSampleSelect(sample.src, sample.label)}
                  title={`Select: ${sample.label}`}
                  className={`group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                    isActive
                      ? "border-indigo-500 shadow-md shadow-indigo-100"
                      : "border-transparent hover:border-indigo-300 hover:shadow-sm"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sample.src}
                    alt={sample.label}
                    className="aspect-square w-full object-cover"
                  />
                  <div
                    className={`px-1 py-0.5 text-center text-[10px] font-medium leading-tight transition-colors ${
                      isActive
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700"
                    }`}
                  >
                    {sample.label}
                  </div>
                  {isActive && (
                    <div className="absolute right-1 top-1 rounded-full bg-indigo-500 p-0.5">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Upload tile */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload your own image"
              className="group relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
            >
              <Upload className="h-5 w-5 text-slate-300 transition-colors group-hover:text-indigo-400" />
              <span className="px-1 text-center text-[10px] leading-tight text-slate-400 group-hover:text-indigo-500">
                Upload own
              </span>
            </button>
          </div>

          {/* Classes row */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            <span className="mr-1 text-xs text-slate-400">Classes:</span>
            {classes.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs">
                {c}
              </Badge>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {dataset.description}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
