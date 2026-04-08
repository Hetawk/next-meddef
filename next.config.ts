import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep onnxruntime-node out of the client bundle (server-only native addon)
  serverExternalPackages: ["onnxruntime-node"],
  experimental: {
    // Allow large ONNX file uploads through the Next.js server
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
};

export default nextConfig;
