"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DATASETS, ATTACK_EPSILONS, type AttackType } from "@/types/index";
import { Loader2 } from "lucide-react";

interface EvalRow {
  id: string;
  attack: AttackType;
  epsilon: number;
  accuracy: number;
  robustAccuracy: number | null;
  model: { variant: string; stage: string };
  dataset: { name: string };
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

export default function ResultsPage() {
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState("tbcr");
  const [attack, setAttack] = useState<AttackType>("FGSM");

  const fetchEvals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ attack });
      const res = await fetch(`/api/evaluations?${params}`);
      const json = await res.json();
      if (json.success) {
        setEvals(json.data.filter((e: EvalRow) => e.dataset.name === dataset));
      }
    } finally {
      setLoading(false);
    }
  }, [dataset, attack]);

  useEffect(() => {
    fetchEvals();
  }, [fetchEvals]);

  // Group by model variant+stage for the accuracy-vs-epsilon table
  type GroupKey = string;
  const grouped: Record<GroupKey, Record<string, EvalRow>> = {};
  for (const e of evals) {
    const key = `${e.model.variant} (${e.model.stage})`;
    (grouped[key] ??= {})[e.epsilon.toString()] = e;
  }

  const epsilons = ATTACK_EPSILONS.filter((v) =>
    attack === "CLEAN" ? v === 0 : v >= 0,
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Evaluation Results
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Model accuracy under adversarial attacks across datasets and epsilon
          values
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
            Dataset
          </label>
          <Select value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {Object.values(DATASETS).map((d) => (
              <option key={d.name} value={d.name}>
                {d.displayName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
            Attack
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
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && evals.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-400">
              No evaluation data yet. POST to{" "}
              <code className="text-xs rounded bg-slate-100 px-1.5 py-0.5">
                /api/evaluations
              </code>{" "}
              to populate results.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && evals.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {attack} — Accuracy vs Epsilon
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {DATASETS[dataset as keyof typeof DATASETS]?.displayName ??
                  dataset}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <th className="pb-2 text-left pr-4">Model</th>
                    {epsilons.map((eps) => (
                      <th
                        key={eps}
                        className="pb-2 text-right px-2 tabular-nums"
                      >
                        ε={eps}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Object.entries(grouped).map(([modelKey, byEps]) => (
                    <tr
                      key={modelKey}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-medium text-slate-800 whitespace-nowrap">
                        {modelKey}
                      </td>
                      {epsilons.map((eps) => {
                        const row = byEps[eps.toString()];
                        const acc = row?.robustAccuracy ?? row?.accuracy;
                        return (
                          <td
                            key={eps}
                            className="py-2.5 px-2 text-right tabular-nums"
                          >
                            {acc != null ? (
                              <span
                                className={
                                  acc >= 0.7
                                    ? "text-emerald-600 font-semibold"
                                    : acc >= 0.5
                                    ? "text-amber-600 font-medium"
                                    : "text-red-500 font-medium"
                                }
                              >
                                {(acc * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{" "}
                ≥ 70%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{" "}
                50–70%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{" "}
                &lt; 50%
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
