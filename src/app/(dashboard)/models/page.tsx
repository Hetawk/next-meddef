"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Loader2 } from "lucide-react";

interface ModelRow {
  id: string;
  variant: string;
  stage: string;
  format: string;
  onnxPath: string | null;
  accuracy: number | null;
  datasetId: string | null;
  dataset: { name: string } | null;
  createdAt: string;
}

const VARIANT_COLOR: Record<string, string> = {
  FULL: "bg-indigo-50 text-indigo-700",
  NO_DEF: "bg-slate-100 text-slate-600",
  NO_FREQ: "bg-amber-50 text-amber-700",
  NO_PATCH: "bg-orange-50 text-orange-700",
  NO_CBAM: "bg-pink-50 text-pink-700",
  BASELINE: "bg-emerald-50 text-emerald-700",
};

const STAGE_LABEL: Record<string, string> = {
  STAGE1: "Stage 1",
  DISTILL: "Distill v1",
  DISTILL_V2: "Distill v2",
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setModels(j.data);
        else setError(j.error);
      })
      .catch(() => setError("Failed to load models"))
      .finally(() => setLoading(false));
  }, []);

  // Group by variant
  const grouped = models.reduce<Record<string, ModelRow[]>>((acc, m) => {
    (acc[m.variant] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Models</h1>
        <p className="mt-1 text-sm text-slate-500">
          All registered MedDef model variants and their staged exports
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading models…
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && models.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">
              No models registered yet. POST to{" "}
              <code className="text-xs rounded bg-slate-100 px-1.5 py-0.5">
                /api/models
              </code>{" "}
              or run the seed script to populate.
            </p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([variant, rows]) => (
        <Card key={variant}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${VARIANT_COLOR[variant] ?? "bg-slate-50 text-slate-600"}`}
              >
                <Cpu className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{variant}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <th className="pb-2 text-left">Stage</th>
                    <th className="pb-2 text-left">Format</th>
                    <th className="pb-2 text-left">Dataset</th>
                    <th className="pb-2 text-right">Accuracy</th>
                    <th className="pb-2 text-left pl-4">ONNX Path</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5">
                        <Badge variant="outline" className="text-xs">
                          {STAGE_LABEL[m.stage] ?? m.stage}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            m.format === "ONNX" ? "success" : "secondary"
                          }
                          className="text-xs"
                        >
                          {m.format}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {m.dataset?.name ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">
                        {m.accuracy != null ? (
                          `${(m.accuracy * 100).toFixed(2)}%`
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-4 font-mono text-xs text-slate-500 truncate max-w-xs">
                        {m.onnxPath ?? (
                          <span className="text-slate-300">not exported</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
