import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live data from Postgres, so we render per request
  // (route-level `dynamic = "force-dynamic"`) instead of using Cache Components.
  cacheComponents: false,
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
