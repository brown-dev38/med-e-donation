import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Donation slips are up to 5 MB; leave room for multipart overhead and the other fields.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Node-only library used by the Excel export route; load it from node_modules instead of bundling.
  serverExternalPackages: ["exceljs"],
  // The donation form is now the home page; keep old /donate links (incl. ?fund=) working.
  async redirects() {
    return [{ source: "/donate", destination: "/", permanent: true }];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
