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
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white px-4 py-6 shrink-0">
      <div className="mb-8">
        <span className="text-lg font-bold text-slate-900">{APP.name}</span>
        <p className="mt-0.5 text-xs text-slate-400 leading-tight">
          {APP.author}
        </p>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-slate-100 text-slate-900 font-medium"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 text-xs text-slate-400 leading-relaxed">
        <p>Supervisor: {APP.supervisor}</p>
        <p className="text-slate-300">({APP.supervisorZh})</p>
      </div>
    </aside>
  );
}
