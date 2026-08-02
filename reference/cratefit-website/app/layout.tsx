import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cratefit.vercel.app';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: '灵垛 LingDuo — AI+码垛算法平台',
    template: '%s | 灵垛',
  },
  description:
    '自然语言驱动的 3D 装箱码垛仿真平台。基于 AgentScope 2.0 + @cratefit/pack。',
  keywords: [
    'bin packing',
    '3d packing',
    'container loading',
    'pallet packing',
    'logistics optimization',
    'typescript',
    'open source',
    '3d bin packing algorithm',
    'box packing',
    'shipping optimization',
  ],
  authors: [{ name: 'supra126', url: 'https://github.com/supra126' }],
  creator: 'supra126',
  publisher: 'CrateFit',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'CrateFit - 3D Bin Packing Made Simple',
    description:
      'Open-source 3D bin packing library for container loading, pallet packing, and logistics optimization.',
    url: BASE_URL,
    siteName: 'CrateFit',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CrateFit - 3D Bin Packing Made Simple',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CrateFit - 3D Bin Packing Made Simple',
    description:
      'Open-source 3D bin packing library for container loading, pallet packing, and logistics optimization.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      'en': `${BASE_URL}/en`,
      'zh-TW': `${BASE_URL}/zh-TW`,
    },
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
