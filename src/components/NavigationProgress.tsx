"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOverlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRoute = useRef(true);
  const navigating = useRef(false);

  function clearTimers() {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showOverlayTimer.current) clearTimeout(showOverlayTimer.current);
    finishTimer.current = null;
    hideTimer.current = null;
    showOverlayTimer.current = null;
  }

  function start() {
    clearTimers();
    navigating.current = true;
    setActive(true);
    setVisible(false);
    setProgress(12);
    showOverlayTimer.current = setTimeout(() => setVisible(true), 180);
  }

  function done() {
    if (!navigating.current) return;
    navigating.current = false;
    clearTimers();
    setProgress(100);
    finishTimer.current = setTimeout(() => {
      setActive(false);
      setVisible(false);
      hideTimer.current = setTimeout(() => setProgress(0), 220);
    }, 180);
  }

  useEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return;
    }
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      start();
    };

    const onPopState = () => start();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!active || progress >= 90) return;
    const id = setInterval(() => {
      setProgress((value) => {
        if (value >= 90) return value;
        const step = value < 40 ? 8 : value < 70 ? 4 : 1.5;
        return Math.min(90, value + step);
      });
    }, 220);
    return () => clearInterval(id);
  }, [active, progress]);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
        aria-hidden
      >
        <div
          className="h-full origin-left bg-[var(--brand)] shadow-[0_0_8px_rgba(252,224,0,0.7)] transition-[width,opacity] duration-200 ease-out"
          style={{
            width: `${progress}%`,
            opacity: active || progress > 0 ? 1 : 0,
          }}
        />
      </div>

      {visible ? (
        <div
          className="pointer-events-none fixed inset-0 z-[90] flex items-start justify-center bg-white/35 pt-28 backdrop-blur-[1px] transition-opacity"
          role="status"
          aria-live="polite"
          aria-label="Загрузка страницы"
        >
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white/95 px-4 py-2.5 text-sm text-[var(--muted)] shadow-sm">
            <span className="nav-spinner h-4 w-4 shrink-0 rounded-full border-2 border-[var(--border)] border-t-[var(--link)]" />
            Загрузка…
          </div>
        </div>
      ) : null}
    </>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
