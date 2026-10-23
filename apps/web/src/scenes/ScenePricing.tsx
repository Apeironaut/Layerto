import { Skeleton } from '@layerto/ui';
import type { ModelsState } from '../hooks/useModels';
import { DASHBOARD_URL } from '../config';
import { BillingRules } from './pricing/BillingRules';
import { ChargeFlow } from './pricing/ChargeFlow';
import { CostEstimator } from './pricing/CostEstimator';
import { ModelPriceCard } from './pricing/ModelPriceCard';

/** Pricing: the rules, how a call is charged, live per-model prices and an estimator. */
export function ScenePricing({ models, navigate }: { models: ModelsState; navigate: (to: string) => void }) {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="w-full bg-page py-[12vh] px-[2vw] space-y-5">
      <div className="text-center px-4 mb-12">
        <h2 id="pricing-title" className="text-3xl sm:text-5xl font-bold tracking-tight">
          Simple, per-call pricing
        </h2>
        <p className="mt-3 text-muted text-base sm:text-lg max-w-[50ch] mx-auto">
          No plans and no subscription. With Layerto Vision you pay for each successful call, at the price of the model you used. Charon pricing will be announced at launch.
        </p>
      </div>

      <BillingRules />
      <ChargeFlow />

      <div className="pt-8">
        <h3 className="text-2xl font-bold px-1">Prices per model</h3>
        <p className="mt-1 mb-5 px-1 text-sm text-muted">Live from the API. A price change applies to new calls only.</p>
        {models.status === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-52 rounded-l1" />
            <Skeleton className="h-52 rounded-l1" />
          </div>
        )}
        {models.status === 'error' && (
          <p className="rounded-l1 border border-line bg-card p-6 text-center text-sm text-muted">
            Live prices can't be loaded right now. Sign in to the dashboard to see current prices.
          </p>
        )}
        {models.status === 'ready' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.models.map((m) => (
              <ModelPriceCard key={m.slug} model={m} onOpen={() => navigate(`/models/${m.slug}`)} />
            ))}
          </div>
        )}
      </div>

      {models.status === 'ready' && models.models.length > 0 && <CostEstimator models={models.models} />}

      <p className="pt-6 text-center text-sm text-muted">
        During early access, balances are topped up by the Layerto team.{' '}
        <a href={DASHBOARD_URL} className="text-crimson font-semibold">
          Create an account
        </a>{' '}
        to get started.
      </p>
    </section>
  );
}
