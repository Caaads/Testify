import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.6", "localhost", "127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fefdbdqgvtrcemlvtkut.supabase.co",
      },
    ],
  },
};

export default nextConfig;
