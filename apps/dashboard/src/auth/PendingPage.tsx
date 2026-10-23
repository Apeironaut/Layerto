import { useState } from 'react';
import type { User } from '@layerto/types';
import { Button, StatusScreen, useNotify } from '@layerto/ui';

export interface PendingPageProps {
  email: string;
  onRecheck: () => Promise<User | null>;
  onSignOut: () => void;
}

/** Shown until an admin approves the account. */
export function PendingPage({ email, onRecheck, onSignOut }: PendingPageProps) {
  const notify = useNotify();
  const [checking, setChecking] = useState(false);
  return (
    <StatusScreen
      icon="info"
      tone="pending"
      title="Waiting for approval"
      actions={
        <>
          <Button
            loading={checking}
            onClick={async () => {
              setChecking(true);
              const user = await onRecheck();
              setChecking(false);
              if (user?.status === 'pending') notify('Still waiting for approval', 'info');
            }}
          >
            Check again
          </Button>
          <Button variant="secondary" onClick={onSignOut}>
            Sign out
          </Button>
        </>
      }
    >
      Your account <strong className="text-ink">{email}</strong> is registered. The Layerto team will approve it soon;
      then you can create API keys and use your 50 free calls.
    </StatusScreen>
  );
}
