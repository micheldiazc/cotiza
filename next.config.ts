import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Siempre con valor ("true" o "false"): si la variable no existe, Next no la
  // sustituye al compilar y no puede descartar el código del modo que no se usa.
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "true" : "false",
  },
  cacheComponents: true,
  partialPrefetching: true,
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
