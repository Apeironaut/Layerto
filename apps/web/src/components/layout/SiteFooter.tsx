import { LayertoLogo } from '@layerto/ui';
import { DASHBOARD_URL } from '../../config';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Layerto Vision', to: '/#products' },
      { label: 'Layerto Studio', to: '/#studio' },
      { label: 'Pricing', to: '/#pricing' },
      { label: 'Charon (coming soon)', to: '/#products' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', to: '/docs' },
      { label: 'Dashboard', to: DASHBOARD_URL, external: true },
      { label: 'How it works', to: '/#how-it-works' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/#about' },
      { label: 'FAQ', to: '/#faq' },
      { label: 'Privacy', to: '/privacy' },
    ],
  },
];

export function SiteFooter({ navigate }: { navigate: (to: string) => void }) {
  return (
    <footer className="w-full border-t border-line bg-card px-5 sm:px-10 pt-14 pb-8">
      <div className="flex flex-col lg:flex-row justify-between gap-12">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <LayertoLogo size={40} />
            <span className="text-xl font-bold">Layerto</span>
          </div>
          <p className="mt-4 text-sm text-muted">
            The layer between your software and AI. Layerto Vision and Charon, with access control and a
            tamper-evident ledger behind every call.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-ink mb-3">{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.to}
                      onClick={
                        'external' in l
                          ? undefined
                          : (e) => {
                              e.preventDefault();
                              navigate(l.to);
                            }
                      }
                      className="text-muted hover:text-crimson transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {/* TODO(owner): add a contact email once one is set up. */}
      <div className="mt-12 pt-6 border-t border-line flex flex-wrap justify-between gap-3 text-xs text-muted">
        <span>© {new Date().getFullYear()} Layerto by Apeironaut</span>
      </div>
    </footer>
  );
}
