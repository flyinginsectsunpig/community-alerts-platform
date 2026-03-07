/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {},

  async rewrites() {
    const javaApi = process.env.JAVA_API_URL || 'http://localhost:8080';
    const mlApi = process.env.ML_API_URL || 'http://localhost:8001';
    const notifApi = process.env.NOTIF_API_URL || 'http://localhost:5001';

    return [
      {
        source: '/api-proxy/java/:path*',
        destination: `${javaApi}/:path*`,
      },
      {
        source: '/api-proxy/ml/:path*',
        destination: `${mlApi}/:path*`,
      },
      {
        source: '/api-proxy/notif/:path*',
        destination: `${notifApi}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;