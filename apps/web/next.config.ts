import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: [
    "@signaldesk/application",
    "@signaldesk/domain",
    "@signaldesk/integrations",
    "@signaldesk/schemas",
  ],
};

export default nextConfig;
