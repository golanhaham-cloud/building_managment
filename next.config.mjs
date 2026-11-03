/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // פונטים מוטמעים ליצירת דוח ה-PDF בשרת (נטענים ב-fs בזמן ריצה)
    outputFileTracingIncludes: {
      "/finances/report.pdf": ["./assets/fonts/**"],
    },
  },
};
export default nextConfig;
