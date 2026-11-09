import { useEffect, useRef } from 'react';

/** Ruaj menjëherë kur faqja fshihet ose mbyllet (ndërrim aplikacioni, mbyllje skede). */
export function useFlushOnHide(flush: () => void): void {
  const ref = useRef(flush);
  ref.current = flush;
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') ref.current();
    };
    const onPageHide = () => ref.current();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
}
