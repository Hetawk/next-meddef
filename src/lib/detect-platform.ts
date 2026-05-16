export type PlatformId =
  | "android"
  | "ios"
  | "macos"
  | "windows"
  | "linux"
  | "unknown";

export const PLATFORM_IDS: PlatformId[] = [
  "android",
  "ios",
  "macos",
  "windows",
  "linux",
];

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  android: "Android",
  ios: "iOS",
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
  unknown: "your device",
};

/** Parse User-Agent (and optional navigator.platform) into a MedDef platform id. */
export function detectPlatform(
  userAgent: string,
  navigatorPlatform?: string,
): PlatformId {
  const ua = userAgent.toLowerCase();
  const np = (navigatorPlatform ?? "").toLowerCase();

  // iPadOS 13+ Safari often reports Macintosh + Mobile
  const isIPad =
    /\bipad\b/.test(ua) ||
    (/\bmacintosh\b/.test(ua) && /\bmobile\b/.test(ua));

  if (/\bandroid\b/.test(ua)) return "android";
  if (isIPad || /\biphone\b|\bipod\b/.test(ua)) return "ios";
  if (/\bwindows phone\b|\bwindows mobile\b|\biemobile\b/.test(ua)) return "windows";
  if (/\bwin(dows|32|64|ce)?\b|\bwow64\b/.test(ua)) return "windows";
  if (/\bmacintosh\b|\bmac os x\b|\bmac_powerpc\b/.test(ua) && !isIPad) return "macos";
  if (/\bcros\b/.test(ua)) return "linux";
  if (
    /\blinux\b|\bx11\b|\bubuntu\b|\bdebian\b|\bfedora\b/.test(ua) &&
    !/\bandroid\b/.test(ua)
  ) {
    return "linux";
  }

  if (np.includes("win")) return "windows";
  if (np.includes("mac") && !isIPad) return "macos";
  if (np.includes("linux")) return "linux";
  if (/iphone|ipad|ipod/.test(np)) return "ios";

  return "unknown";
}

export function isManifestPlatform(id: PlatformId): id is Exclude<PlatformId, "unknown"> {
  return id !== "unknown";
}
