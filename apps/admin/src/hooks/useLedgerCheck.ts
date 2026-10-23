import { useCallback, useState } from 'react';
import type { LedgerVerifyResult } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { api } from '../lib/api';

/** Runs the server-side ledger verification on demand. */
export function useLedgerCheck() {
  const [result, setResult] = useState<LedgerVerifyResult | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await api.adminVerifyLedger());
      setCheckedAt(new Date());
    } catch (err) {
      setError(errorMessage(err, "Couldn't verify the ledger. Try again."));
    } finally {
      setRunning(false);
    }
  }, []);

  return { result, checkedAt, error, running, run };
}
