import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'simple-git', 'csv-parse'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
