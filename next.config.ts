import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tiled.nsls2.bnl.gov',
      },
    ],
  },
};

export default nextConfig;
