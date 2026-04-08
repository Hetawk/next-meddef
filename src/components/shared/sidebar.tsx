"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Database,
  BarChart3,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP } from "@/lib/config";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/inference", label: "Inference", icon: FlaskConical },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/results", label: "Results", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 flex-col bg-slate-900 px-4 py-6 shrink-0">
      <div className="mb-8 px-1">
        <span className="text-lg font-bold text-white tracking-tight">
          {APP.name}
        </span>
        <p className="mt-1 text-sm font-medium text-slate-200 leading-tight">
          {APP.author}
        </p>
        <p className="text-indigo-400 font-medium">{APP.authorZh}</p>
        <p className="mt-0.5 text-xs font-mono text-slate-500 tracking-widest">{APP.studentId}</p>
      </div>
      <nav className="flex flex-col gap-0.5">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-slate-700 text-xs text-slate-500 leading-relaxed">
        <p className="text-slate-400">Supervisor</p>
        <p className="font-medium text-slate-300">{APP.supervisor}</p>
        <p className="text-slate-500">{APP.supervisorZh}</p>
      </div>
    </aside>
  );
}
