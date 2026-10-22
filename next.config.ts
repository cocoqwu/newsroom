import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev-tools button so it does not cover the sidebar footer in screenshots.
  devIndicators: false,
  agentRules: false,
  // Pages read the local SQLite file on every request, so the experimental cache mode is off.
  cacheComponents: false,
  // Native and model packages stay out of the bundler.
  serverExternalPackages: ["better-sqlite3", "@huggingface/transformers", "onnxruntime-node"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
