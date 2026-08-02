'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, Bot, X } from 'lucide-react';
import { useDemoStore } from '@/lib/stores/demo-store';
import { cn } from '@/lib/utils';
import type { BinSpec, PackOptions } from '@cratefit/pack';
import type { DemoItem } from '@/lib/stores/demo-store';

const API_BASE = process.env.NEXT_PUBLIC_AI_API || 'http://localhost:8000';

const ITEM_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

interface AIConfig {
  bins: BinSpec[];
  items: DemoItem[];
  options: PackOptions;
}

export function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadConfig = useDemoStore((s) => s.loadConfig);
  const setResult = useDemoStore((s) => s.setResult);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let aiText = '';

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
                // Received parsed config - populate demo store
                const config = data as AIConfig;
                if (config.bins && config.items) {
                  loadConfig(config);
                }
              } else if (eventType === 'error') {
                setError(data.message || 'Unknown error');
              }
              eventType = '';
            } catch {
              // skip parse errors
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, loadConfig]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all',
          isOpen
            ? 'bg-primary text-primary-foreground'
            : 'bg-background border text-foreground hover:bg-muted'
        )}
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">AI 码垛助手</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[500px] w-[380px] flex-col rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">AI 码垛助手</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="mx-auto h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">用自然语言描述你的码垛需求</p>
                <p className="text-xs mt-1 opacity-60">
                  例如："用EUR托盘码放400×300×200mm的箱子25个"
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2 text-sm',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'ai' && (
                  <Bot className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
                )}
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在分析需求...
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                ❌ {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
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
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
