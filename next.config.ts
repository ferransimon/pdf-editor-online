import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (default in dev) — no special aliases needed; pdfjs is
  // loaded via dynamic import on the client only, so `canvas` is never resolved.
  turbopack: {},
  // Webpack config used for `next build`
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
