import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      // Proxy z2.idlixku.com through Vercel Edge — no CORS, different IP range
      {
        source: "/z2/:path*",
        destination: "https://z2.idlixku.com/:path*",
      },
      // Proxy majorplay.net through Vercel Edge
      {
        source: "/mp/:path*",
        destination: "https://e2e.majorplay.net/:path*",
      },
    ];
  },
};

export default nextConfig;
