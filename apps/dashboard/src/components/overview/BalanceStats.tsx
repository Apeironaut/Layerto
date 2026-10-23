import type { BalanceResponse } from '@layerto/types';
import { AnimatedNumber, ProgressBar, StatCard, usd } from '@layerto/ui';
import { dollarsToNumber } from '../../lib/money';

export interface BalanceStatsProps {
  balance: BalanceResponse | undefined;
  balanceLoading: boolean;
  callsThisMonth: number | undefined;
  spendThisMonth: string | undefined;
  usageLoading: boolean;
}

/** The four headline numbers: balance, free calls left, calls this month, spend this month. */
export function BalanceStats({
  balance,
  balanceLoading,
  callsThisMonth,
  spendThisMonth,
  usageLoading,
}: BalanceStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Balance"
        loading={balanceLoading}
        value={<AnimatedNumber value={dollarsToNumber(balance?.balance_usd)} format={(n) => `$${n.toFixed(2)}`} />}
        hint={balance ? `${usd(balance.balance_usd)} exactly · prepaid` : undefined}
      />
      <StatCard
        label="Free calls left"
        loading={balanceLoading}
        value={<AnimatedNumber value={balance?.free_calls_remaining ?? 0} />}
        hint={balance ? `${balance.free_calls_used} of ${balance.free_calls_limit} used` : undefined}
        footer={
          balance && (
            <ProgressBar
              label="Free calls used"
              current={balance.free_calls_used}
              max={balance.free_calls_limit}
            />
          )
        }
      />
      <StatCard
        label="Calls this month"
        loading={usageLoading}
        value={<AnimatedNumber value={callsThisMonth ?? 0} />}
        hint="Current UTC calendar month"
      />
      <StatCard
        label="Spend this month"
        loading={usageLoading}
        value={
          <AnimatedNumber
            value={dollarsToNumber(spendThisMonth)}
            format={(n) => `$${n.toFixed(4)}`}
          />
        }
        hint={spendThisMonth ? `${usd(spendThisMonth)} exactly` : undefined}
      />
    </div>
  );
}
