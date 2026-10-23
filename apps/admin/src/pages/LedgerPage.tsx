import { Alert, Button, Card, PageHeader, Reveal } from '@layerto/ui';
import { LedgerResult } from '../components/ledger/LedgerResult';
import { useLedgerCheck } from '../hooks/useLedgerCheck';

export function LedgerPage() {
  const check = useLedgerCheck();
  return (
    <>
      <PageHeader title="Ledger" description="Every balance change is an append-only event. Verification re-checks the whole chain on the server." />
      <Reveal index={0}>
        <Card
          title="Verify the ledger"
          subtitle="Read-only. Safe to run at any time."
          actions={
            <Button icon="shield" loading={check.running} onClick={() => void check.run()}>
              {check.result ? 'Run again' : 'Verify now'}
            </Button>
          }
        >
          {check.error && <Alert tone="error">{check.error}</Alert>}
          {check.result && check.checkedAt ? (
            <LedgerResult result={check.result} checkedAt={check.checkedAt} />
          ) : (
            !check.error && <p className="text-sm text-muted">No check run in this session yet.</p>
          )}
        </Card>
      </Reveal>
    </>
  );
}
