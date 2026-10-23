import { useCallback, useEffect, useState } from 'react';
import type { VisionResponse } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { api } from '../lib/api';
import type { ChainStepConfig } from '../lib/playgroundLogic';

export interface ChainStepResult {
  stepIndex: number;
  model: string;
  response: VisionResponse;
}

/** Holds the chosen image and runs it through a model or model chain via the playground. */
export function usePlaygroundRun() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VisionResponse | null>(null);
  const [chainResults, setChainResults] = useState<ChainStepResult[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Release the object URL when the image changes or the page unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const choose = useCallback((next: File) => {
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setChainResults([]);
    setActiveStepIndex(0);
    setError(null);
  }, []);

  const run = useCallback(
    async (model: string, prompt: string): Promise<VisionResponse | null> => {
      if (!file) return null;
      setRunning(true);
      setError(null);
      setChainResults([]);
      try {
        const res = await api.runPlayground(model, file, prompt.trim() || undefined);
        setResult(res);
        return res;
      } catch (err) {
        setError(errorMessage(err, 'The model run failed. Try again.'));
        return null;
      } finally {
        setRunning(false);
      }
    },
    [file],
  );

  const runChain = useCallback(
    async (steps: ChainStepConfig[]): Promise<ChainStepResult[] | null> => {
      if (!file || steps.length === 0) return null;
      setRunning(true);
      setError(null);
      setChainResults([]);
      const results: ChainStepResult[] = [];
      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const res = await api.runPlayground(step.model_slug, file, step.prompt.trim() || undefined);
          results.push({ stepIndex: i, model: step.model_slug, response: res });
        }
        setChainResults(results);
        setActiveStepIndex(results.length - 1);
        if (results.length > 0) {
          setResult(results[results.length - 1].response);
        }
        return results;
      } catch (err) {
        setError(errorMessage(err, 'A model in the workflow chain failed to execute.'));
        return null;
      } finally {
        setRunning(false);
      }
    },
    [file],
  );

  return {
    file,
    previewUrl,
    result,
    chainResults,
    activeStepIndex,
    setActiveStepIndex,
    error,
    setError,
    running,
    choose,
    run,
    runChain,
  };
}
