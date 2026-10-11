import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'simple-git', 'csv-parse'],
};

export default nextConfig;
