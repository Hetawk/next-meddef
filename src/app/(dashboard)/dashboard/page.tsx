import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP } from "@/lib/config";
import { DATASETS } from "@/types/index";
import { FlaskConical, Database, Cpu, ShieldCheck } from "lucide-react";

const stats = [
  {
    label: "Datasets",
    value: Object.keys(DATASETS).length.toString(),
    icon: Database,
    color: "bg-blue-50 text-blue-600",
  },
  {
    label: "Model Variants",
    value: "6",
    icon: Cpu,
    color: "bg-violet-50 text-violet-600",
  },
  {
    label: "Attack Types",
    value: "8",
    icon: FlaskConical,
    color: "bg-amber-50 text-amber-600",
  },
  {
    label: "Defense",
    value: "DAAM",
    icon: ShieldCheck,
    color: "bg-green-50 text-green-600",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{APP.name}</h1>
        <p className="mt-1 text-sm text-slate-500 max-w-2xl">{APP.title}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Datasets summary */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Datasets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {Object.values(DATASETS).map((d) => (
              <div
                key={d.name}
                className="flex items-start justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {d.displayName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {d.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 max-w-xs justify-end">
                  {d.classes.slice(0, 4).map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                  {d.classes.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{d.classes.length - 4}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Author info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>
              <span className="font-medium text-slate-700">Author:</span>{" "}
              {APP.author} ({APP.authorZh})
            </span>
            <span>
              <span className="font-medium text-slate-700">Supervisor:</span>{" "}
              {APP.supervisor} ({APP.supervisorZh})
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
