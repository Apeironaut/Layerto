import { useRoute } from '@layerto/ui';
import { SiteNavbar } from './components/layout/SiteNavbar';
import { SiteFooter } from './components/layout/SiteFooter';
import { LandingPage } from './pages/LandingPage';
import { DocsPage } from './pages/DocsPage';
import { ModelPage } from './pages/ModelPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage, PublicProjectView } from './pages/ProfilePage';
import { SitePage } from './pages/SitePage';
import { PaperPage, PapersPage } from './pages/PaperPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { PublicResearchStorefrontPage } from './pages/PublicResearchStorefrontPage';
import { ROOT_DOMAIN } from './config';

/** Subdomains that are never portfolios. */
const RESERVED_HOSTS = new Set(['www', 'app', 'api', 'admin', 'dashboard', 'docs', 'status', 'mail']);

function portfolioHost(): string | null {
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = host.slice(0, -ROOT_DOMAIN.length - 1);
  return sub && !sub.includes('.') && !RESERVED_HOSTS.has(sub) ? sub : null;
}
import { useModels } from './hooks/useModels';
import { useSiteBoot } from './hooks/useSiteBoot';

/** Public site: navbar + the page for the current path + footer. */
export default function App() {
  const [path, navigate] = useRoute();
  const models = useModels();
  useSiteBoot();

  // portfolio sites: <name>.layerto.com, or /portfolio/<name> as a preview
  const portfolio = portfolioHost() ?? path.match(/^\/portfolio\/([a-z0-9-]{3,32})\/?$/)?.[1];
  if (portfolio) return <PortfolioPage subdomain={portfolio} />;

  // model websites are full pages of their own, without the Layerto chrome
  const site = path.match(/^\/s\/([a-z0-9-]{3,40})\/?$/);
  if (site) return <SitePage slug={site[1]} />;

  const profile = path.match(/^\/@([a-zA-Z0-9_.-]{1,40})(?:\/([a-z0-9-]{1,80}))?\/?$/);

  let page;
  if (profile && profile[2]) page = <PublicProjectView username={profile[1]} slug={profile[2]} navigate={navigate} />;
  else if (profile) page = <ProfilePage username={profile[1]} navigate={navigate} />;
  else if (path === '/') page = <LandingPage navigate={navigate} models={models} />;
  else if (path === '/docs') page = <DocsPage />;
  else if (path === '/papers') page = <PapersPage navigate={navigate} />;
  else if (/^\/papers\/[0-9a-f-]{36}\/?$/.test(path)) page = <PaperPage id={path.split('/')[2]} navigate={navigate} />;
  else if (path === '/research') page = <PublicResearchStorefrontPage navigate={navigate} />;
  else if (path === '/privacy') page = <PrivacyPage />;
  else if (path.startsWith('/models/')) page = <ModelPage slug={path.slice('/models/'.length)} models={models} navigate={navigate} />;
  else page = <NotFoundPage navigate={navigate} />;

  return (
    <div className="flex flex-col min-h-screen bg-page text-ink selection:bg-crimson-tint selection:text-crimson">
      <SiteNavbar path={path} navigate={navigate} />
      <main className="flex-1 w-full">{page}</main>
      <SiteFooter navigate={navigate} />
    </div>
  );
}
