/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: [
    "@schoolos/ui",
    "@schoolos/auth",
    "@schoolos/hooks",
    "@schoolos/utils",
    "@schoolos/types",
    "@schoolos/validation",
    "@schoolos/config",
  ],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
    NEXT_PUBLIC_APP_NAME: "Teacher Portal",
    NEXT_PUBLIC_ROLE: "teacher",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
