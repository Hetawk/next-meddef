"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  detectPlatform,
  isManifestPlatform,
  PLATFORM_LABELS,
  type PlatformId,
} from "@/lib/detect-platform";
import {
  formatBytes,
  isPlatformDownloadable,
  type DownloadsManifest,
  type PlatformArtifact,
  type PlatformStatus,
} from "@/lib/downloads-manifest";
import { cn } from "@/lib/utils";

const PRIMARY_PLATFORMS: Exclude<PlatformId, "unknown" | "linux">[] = [
  "android",
  "ios",
  "macos",
  "windows",
];

const LINUX_PLATFORM: Exclude<PlatformId, "unknown"> = "linux";

const PLATFORM_ICONS = {
  android: Smartphone,
  ios: Tablet,
  macos: Laptop,
  windows: Monitor,
  linux: Terminal,
} as const;

type Props = {
  manifest: DownloadsManifest;
  serverDetected: PlatformId;
};

function statusBadgeVariant(
  status: PlatformStatus,
): "success" | "warning" | "secondary" | "outline" {
  switch (status) {
    case "available":
      return "success";
    case "external":
      return "secondary";
    case "coming_soon":
      return "warning";
    default:
      return "outline";
  }
}

function statusLabel(status: PlatformStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "external":
      return "External link";
    case "coming_soon":
      return "Coming soon";
    default:
      return "Unavailable";
  }
}

function resolveHref(artifact: PlatformArtifact): string | null {
  if (!isPlatformDownloadable(artifact)) return null;
  if (artifact.status === "available" && artifact.url) return artifact.url;
  if (artifact.status === "external" && artifact.externalUrl) {
    return artifact.externalUrl;
  }
  return null;
}

function buildCtaLabel(
  platformId: Exclude<PlatformId, "unknown">,
  artifact: PlatformArtifact,
  opts: {
    detected: PlatformId;
    isViewingDetected: boolean;
    unknownDevice: boolean;
  },
): string {
  if (opts.unknownDevice) return "Choose your platform";

  const viewing = opts.isViewingDetected ? opts.detected : platformId;
  const label = PLATFORM_LABELS[viewing];

  if (artifact.status === "coming_soon") {
    if (viewing === "linux" && opts.isViewingDetected && opts.detected === "linux") {
      return "Coming soon for Linux";
    }
    return `${label} — coming soon`;
  }

  if (artifact.status === "unavailable") {
    return `${label} — not available`;
  }

  if (artifact.status === "external") {
    return `Get MedDef for ${label}`;
  }

  return `Download for ${label}`;
}

function shouldOfferDetectedShortcut(
  detected: PlatformId,
  manifest: DownloadsManifest,
): detected is Exclude<PlatformId, "unknown" | "linux"> {
  if (detected === "unknown" || detected === "linux") return false;
  const artifact = platformInManifest(manifest, detected);
  return Boolean(artifact);
}

function platformInManifest(
  manifest: DownloadsManifest,
  id: Exclude<PlatformId, "unknown">,
): PlatformArtifact | undefined {
  if (id === "linux") return manifest.platforms.linux;
  return manifest.platforms[id];
}

function refineIPadFromClient(ua: string): boolean {
  if (/\bipad\b/i.test(ua)) return true;
  if (!/\bmacintosh\b/i.test(ua)) return false;
  return navigator.maxTouchPoints > 1;
}

export function DownloadsHub({ manifest, serverDetected }: Props) {
  const initialTab = useMemo(() => {
    if (
      isManifestPlatform(serverDetected) &&
      platformInManifest(manifest, serverDetected)
    ) {
      return serverDetected;
    }
    return "android";
  }, [manifest, serverDetected]);

  const [selected, setSelected] =
    useState<Exclude<PlatformId, "unknown">>(initialTab);
  const [detected, setDetected] = useState<PlatformId>(serverDetected);
  const [clientRefined, setClientRefined] = useState(false);

  useEffect(() => {
    let ua = navigator.userAgent;
    if (refineIPadFromClient(ua) && !/\bipad\b/i.test(ua)) {
      ua = `${ua} iPad`;
    }
    const refined = detectPlatform(ua, navigator.platform);
    setDetected(refined);
    if (isManifestPlatform(refined) && platformInManifest(manifest, refined)) {
      setSelected(refined);
    }
    setClientRefined(true);
  }, [manifest]);

  const primaryTabs = useMemo(
    () => PRIMARY_PLATFORMS.filter((id) => platformInManifest(manifest, id)),
    [manifest],
  );
  const showLinuxTab = Boolean(platformInManifest(manifest, LINUX_PLATFORM));

  const active = platformInManifest(manifest, selected)!;
  const href = resolveHref(active);
  const showDetectedBanner = isManifestPlatform(detected);
  const linuxDetected = detected === "linux";
  const unknownDevice = detected === "unknown";
  const isViewingDetected = selected === detected;

  const ctaLabel = buildCtaLabel(selected, active, {
    detected,
    isViewingDetected,
    unknownDevice,
  });

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <div className="rounded-xl bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">Download MedDef</h1>
        <p className="mt-3 text-sm text-indigo-100 leading-relaxed max-w-xl">
          Native clients for imaging and text inference.
          {linuxDetected ? (
            <>
              {" "}
              We detected{" "}
              <span className="font-semibold text-white">Linux</span>. A native
              Linux build is not available yet — choose Android, iOS, macOS, or
              Windows below.
            </>
          ) : showDetectedBanner ? (
            <>
              {" "}
              We suggest{" "}
              <span className="font-semibold text-white">
                {PLATFORM_LABELS[detected]}
              </span>{" "}
              for your device — switch platforms anytime.
            </>
          ) : (
            <> Choose your platform below.</>
          )}
        </p>
        {clientRefined && showDetectedBanner && isViewingDetected && (
          <p className="mt-2 text-xs text-indigo-200/90">
            Detected from your browser
            {serverDetected !== detected ? " (refined on this device)" : ""}.
          </p>
        )}
      </div>

      <Card
        className={cn(
          "border-2 transition-shadow",
          isViewingDetected && showDetectedBanner
            ? "border-indigo-400 shadow-md ring-1 ring-indigo-100"
            : "border-indigo-100",
        )}
      >
        <CardHeader className="pb-3">
          <div
            className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg w-fit"
            role="tablist"
            aria-label="Platform"
          >
            {primaryTabs.map((id) => {
              const Icon = PLATFORM_ICONS[id];
              const isActive = selected === id;
              const isDetected = detected === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelected(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {PLATFORM_LABELS[id]}
                  {isDetected && !isActive && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-indigo-500"
                      title="Detected on your device"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
            {showLinuxTab && (
              <>
                <span
                  className="text-slate-300 text-xs hidden sm:inline mx-1"
                  aria-hidden
                >
                  |
                </span>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected === LINUX_PLATFORM}
                  onClick={() => setSelected(LINUX_PLATFORM)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                    selected === LINUX_PLATFORM
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-slate-400/80 hover:border-amber-200 hover:bg-amber-50/50",
                    linuxDetected &&
                      selected !== LINUX_PLATFORM &&
                      "ring-1 ring-amber-200",
                  )}
                >
                  <Terminal className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {PLATFORM_LABELS.linux}
                  <Badge
                    variant="warning"
                    className="ml-0.5 px-1.5 py-0 text-[10px]"
                  >
                    Soon
                  </Badge>
                </button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PlatformCard
            id={selected}
            artifact={active}
            emphasized={isViewingDetected && showDetectedBanner}
            releaseDate={manifest.releaseDate}
          />

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {href ? (
              <Link
                href={href}
                download={
                  active.status === "available" ? active.filename : undefined
                }
                target={active.status === "external" ? "_blank" : undefined}
                rel={
                  active.status === "external"
                    ? "noopener noreferrer"
                    : undefined
                }
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "w-full sm:w-auto inline-flex",
                )}
              >
                {active.status === "external" ? (
                  <ExternalLink className="h-4 w-4 shrink-0" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                {ctaLabel}
              </Link>
            ) : (
              <Button size="lg" disabled className="w-full sm:w-auto">
                <Download className="h-4 w-4 shrink-0" />
                {ctaLabel}
              </Button>
            )}
            {linuxDetected && isViewingDetected && primaryTabs.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => setSelected(primaryTabs[0])}
              >
                Browse {PLATFORM_LABELS[primaryTabs[0]]} & other platforms
              </Button>
            )}
            {shouldOfferDetectedShortcut(detected, manifest) &&
              !isViewingDetected && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setSelected(detected)}
                >
                  Use {PLATFORM_LABELS[detected]} (detected)
                </Button>
              )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          All platforms
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...primaryTabs, ...(showLinuxTab ? [LINUX_PLATFORM] : [])].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={cn(
                "text-left rounded-lg border p-4 transition-colors",
                selected === id &&
                  (id === LINUX_PLATFORM
                    ? "border-amber-300 bg-amber-50/50"
                    : "border-indigo-300 bg-indigo-50/50"),
                selected !== id &&
                  "border-slate-200 bg-white hover:border-slate-300",
                detected === id &&
                  selected !== id &&
                  (id === LINUX_PLATFORM
                    ? "ring-1 ring-amber-200"
                    : "ring-1 ring-indigo-200"),
              )}
            >
              <PlatformCard
                id={id}
                artifact={platformInManifest(manifest, id)!}
                compact
              />
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Manifest:{" "}
        <a
          href="/downloads/manifest.json"
          className="text-indigo-600 hover:underline font-mono"
        >
          /downloads/manifest.json
        </a>
        {" · "}
        <a
          href="/api/downloads-manifest"
          className="text-indigo-600 hover:underline font-mono"
        >
          /api/downloads-manifest
        </a>
      </p>
    </div>
  );
}

function PlatformCard({
  id,
  artifact,
  emphasized = false,
  compact = false,
  releaseDate,
}: {
  id: Exclude<PlatformId, "unknown">;
  artifact: PlatformArtifact;
  emphasized?: boolean;
  compact?: boolean;
  releaseDate?: string;
}) {
  const Icon = PLATFORM_ICONS[id];
  const sizeLabel = formatBytes(artifact.sizeBytes);

  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              emphasized
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <CardTitle className={cn(compact ? "text-sm" : "text-lg")}>
              {PLATFORM_LABELS[id]}
            </CardTitle>
            {!compact && artifact.format && (
              <CardDescription>{artifact.format}</CardDescription>
            )}
          </div>
        </div>
        <Badge variant={statusBadgeVariant(artifact.status)}>
          {statusLabel(artifact.status)}
        </Badge>
      </div>
      {artifact.version && (
        <p className={cn("text-slate-600", compact ? "text-xs" : "text-sm")}>
          Version{" "}
          <span className="font-mono font-medium">{artifact.version}</span>
          {releaseDate && !compact && (
            <span className="text-slate-400"> · released {releaseDate}</span>
          )}
          {sizeLabel && (
            <span className="text-slate-400"> · {sizeLabel}</span>
          )}
        </p>
      )}
      {artifact.notes && !compact && (
        <p className="text-xs text-slate-500 leading-relaxed">{artifact.notes}</p>
      )}
      {artifact.filename && artifact.status === "available" && !compact && (
        <p className="text-xs font-mono text-slate-400">{artifact.filename}</p>
      )}
    </div>
  );
}
