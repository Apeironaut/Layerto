import { Button, StatusScreen } from '@layerto/ui';

/** Shown when an admin has suspended the account. */
export function SuspendedPage({ onSignOut }: { onSignOut: () => void }) {
  return (
    <StatusScreen icon="alert" tone="danger" title="Account suspended" actions={<Button variant="secondary" onClick={onSignOut}>Sign out</Button>}>
      This account has been suspended, so its API keys no longer work. Contact the Layerto team if you think this is a
      mistake.
    </StatusScreen>
  );
}
