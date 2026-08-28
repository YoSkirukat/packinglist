import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx"],
  experimental: {
    middlewareClientMaxBodySize: "300mb",
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
};

export default nextConfig;
