'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Upload, Share2, RotateCcw, Check, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/lib/stores/demo-store';
import {
  downloadConfigAsJson,
  readConfigFromFile,
  generateShareUrl,
} from '@/lib/url-state';
import { AlgorithmComparison } from './AlgorithmComparison';
import { ConfirmDialog } from './ConfirmDialog';

export function UtilityToolbar() {
  const t = useTranslations('demo');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);
  const [showComparison, setShowComparison] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { exportConfig, loadConfig, reset } = useDemoStore();

  const handleExport = () => {
    const config = exportConfig();
    downloadConfigAsJson(config);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME type (not just extension)
    // Accept both application/json and text/plain (some systems report JSON as text)
    const validMimeTypes = ['application/json', 'text/plain', 'text/json'];
    if (!validMimeTypes.includes(file.type) && file.type !== '') {
      console.error('Invalid file type:', file.type);
      e.target.value = '';
      return;
    }

    const config = await readConfigFromFile(file);
    if (config) {
      loadConfig(config);
    }

    // Reset input
    e.target.value = '';
  };

  const handleShare = async () => {
    const config = exportConfig();
    const url = generateShareUrl(config);

    if (!url) {
      console.error('Failed to generate share URL');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareUrlCopied(true);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => setShareUrlCopied(false), 2000);
    } catch {
      // Fallback: select and copy from a temporary input
      const input = document.createElement('input');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        setShareUrlCopied(true);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setShareUrlCopied(false), 2000);
      } catch {
        // Last resort: log URL to console
        console.log('Share URL:', url);
      }
      document.body.removeChild(input);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = useCallback(() => {
    reset();
    // Clear URL hash
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setShowResetConfirm(false);
  }, [reset]);

  const handleResetCancel = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => setShowComparison(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t('comparison.title')}
          aria-label={t('comparison.title')}
        >
          <FlaskConical className="h-4 w-4" />
        </button>

        <button
          onClick={handleExport}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t('utility.export')}
          aria-label={t('utility.export')}
        >
          <Download className="h-4 w-4" />
        </button>

      <button
        onClick={handleImport}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title={t('utility.import')}
        aria-label={t('utility.import')}
      >
        <Upload className="h-4 w-4" />
      </button>

      <button
        onClick={handleShare}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          shareUrlCopied
            ? 'bg-green-500/10 text-green-600'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        title={shareUrlCopied ? t('utility.copied') : t('utility.share')}
        aria-label={t('utility.share')}
      >
        {shareUrlCopied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </button>

      <button
        onClick={handleResetClick}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        title={t('utility.reset')}
        aria-label={t('utility.reset')}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      </div>

      {/* Algorithm Comparison Modal */}
      {showComparison && <AlgorithmComparison onClose={() => setShowComparison(false)} />}

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title={t('utility.resetTitle')}
        message={t('utility.confirmReset')}
        confirmLabel={t('utility.reset')}
        cancelLabel={t('utility.cancel')}
        variant="destructive"
        onConfirm={handleResetConfirm}
        onCancel={handleResetCancel}
      />
    </>
  );
}
