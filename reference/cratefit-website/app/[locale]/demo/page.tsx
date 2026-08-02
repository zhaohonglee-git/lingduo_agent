import type { Metadata } from 'next';
import { DemoClient } from '@/components/demo/DemoClient';

export const metadata: Metadata = {
  title: '灵垛 LingDuo — AI+码垛算法平台',
  description: '自然语言驱动的 3D 装箱码垛仿真平台。基于 AgentScope 2.0 + @cratefit/pack。',
};

export default function DemoPage() {
  return <DemoClient />;
}
