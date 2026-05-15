import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "MedDef Android",
  description:
    "Download the MedDef Android app (APK) for imaging and text inference against your backend.",
};

const APK_HREF = "/downloads/meddef.apk";

export default function DownloadsPage() {
  return (
    <div className="space-y-8 w-full max-w-2xl">
      <div className="rounded-xl bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">MedDef Android</h1>
        <p className="mt-3 text-sm text-indigo-100 leading-relaxed max-w-xl">
          Install the Expo/React Native MedDef client to run ONNX imaging
          workflows and optional text inference pointed at https://meddef.ekddigital.com
          (or your configured API base URL).
        </p>
      </div>

      <Card className="border-indigo-100">
        <CardHeader>
          <CardTitle>Download APK</CardTitle>
          <CardDescription>
            Build the APK with EAS using the <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">preview</code> profile, then upload{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">meddef.apk</code> to{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">public/downloads/</code>{" "}
            in this repo or host it via a release asset and update this link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link
            href={APK_HREF}
            download
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "w-full sm:w-auto inline-flex",
            )}
          >
            <Download className="h-4 w-4 shrink-0" />
            Download meddef.apk
          </Link>
          <p className="text-xs text-slate-500">
            Direct URL:{" "}
            <a
              href={APK_HREF}
              className="text-indigo-600 hover:underline font-mono break-all"
            >
              {APK_HREF}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
