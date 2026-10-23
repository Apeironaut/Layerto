import { Button, Card, Chip, Icon } from '@layerto/ui';

export interface GettingStartedChecklistProps {
  accountApproved: boolean;
  hasApiKey: boolean;
  hasSuccessfulCall: boolean;
  onCreateKey: () => void;
  onOpenPlayground: () => void;
}

/**
 * Onboarding checklist computed from real account status, API keys, and requests.
 * Automatically hides itself once all 3 steps are completed.
 */
export function GettingStartedChecklist({
  accountApproved,
  hasApiKey,
  hasSuccessfulCall,
  onCreateKey,
  onOpenPlayground,
}: GettingStartedChecklistProps) {
  // If all three milestones are met, hide completely
  if (accountApproved && hasApiKey && hasSuccessfulCall) {
    return null;
  }

  const steps = [
    {
      id: 'approved',
      title: 'Account approved',
      description: 'Your account is active and credited with 50 free calls.',
      done: accountApproved,
      action: null,
    },
    {
      id: 'key',
      title: 'Create an API key',
      description: 'Generate an API key to authenticate requests from your code or curl.',
      done: hasApiKey,
      action: (
        <Button size="sm" icon="key" onClick={onCreateKey}>
          Create key
        </Button>
      ),
    },
    {
      id: 'call',
      title: 'Make your first successful call',
      description: 'Run an inference in the vision playground or send a request via the API.',
      done: hasSuccessfulCall,
      action: (
        <Button size="sm" variant="secondary" icon="spark" onClick={onOpenPlayground}>
          Try playground
        </Button>
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <Card
      title="Getting started"
      subtitle={`${completedCount} of ${steps.length} steps completed`}
      actions={<Chip variant={completedCount === 2 ? 'pending' : 'neutral'}>{`${completedCount}/${steps.length}`}</Chip>}
      className="rounded-l1 bg-card border border-line shadow-l2 hover:shadow-l3 hover:-translate-y-1 transition-all duration-300"
    >
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`flex items-start justify-between gap-4 p-3.5 rounded-control border transition-colors ${
              step.done
                ? 'bg-page/40 border-line/60 opacity-80'
                : 'bg-page border-line-strong'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  step.done
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                    : 'bg-muted/15 text-muted border border-muted/30'
                }`}
              >
                {step.done ? <Icon name="check" size={14} /> : idx + 1}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${step.done ? 'line-through text-muted' : 'text-ink'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-muted mt-0.5">{step.description}</div>
              </div>
            </div>
            {!step.done && step.action && <div className="shrink-0">{step.action}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}
