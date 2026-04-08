"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, AlertCircle, CheckCircle2, Clock } from "lucide-react";

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
                <AlertCircle className="h-3.5 w-3.5" /> DB offline — static view
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
                          {row?.onnxPath ?? (
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
    </div>
  );
}
