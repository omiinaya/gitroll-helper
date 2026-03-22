import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.35", "grh.mrxlab.net"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
