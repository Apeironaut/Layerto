import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, cn } from '@layerto/ui';

/** FAQ: short, factual answers. One item open at a time. */
const QUESTIONS = [
  {
    q: 'What is Charon, and can I use it yet?',
    a: 'Charon is our control layer for AI agents. It checks each action an agent wants to take against your rules, asks a person when needed, and records the result. It is in development and not available yet.',
  },
  {
    q: 'Do you store my images?',
    a: 'Images you send to the API are not stored: they are held in memory only while the model runs, and the ledger keeps only a SHA-256 hash, size and type. Images you upload to a Studio dataset for training are encrypted at rest and, unless you turn on “Keep dataset”, deleted a few days after training. You can delete them any time.',
  },
  {
    q: 'How does Auto pick a model?',
    a: 'It looks for keywords in your prompt and matches them against routing rules set by our team; the highest-priority match wins. Prompts are optional; without one, Auto uses a general model.',
  },
  {
    q: 'What happens if a call fails?',
    a: 'The amount reserved for the call is refunded automatically. A free call that fails does not use up your free quota.',
  },
  {
    q: 'How do I get access?',
    a: 'Create an account in the dashboard. During early access each account is approved by the Layerto team; then you can create API keys right away.',
  },
  {
    q: 'Can I use my own model?',
    a: 'Yes, with Layerto Studio. Upload and label your images, train an LTVision detector (free in your own Colab or Kaggle notebook, or on Layerto GPUs), and it gets its own API endpoint. You can also import LTVision weights you trained elsewhere; their metrics are marked as reported by you.',
  },
  {
    q: 'How do creator rewards work?',
    a: 'Publish a model you trained to the marketplace. After a quick review, anyone with a Layerto key can call it, and a share of every paid call by someone else is added to your balance as credit. You can spend it on calls, training and plans. Cash payouts are planned for later.',
  },
  {
    q: 'Who is the hub for, and what does each plan include?',
    a: 'Researchers get a research workspace (papers, experiments, findings, notes, reading list) with 1 GB free and paid plans for more. Photographers get a seller plan for image datasets. Builders and companies get projects, training and model APIs; enterprise plans add teams. Students can start free. Plans unlock sections; anything not in your plan shows what would unlock it.',
  },
  {
    q: 'How does buying an image dataset work?',
    a: 'Each dataset shows previews, label counts and its license before you buy. After paying from your balance you import it into any of your projects and train on it directly. The license travels with the data: models trained on research-only data cannot be sold or get public websites.',
  },
  {
    q: 'What is a portfolio site?',
    a: 'A small add-on for research plans: a personal site at yourname.layerto.com that lists your published papers, public models, projects and confirmed findings, kept up to date from your workspace.',
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className={cn('rounded-l2 border bg-card transition-colors', open ? 'border-crimson-border' : 'border-line')}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left text-base sm:text-lg font-semibold cursor-pointer"
        >
          {q}
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-crimson">
            <Icon name="plus" size={20} />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 sm:px-6 pb-5 text-ink-secondary max-w-[70ch]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SceneFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" aria-labelledby="faq-title" className="w-full bg-card py-[12vh] px-[2vw]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 px-[2vw]">
        <div>
          <h2 id="faq-title" className="text-3xl sm:text-5xl font-bold tracking-tight">
            Questions
          </h2>
          <p className="mt-3 text-muted text-base sm:text-lg">The things people ask first.</p>
        </div>
        <div className="flex flex-col gap-3">
          {QUESTIONS.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
