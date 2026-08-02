'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useDemoStore } from '@/lib/stores/demo-store';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_AI_API || 'http://localhost:8000';

const ITEM_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

interface ChatSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function ChatSidebar({ collapsed, onToggle }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadConfig = useDemoStore((s) => s.loadConfig);
  const items = useDemoStore((s) => s.items);
  const bins = useDemoStore((s) => s.bins);
  const options = useDemoStore((s) => s.options);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let aiText = '';

    try {
      // Build conversation history from messages
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (eventType === 'thinking') {
                aiText += data.text || '';
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'ai') {
                    return [...prev.slice(0, -1), { role: 'ai', text: aiText }];
                  }
                  return [...prev, { role: 'ai', text: data.text || '' }];
                });
              } else if (eventType === 'config') {
                // 验证配置有效才加载
                const hasValidBins = data.bins?.length > 0 && data.bins[0]?.width > 0;
                const hasValidItems = data.items?.length > 0 && data.items[0]?.width > 0;
                if (hasValidBins && hasValidItems) {
                  loadConfig(data);
                  const totalQty = data.items.reduce((s: number, i: { quantity: number }) => s + (i.quantity || 1), 0);
                  setMessages((prev) => [...prev, {
                    role: 'ai',
                    text: `✅ 配置已生成：${data.items.length} 种规格共 ${totalQty} 件，${data.bins.length} 个容器，算法 ${data.options?.algorithm || 'auto'}`
                  }]);
                }
              } else if (eventType === 'error') {
                setError(data.message || '未知错误');
              }
              eventType = '';
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Summary of current config
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  // Collapsed state
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center border-r bg-card py-3 w-12">
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="展开 Agent 面板"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        <div className="mt-3 flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        {totalItems > 0 && (
          <div className="mt-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
            {totalItems}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card border-r">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-sm">灵垛 Agent</h2>
              <p className="text-xs text-muted-foreground">AI+混合码垛算法策略计算平台</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="折叠 Agent 面板"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Bot className="mx-auto h-12 w-12 mb-4 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-2">用自然语言描述你的码垛需求</p>
            <div className="space-y-1.5 text-xs text-muted-foreground/60">
              <p>"用EUR托盘码放400×300×200mm的箱子25个"</p>
              <p>"40尺高柜装20个1200×1000×1500的托盘"</p>
              <p>"100×100×100的箱子里装5个30×20×20的盒子"</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'ai' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={cn(
              'rounded-lg px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}>
              {msg.text}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              正在分析需求...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Current config summary (collapsed) */}
      {totalItems > 0 && (
        <div className="flex-shrink-0 border-t">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <span>📋 当前配置：{items.length}种规格 · {totalItems}件 · {bins.length}个容器</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', showConfig && 'rotate-180')} />
          </button>
          {showConfig && (
            <div className="px-4 pb-3 space-y-2 max-h-40 overflow-y-auto">
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">容器:</p>
                {bins.map((b) => (
                  <p key={b.id} className="pl-2">• {b.id} ({b.type}) {b.width}×{b.height}×{b.depth}mm</p>
                ))}
                <p className="font-medium mt-2 mb-1">物品:</p>
                {items.map((item) => (
                  <p key={item.id} className="pl-2">• {item.id} {item.width}×{item.height}×{item.depth}mm ×{item.quantity}</p>
                ))}
                <p className="font-medium mt-2 mb-1">选项:</p>
                <p className="pl-2">算法: {options.algorithm || '默认'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的码垛需求..."
            disabled={isLoading}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
