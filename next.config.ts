import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Experimental features
  experimental: {
    // Server Actions are stable in Next.js 15
  },
  images: {
    // Extend device sizes to cover the wide game images (2816 px source)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    qualities: [75, 80, 85, 90],
  },
};

export default withNextIntl(nextConfig);
