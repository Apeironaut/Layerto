import { useCopy } from '../hooks/useCopy';
import { Button } from './Button';
import type { ButtonProps } from './Button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'icon'> {
  text: string;
  label?: string;
  onCopied?: () => void;
}

/** Copies `text`; the label switches to "Copied" for 2 seconds. */
export function CopyButton({ text, label = 'Copy', onCopied, variant = 'secondary', size = 'sm', ...props }: CopyButtonProps) {
  const { copied, copy } = useCopy();
  return (
    <Button
      variant={variant}
      size={size}
      icon={copied ? 'check' : 'copy'}
      onClick={async () => {
        if (await copy(text)) onCopied?.();
      }}
      {...props}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
