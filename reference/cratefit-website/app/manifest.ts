import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '灵垛 LingDuo — AI+码垛算法平台',
    short_name: '灵垛',
    description: '自然语言驱动的 3D 装箱码垛仿真平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
  };
}
