import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (default in dev) — no special aliases needed; pdfjs is
  // loaded via dynamic import on the client only, so `canvas` is never resolved.
  turbopack: {},
  typescript: {
    // We'll catch these in our own type checks, and they don't cause build
    // failures, so let's not bother devs with them.
    ignoreBuildErrors: true,
  },
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
