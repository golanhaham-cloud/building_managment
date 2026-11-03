/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfkit נשאר חבילת node חיצונית כדי שייבוא הפונטים הפנימי שלה (#standard-fonts) יעבוד ב-serverless
    serverComponentsExternalPackages: ["pdfkit"],
  },
};
export default nextConfig;
