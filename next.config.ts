import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep onnxruntime-node out of the client bundle (server-only native addon)
  serverExternalPackages: ["onnxruntime-node"],
};

export default nextConfig;
