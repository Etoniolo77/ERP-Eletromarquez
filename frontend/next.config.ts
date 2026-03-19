import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/sesmt/5s", destination: "/indicadores/5s", permanent: true },
      { source: "/sesmt/apr", destination: "/indicadores/apr", permanent: true },
      { source: "/sesmt/:path*", destination: "/indicadores/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
