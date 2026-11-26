import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // No native server dependencies: the same build runs on Node (local) and
  // on Cloudflare Workers (production, via @opennextjs/cloudflare).
};

export default nextConfig;
