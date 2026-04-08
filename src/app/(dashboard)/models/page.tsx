"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  X,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

interface ModelRow {
  id: string;
  variant: string;
  stage: string;
  format: string;
  onnxPath: string | null;
  accuracy: number | null;
  datasetId: string | null;
  dataset: { name: string } | null;
}

// Static model matrix — always visible regardless of DB status
const VARIANTS: {
  key: string;
  label: string;
  description: string;
  color: string;
  iconColor: string;
  primary?: boolean;
}[] = [
  {
    key: "NO_DEF",
    label: "NO_DEF — Main Model",
    description:
      "Primary deployment model · full DAAM architecture (DISTILL_V2 final)",
    color: "bg-indigo-50 text-indigo-700",
    iconColor: "bg-indigo-600",
    primary: true,
  },
  {
    key: "FULL",
    label: "FULL (DAAM + Defense)",
    description: "Complete model with adversarial defense module enabled",
    color: "bg-violet-50 text-violet-700",
    iconColor: "bg-violet-600",
  },
  {
    key: "NO_FREQ",
    label: "NO_FREQ",
    description: "Ablation: no dual-frequency attention branch",
    color: "bg-amber-50 text-amber-700",
    iconColor: "bg-amber-500",
  },
  {
    key: "NO_PATCH",
    label: "NO_PATCH",
    description: "Ablation: no patch attention module",
    color: "bg-orange-50 text-orange-700",
    iconColor: "bg-orange-500",
  },
  {
    key: "NO_CBAM",
    label: "NO_CBAM",
    description: "Ablation: no CBAM channel attention",
    color: "bg-pink-50 text-pink-700",
    iconColor: "bg-pink-500",
  },
  {
    key: "BASELINE",
    label: "BASELINE (ResNet-18)",
    description: "Standard ResNet-18 without any attention or defense",
    color: "bg-emerald-50 text-emerald-700",
    iconColor: "bg-emerald-600",
  },
];

const STAGES = [
  {
    key: "STAGE1",
    label: "Stage 1",
    desc: "Full-parameter supervised training",
  },
  {
    key: "DISTILL_V2",
    label: "Distill v2 (Final)",
    desc: "Final model · enhanced distillation with adversarial fine-tuning",
  },
];

export default function ModelsPage() {
  const [dbModels, setDbModels] = useState<ModelRow[]>([]);
  const [dbError, setDbError] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Password gate state
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinChecking, setPinChecking] = useState(false);
  const [showPinText, setShowPinText] = useState(false);

  const handlePinSubmit = async () => {
    if (!pinValue) {
      setPinError("Enter the upload password.");
      return;
    }
    setPinChecking(true);
    setPinError(null);
    try {
      const res = await fetch("/api/auth/upload-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pinValue }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Incorrect password.");
      // Password OK — close pin prompt and open upload modal
      setShowPinPrompt(false);
      setPinValue("");
      resetUpload();
      setShowUpload(true);
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setPinChecking(false);
    }
  };

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadVariant, setUploadVariant] = useState("NO_DEF");
  const [uploadStage, setUploadStage] = useState("DISTILL_V2");
  const [uploadAccuracy, setUploadAccuracy] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetUpload = () => {
    setUploadVariant("NO_DEF");
    setUploadStage("DISTILL_V2");
    setUploadAccuracy("");
    setUploadFile(null);
    setUploadError(null);
    setUploadDone(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError("Select an ONNX file first.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadDone(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("variant", uploadVariant);
      fd.append("stage", uploadStage);
      if (uploadAccuracy) fd.append("accuracy", uploadAccuracy);
      const res = await fetch("/api/models/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Upload failed");
      setUploadDone(json.data.asset.download_url);
      // Refresh model list
      fetch("/api/models")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setDbModels(j.data);
        });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setDbModels(j.data);
        else setDbError(true);
      })
      .catch(() => setDbError(true))
      .finally(() => setDbLoaded(true));
  }, []);

  // Index DB rows by "variant|stage" for lookup
  const dbIndex = dbModels.reduce<Record<string, ModelRow>>((acc, m) => {
    acc[`${m.variant}|${m.stage}`] = m;
    return acc;
  }, {});

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Models</h1>
          <p className="mt-1 text-sm text-slate-500">
            MedDef model variants and their training stages (6 variants × 2
            stages)
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setPinValue("");
              setPinError(null);
              setShowPinPrompt(true);
            }}
          >
            <Upload className="h-3.5 w-3.5" /> Upload ONNX
          </Button>
          {dbLoaded && (
            <div
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
                dbError
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {dbError ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5" /> DB offline — static
                  view
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {dbModels.length}{" "}
                  models registered
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Model cards */}
      {VARIANTS.map((v) => (
        <Card key={v.key}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${v.iconColor} text-white shrink-0`}
              >
                <Cpu className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base">{v.label}</CardTitle>
                  {v.primary && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <th className="pb-2 text-left">Stage</th>
                    <th className="pb-2 text-left">Description</th>
                    <th className="pb-2 text-left">Status</th>
                    <th className="pb-2 text-right">Accuracy</th>
                    <th className="pb-2 text-left pl-4">ONNX Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {STAGES.map((s) => {
                    const row = dbIndex[`${v.key}|${s.key}`];
                    return (
                      <tr
                        key={s.key}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                          >
                            {s.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-xs text-slate-500 pr-4">
                          {s.desc}
                        </td>
                        <td className="py-2.5">
                          {row ? (
                            <Badge variant="success" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Registered
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-xs gap-1 text-slate-400"
                            >
                              <Clock className="h-3 w-3" /> Pending export
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {row?.accuracy != null ? (
                            <span
                              className={`font-semibold text-sm ${
                                row.accuracy >= 0.7
                                  ? "text-emerald-600"
                                  : row.accuracy >= 0.5
                                    ? "text-amber-600"
                                    : "text-red-500"
                              }`}
                            >
                              {(row.accuracy * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-4 font-mono text-xs text-slate-500 truncate max-w-[200px]">
                          {row?.onnxPath ? (
                            <a
                              href={row.onnxPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline not-italic font-sans font-medium"
                            >
                              Download{" "}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-300 not-italic font-sans">
                              not exported
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Password gate modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Coloured header band */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-7 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2.5">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">
                      Upload Password
                    </h2>
                    <p className="text-indigo-200 text-xs mt-0.5">
                      Authentication required
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPinPrompt(false)}
                  className="text-white/60 hover:text-white transition-colors rounded-lg p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="bg-gradient-to-b from-indigo-50 to-white px-8 py-7 space-y-5">
              <p className="text-sm text-indigo-800/70 leading-relaxed">
                Enter the upload password to gain access to the model file
                manager.
              </p>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-indigo-900">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPinText ? "text" : "password"}
                    autoFocus
                    placeholder="Enter password…"
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePinSubmit();
                    }}
                    className="w-full border-2 border-indigo-200 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-indigo-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinText((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-700 transition"
                    tabIndex={-1}
                  >
                    {showPinText ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {pinError && (
                <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                  onClick={() => setShowPinPrompt(false)}
                  disabled={pinChecking}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-300 gap-2 disabled:opacity-60"
                  onClick={handlePinSubmit}
                  disabled={pinChecking || !pinValue}
                >
                  {pinChecking ? (
                    "Verifying…"
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Unlock &amp; Continue
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header band */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-8 py-7 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2.5">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">
                      Upload ONNX Model
                    </h2>
                    <p className="text-indigo-200 text-xs mt-0.5">
                      Save model to EKD Digital Assets
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-white/60 hover:text-white transition-colors rounded-lg p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="bg-gradient-to-b from-indigo-50 to-white px-8 py-7 space-y-5">
              {/* Variant + Stage row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-indigo-900">
                    Variant
                  </label>
                  <select
                    value={uploadVariant}
                    onChange={(e) => setUploadVariant(e.target.value)}
                    className="w-full border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                  >
                    {VARIANTS.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.key}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-indigo-900">
                    Stage
                  </label>
                  <select
                    value={uploadStage}
                    onChange={(e) => setUploadStage(e.target.value)}
                    className="w-full border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm text-slate-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Accuracy */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-indigo-900">
                  Accuracy{" "}
                  <span className="text-indigo-400 font-normal text-xs">
                    (0 – 1, optional)
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.001"
                  placeholder="e.g. 0.923"
                  value={uploadAccuracy}
                  onChange={(e) => setUploadAccuracy(e.target.value)}
                  className="w-full border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-indigo-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                />
              </div>

              {/* File drop zone */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-indigo-900">
                  ONNX File
                </label>
                <label
                  className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer transition ${
                    uploadFile
                      ? "border-indigo-500 bg-indigo-100 text-indigo-700"
                      : "border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 text-indigo-400"
                  }`}
                >
                  <Upload
                    className={`h-7 w-7 ${uploadFile ? "text-indigo-600" : "text-indigo-300"}`}
                  />
                  <span className="text-sm font-semibold">
                    {uploadFile
                      ? uploadFile.name
                      : "Click to select .onnx file"}
                  </span>
                  {uploadFile && (
                    <span className="text-xs font-medium text-indigo-500">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".onnx"
                    className="sr-only"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {uploadError && (
                <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadDone && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">Upload successful!</p>
                    <a
                      href={uploadDone}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline font-medium flex items-center gap-1 mt-0.5"
                    >
                      Open download link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                  onClick={() => setShowUpload(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-300 gap-2 disabled:opacity-60"
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? (
                    "Uploading…"
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Upload Model
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
