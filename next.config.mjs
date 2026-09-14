/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs is a Node-only dependency; keep it external to the server bundle.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
