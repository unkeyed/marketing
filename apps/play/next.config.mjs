/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/c15t/:path*",
        destination: `${process.env?.NEXT_PUBLIC_C15T_URL ?? undefined}/:path*`,
      },
    ];
  },
};

export default nextConfig;
