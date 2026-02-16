import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud", pathname: "/**" },
      { protocol: "https", hostname: "**.convex.site", pathname: "/**" },
    ],
  },
  webpack(config) {
    const convexRoot = path.resolve(__dirname, "convex");
    config.resolve.alias = {
      ...config.resolve.alias,
      "convex/_generated/api": path.join(convexRoot, "_generated/api.js"),
      "convex/_generated/dataModel": path.join(
        convexRoot,
        "_generated/dataModel.d.ts"
      ),
      "convex/_generated/server": path.join(
        convexRoot,
        "_generated/server.js"
      ),
    };
    return config;
  },
    turbopack: {
    resolveAlias: {
      convex: path.resolve(__dirname, "convex"),
    },
  },
};

export default nextConfig;
