import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: [
    "@business-dashboard/application",
    "@business-dashboard/domain",
    "@business-dashboard/integrations",
    "@business-dashboard/schemas",
  ],
};

export default nextConfig;
