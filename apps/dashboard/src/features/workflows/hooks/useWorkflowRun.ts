import { useCallback, useState } from 'react';
import type { WorkflowRunResult } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { api } from '../../../lib/api';

/** Runs a saved workflow on uploaded images. */
export function useWorkflowRun(workflowId: string | undefined) {
  const [result, setResult] = useState<WorkflowRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (files: File[]) => {
      if (!workflowId || files.length === 0) return null;
      setRunning(true);
      setError(null);
      try {
        const res = await api.runWorkflow(workflowId, files);
        setResult(res);
        return res;
      } catch (err) {
        setError(errorMessage(err, 'The run failed. Try again.'));
        return null;
      } finally {
        setRunning(false);
      }
    },
    [workflowId],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, running, run, reset };
}
