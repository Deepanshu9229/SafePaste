import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML/CSS/JS only (`out/`): no server, so pasted text never reaches the host.
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
