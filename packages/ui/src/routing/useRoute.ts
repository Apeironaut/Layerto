import { useCallback, useSyncExternalStore } from 'react';

const NAV_EVENT = 'layerto:navigate';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

function prefersReducedMotion(): boolean {
  return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Scroll to an element id, respecting reduced motion. */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Minimal history-API router shared by all apps.
 * `navigate('/docs')` changes the page; `navigate('/#products')` goes home and scrolls to a section.
 */
export function useRoute(): [path: string, navigate: (to: string) => void] {
  const path = useSyncExternalStore(subscribe, () => window.location.pathname || '/', () => '/');

  const navigate = useCallback((to: string) => {
    const [pathname, hash] = to.split('#');
    const target = pathname || window.location.pathname;
    if (target !== window.location.pathname) {
      window.history.pushState({}, '', target);
      window.dispatchEvent(new Event(NAV_EVENT));
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    if (hash) {
      // wait one frame so the new page has rendered its sections
      requestAnimationFrame(() => scrollToId(hash));
    }
  }, []);

  return [path, navigate];
}
