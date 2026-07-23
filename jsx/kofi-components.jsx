/* ------------------------------------------------------------------ */
/* jsx/kofi-components.jsx – Site-Chrome (interne Navigation, Footer)   */
/* und Ko-fi-Unterstützungskomponenten. Wird über Babel-Standalone im   */
/* Browser verarbeitet (kein Bundler, kein Modulsystem, siehe           */
/* CLAUDE.md). In einer IIFE gekapselt; öffentliche Oberfläche:         */
/* window.FREILOTSE.ui.                                                 */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { useState, useEffect, useRef } = React;
  const t = window.I18N.t;

  /* Rechtliche Seiten + Navigation                                      */
  /* ------------------------------------------------------------------ */

  function internalNavigate(event, path) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function SiteLink({ to, children, className = "" }) {
    return <a href={to} onClick={(event) => internalNavigate(event, to)} className={className}>{children}</a>;
  }

  const KOFI_URL = "https://ko-fi.com/freilotse";
  const KOFI_ARIA_LABEL = "FREILOTSE über Ko-fi mit einem Kaffee unterstützen";
  const KOFI_LABEL_TEXT = "Supporte FREILOTSE mit einem Kaffee";
  const KOFI_HINT_TEXT = "Hat dir FREILOTSE geholfen? Unterstütze das Projekt ☕";

  function CoffeeIcon({ className = "" }) {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16"
        className={className} fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8h12a1 1 0 0 1 1 1v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V9a1 1 0 0 1 1-1Z" />
        <path d="M17 10h1a3 3 0 0 1 0 6h-1" />
        <path d="M8 2.5c-.3.8-1 1-1 2s.7 1.2 1 2" />
        <path d="M12 2.5c-.3.8-1 1-1 2s.7 1.2 1 2" />
      </svg>
    );
  }

  function KofiFooterLink({ dark }) {
    return (
      <a href={KOFI_URL} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          dark ? "bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}>
        <CoffeeIcon />
        FREILOTSE unterstützen
      </a>
    );
  }

  function KofiFloatingButton({ planReady, path }) {
    const [interactiveExpanded, setInteractiveExpanded] = useState(false);
    const [autoExpanded, setAutoExpanded] = useState(false);
    const canHoverRef = useRef(false);
    const autoShownRef = useRef(false);
    const delayTimerRef = useRef(null);
    const hideTimerRef = useRef(null);
    const pathRef = useRef(path);

    useEffect(() => {
      canHoverRef.current = typeof window.matchMedia === "function"
        && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    }, []);

    // Aktuellen Pfad in einem Ref nachführen, damit der verzögerte Timer beim
    // Auslösen den Pfad zu diesem Zeitpunkt prüfen kann (nicht den Pfad, der
    // beim Start der 1 Minute galt).
    useEffect(() => { pathRef.current = path; }, [path]);

    // Timer beim Unmounten der Seite sauber aufräumen (separat von der
    // Auslöse-Logik, damit ein Cleanup nicht bei jeder Prop-Änderung feuert).
    useEffect(() => () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }, []);

    useEffect(() => {
      if (!planReady || autoShownRef.current) return;
      if (path === "/impressum" || path === "/datenschutz" || path === "/ueber-freilotse") return;
      // Einmaliger 1-Minuten-Timer nach dem ersten sichtbaren Planungsergebnis;
      // sofort gesperrt, damit eine erneute Berechnung keinen zweiten Timer
      // startet.
      autoShownRef.current = true;
      delayTimerRef.current = setTimeout(() => {
        delayTimerRef.current = null;
        if (pathRef.current === "/impressum" || pathRef.current === "/datenschutz" || pathRef.current === "/ueber-freilotse") return;
        // Auf schmalen Smartphone-Displays wird der automatische Hinweis
        // unterdrückt, da der längere Hinweistext dort Inhalte verdecken
        // könnte; Tippen öffnet Ko-fi weiterhin direkt (unverändertes
        // Verhalten).
        if (typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 640px)").matches) return;
        setAutoExpanded(true);
        hideTimerRef.current = setTimeout(() => setAutoExpanded(false), 7000);
      }, 1 * 60 * 1000);
    }, [planReady, path]);

    const expanded = interactiveExpanded || autoExpanded;

    return (
      <>
        <style>{`
          .kofi-fab { position: fixed; right: 0; top: 50%; transform: translateY(-50%); }
          @media (max-width: 639px) {
            .kofi-fab { top: auto; transform: none; bottom: max(1.25rem, env(safe-area-inset-bottom)); }
          }
          .kofi-fab-label {
            display: inline-block; max-width: 0; margin-left: 0; opacity: 0; overflow: hidden; white-space: nowrap;
            transition: max-width .3s ease, opacity .25s ease, margin-left .3s ease;
          }
          .kofi-fab-label.is-expanded { max-width: 440px; opacity: 1; margin-left: .5rem; }
          @media (prefers-reduced-motion: reduce) {
            .kofi-fab-label { transition: none; }
          }
        `}</style>
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" aria-label={KOFI_ARIA_LABEL}
          onMouseEnter={() => { if (canHoverRef.current) setInteractiveExpanded(true); }}
          onMouseLeave={() => { if (canHoverRef.current) setInteractiveExpanded(false); }}
          onFocus={() => setInteractiveExpanded(true)}
          onBlur={() => setInteractiveExpanded(false)}
          className="kofi-fab z-30 flex items-center overflow-hidden rounded-l-full border border-r-0 border-emerald-400/30 bg-slate-900 py-3 pl-3 pr-3 text-white shadow-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <CoffeeIcon className="shrink-0 text-emerald-400" />
          <span className={`kofi-fab-label text-sm font-semibold${expanded ? " is-expanded" : ""}`}>
            {autoExpanded ? KOFI_HINT_TEXT : KOFI_LABEL_TEXT}
          </span>
        </a>
      </>
    );
  }

  function SiteFooter({ dark = true }) {
    const muted = dark ? "text-slate-400" : "text-slate-500";
    const hover = dark ? "hover:text-white" : "hover:text-slate-900";
    return (
      <footer className={`border-t ${dark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
        <div className={`mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between ${muted}`}>
          <p>© {new Date().getFullYear()} FREILOTSE</p>
          <nav aria-label="Rechtliches und Unterstützung" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SiteLink to="/impressum" className={hover}>Impressum</SiteLink>
            <SiteLink to="/datenschutz" className={hover}>Datenschutz</SiteLink>
            <SiteLink to="/ueber-freilotse" className={hover}>{t("about.footerLink")}</SiteLink>
            <KofiFooterLink dark={dark} />
          </nav>
        </div>
      </footer>
    );
  }

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.ui = window.FREILOTSE.ui || {};
  Object.assign(window.FREILOTSE.ui, {
    internalNavigate, SiteLink, CoffeeIcon, KofiFooterLink, KofiFloatingButton, SiteFooter, KOFI_URL,
  });
})();
