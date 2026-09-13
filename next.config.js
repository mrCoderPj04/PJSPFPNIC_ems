/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'https://ems-backend-z3bv.onrender.com',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ems-backend-z3bv.onrender.com/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
