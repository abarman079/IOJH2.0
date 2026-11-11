import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,

  // Limit build workers to reduce Windows resource usage.
  experimental: {
    cpus: 2,
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(
  nextConfig
);