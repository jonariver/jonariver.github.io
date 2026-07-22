/* ------------------------------------------------------------------ */
/* jsx/common-components.jsx – wiederverwendbare, generische UI-Bausteine */
/* ohne Seiten-/Domänenbezug. Wird über Babel-Standalone im Browser      */
/* verarbeitet (kein Bundler, kein Modulsystem, siehe CLAUDE.md). In     */
/* einer IIFE gekapselt, damit lokale Konstanten/Hilfsfunktionen nicht   */
/* unnötig global werden; öffentliche Oberfläche: window.FREILOTSE.ui.  */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { useState } = React;
  const t = window.I18N.t;

  /* Einklappbare Karte (Accordion) im Stil des Einfachmodus.
     Sanfte Height- und Fade-Animation über den CSS-Grid-Trick (0fr -> 1fr). */
  function CollapsibleCard({ icon, title, open, onToggle, dark, cardCls, children }) {
    return (
      <section className={`${cardCls} overflow-hidden`}>
        <button type="button" onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-bold flex items-center gap-2">
            <span aria-hidden="true">{icon}</span> {title}
          </span>
          <span className={`text-[10px] transition-transform duration-300 ${open ? "rotate-90" : ""} ${dark ? "text-slate-400" : "text-slate-500"}`}>
            ▶
          </span>
        </button>
        <div className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
          <div className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">{children}</div>
          </div>
        </div>
      </section>
    );
  }

  /* Kleines Info-Icon: die ausführliche Erklärung erscheint erst auf Klick */
  function InfoHint({ text, dark }) {
    const [show, setShow] = useState(false);
    return (
      <span className="inline">
        <button type="button" onClick={() => setShow(!show)} title={t("common.moreInfo")}
          className={`ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold align-middle ${
            dark ? "border-slate-600 text-slate-400 hover:bg-slate-800" : "border-slate-300 text-slate-500 hover:bg-slate-100"
          }`}>
          i
        </button>
        {show && (
          <span className={`mt-1 block text-[11px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}>{text}</span>
        )}
      </span>
    );
  }

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.ui = window.FREILOTSE.ui || {};
  Object.assign(window.FREILOTSE.ui, { CollapsibleCard, InfoHint });
})();
