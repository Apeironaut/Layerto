import type { Step } from './steps';

/** One step: explanation and key points on the left, the code on the right. */
export function StepCard({ step }: { step: Step }) {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
      <div>
        <div className="flex items-baseline gap-4">
          <span className="text-6xl sm:text-8xl font-bold text-crimson leading-none" aria-hidden="true">
            {step.n}
          </span>
          <h3 id={`how-${step.n}`} className="text-2xl sm:text-4xl font-bold tracking-tight">
            <span className="sr-only">Step {step.n}: </span>
            {step.title}
          </h3>
        </div>
        <p className="mt-5 text-base sm:text-lg text-ink-secondary max-w-[48ch] leading-relaxed">{step.body}</p>
        <ul className="mt-5 space-y-2">
          {step.points.map((p) => (
            <li key={p} className="flex gap-3 text-sm text-ink-secondary">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
              <span className="[&_code]:font-mono">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <pre className="p-5 rounded-l2 bg-[#15161A] text-[#ECEDEF] font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre">{step.code}</pre>
    </div>
  );
}
