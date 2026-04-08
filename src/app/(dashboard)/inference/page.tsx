"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DATASETS, ATTACK_EPSILONS, type AttackType } from "@/types/index";
import { APP } from "@/lib/config";
import { formatConfidence } from "@/lib/utils";
import { Upload, Play, Loader2, AlertCircle } from "lucide-react";

interface ModelOption {
  id: string;
  name: string;
  variant: string;
  stage: string;
  onnxPath: string | null;
}

interface InferenceResult {
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  elapsedMs: number;
}

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

export default function InferencePage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedDataset, setSelectedDataset] =
    useState<keyof typeof DATASETS>("tbcr");
  const [attack, setAttack] = useState<AttackType>("CLEAN");
  const [epsilon, setEpsilon] = useState(0.05);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return;
    try {
      const res = await fetch("/api/models");
      const json = await res.json();
      if (json.success) {
        setModels(json.data.filter((m: ModelOption) => m.onnxPath));
        if (json.data.length) setSelectedModel(json.data[0].id);
      }
    } catch {
      setError("Failed to load models");
    } finally {
      setModelsLoaded(true);
    }
  }, [modelsLoaded]);

  // Lazy-load on first render
  useState(() => {
    loadModels();
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      setResult(null);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runInference = async () => {
    if (!imageFile || !selectedModel) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (ev) =>
          resolve((ev.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const res = await fetch("/api/inferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModel,
          datasetId: selectedDataset,
          imageBase64,
          imageName: imageFile.name,
          attack,
          epsilon: attack === "CLEAN" ? 0 : epsilon,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Inference failed");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const datasets = Object.values(DATASETS);
  const datasetClasses = DATASETS[selectedDataset].classes as readonly string[];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Model Inference</h1>
        <p className="mt-1 text-sm text-slate-500">
          Run ONNX model inference with optional adversarial attacks
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Config panel */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Model
              </label>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!modelsLoaded}
              >
                {!modelsLoaded && <option>Loading…</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.variant} — {m.stage}
                  </option>
                ))}
                {modelsLoaded && models.length === 0 && (
                  <option disabled>
                    No ONNX models found — seed the DB first
                  </option>
                )}
              </Select>
            </div>

            {/* Dataset selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Dataset
              </label>
              <Select
                value={selectedDataset}
                onChange={(e) =>
                  setSelectedDataset(e.target.value as keyof typeof DATASETS)
                }
              >
                {datasets.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.displayName}
                  </option>
                ))}
              </Select>
            </div>

            {/* Attack type */}
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

            {/* Epsilon (hidden for CLEAN) */}
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

            {/* Image upload */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Image
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="relative flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Selected"
                    className="h-full w-full rounded-lg object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-500">
                    <Upload className="h-6 w-6" />
                    <p className="text-xs">Drop image or click to browse</p>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={runInference}
              disabled={!imageFile || !selectedModel || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running…
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

        {/* Results panel */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!result && !error && (
              <p className="text-sm text-slate-400">
                Results will appear here after inference.
              </p>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                      Prediction
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {result.prediction}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                      Confidence
                    </p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {formatConfidence(result.confidence)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Elapsed: {result.elapsedMs.toFixed(1)} ms
                </p>

                {/* Probability bars */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                    Class Probabilities
                  </p>
                  {datasetClasses.map((cls) => {
                    const prob = result.probabilities[cls] ?? 0;
                    return (
                      <div key={cls} className="space-y-0.5">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{cls}</span>
                          <span>{formatConfidence(prob)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${(prob * 100).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Badge
                  variant={result.confidence > 0.7 ? "success" : "warning"}
                >
                  {result.confidence > 0.7
                    ? "High confidence"
                    : "Low confidence"}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dataset classes info */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            {DATASETS[selectedDataset].displayName} — Classes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {datasetClasses.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {DATASETS[selectedDataset].description}
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Models dir:{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5">
          {APP.modelsDir}
        </code>
      </p>
    </div>
  );
}
