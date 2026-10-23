import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useCopy } from '../hooks/useCopy';
import { Icon } from './Icon';

export interface ApiKeyRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
  expiresAt?: string | null;
}

/** Shows a new API key once. It can only be closed after copying or confirming it was saved. */
export function ApiKeyRevealModal({ isOpen, onClose, apiKey, keyName, expiresAt }: ApiKeyRevealModalProps) {
  const { copied, copy } = useCopy();
  const [hasCopied, setHasCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const canClose = hasCopied || acknowledged;

  const doCopy = async () => {
    if (await copy(apiKey)) setHasCopied(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissable={canClose}
      title="Save your API key"
      description={
        <>
          Key <strong className="text-ink">{keyName}</strong> is ready. You won't see it again.
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={doCopy}
            className="w-full text-left p-3.5 bg-page border border-line rounded-control font-mono text-sm text-ink break-all cursor-copy hover:border-crimson transition-colors"
            aria-label="Copy API key"
          >
            {apiKey}
          </button>
          <p className="text-xs text-muted">
            {expiresAt ? `Expires on ${new Date(expiresAt).toLocaleDateString()}` : 'Never expires'}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" icon={copied ? 'check' : 'copy'} onClick={doCopy}>
            {copied ? 'Copied' : 'Copy key'}
          </Button>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Icon name="info" size={14} /> Shown once only
          </span>
        </div>
        <label className="flex items-center gap-2.5 pt-3 border-t border-line text-sm text-ink-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4 accent-crimson cursor-pointer"
          />
          I've saved this key somewhere safe
        </label>
        <div className="flex justify-end pt-1">
          <Button onClick={onClose} disabled={!canClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
