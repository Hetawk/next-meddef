import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP } from "@/lib/config";
import { DATASETS } from "@/types/index";
import {
  FlaskConical,
  Database,
  Cpu,
  ShieldCheck,
  GraduationCap,
  User,
  Hash,
  Mail,
  Phone,
} from "lucide-react";

const stats = [
  {
    label: "Datasets",
    value: Object.keys(DATASETS).length.toString(),
    icon: Database,
    bg: "bg-blue-600",
    border: "border-blue-100",
  },
  {
    label: "Model Variants",
    value: "6",
    icon: Cpu,
    bg: "bg-violet-600",
    border: "border-violet-100",
  },
  {
    label: "Attack Types",
    value: "8",
    icon: FlaskConical,
    bg: "bg-amber-500",
    border: "border-amber-100",
  },
  {
    label: "Defense",
    value: "DAAM",
    icon: ShieldCheck,
    bg: "bg-emerald-600",
    border: "border-emerald-100",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 w-full">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 text-white shadow-lg">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-3 flex-1 min-w-0">
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs font-medium tracking-wide">
              Master&apos;s Thesis · 2026
            </Badge>
            <h1 className="text-3xl font-bold leading-snug tracking-tight">
              {APP.title}
            </h1>
            <p className="text-indigo-200 text-sm max-w-xl leading-relaxed">
              A dual-frequency attention mechanism (DAAM) for defending medical
              image classifiers against adversarial attacks across 3 datasets
              and 8 attack types.
            </p>
          </div>
          {/* Identity pill */}
          <div className="rounded-xl bg-white/10 border border-white/20 p-4 text-sm space-y-2.5 min-w-[200px]">
            <div className="flex items-center gap-2 text-indigo-100">
              <User className="h-4 w-4 shrink-0 text-indigo-300" />
              <div>
                <p className="font-semibold text-white">{APP.author}</p>
                <p className="text-indigo-300 text-base font-medium">
                  {APP.authorZh}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-indigo-200">
              <Hash className="h-4 w-4 shrink-0 text-indigo-300" />
              <span className="font-mono text-sm tracking-widest">
                {APP.studentId}
              </span>
            </div>
            <div className="flex items-start gap-2 text-indigo-200 border-t border-white/10 pt-2.5">
              <Mail className="h-4 w-4 shrink-0 text-indigo-300 mt-0.5" />
              <div className="space-y-0.5">
                <a
                  href={`mailto:${APP.emailStudent}`}
                  className="block text-indigo-100 hover:text-white text-xs truncate"
                >
                  {APP.emailStudent}
                </a>
                <a
                  href={`mailto:${APP.emailPersonal}`}
                  className="block text-indigo-100 hover:text-white text-xs truncate"
                >
                  {APP.emailPersonal}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 text-indigo-200">
              <Phone className="h-4 w-4 shrink-0 text-indigo-300" />
              <span className="text-indigo-100 text-xs">{APP.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-indigo-200 border-t border-white/10 pt-2.5">
              <GraduationCap className="h-4 w-4 shrink-0 text-indigo-300" />
              <div>
                <p className="text-xs text-indigo-400 uppercase tracking-wide">
                  Supervisor
                </p>
                <p className="font-medium text-white">{APP.supervisor}</p>
                <p className="text-indigo-300">{APP.supervisorZh}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, bg, border }) => (
          <Card key={label} className={`border ${border}`}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${bg} text-white shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Datasets summary ────────────────────────────────────────────── */}
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
    </div>
  );
}
