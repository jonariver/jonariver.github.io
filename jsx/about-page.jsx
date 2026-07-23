/* ------------------------------------------------------------------ */
/* jsx/about-page.jsx – Seite „Über FREILOTSE" (/ueber-freilotse).      */
/* Anders als Impressum/Datenschutz bewusst OHNE „noindex" (soll        */
/* indexierbar sein) und mit eigenem, lokalem Dark/Light-Umschalter     */
/* (die Seite hängt nicht am Dark-State von Urlaubsplaner, da sie       */
/* eigenständig über App() geroutet wird). Wird über Babel-Standalone   */
/* im Browser verarbeitet (kein Bundler, kein Modulsystem, siehe        */
/* CLAUDE.md). Muss NACH jsx/kofi-components.jsx geladen werden (nutzt  */
/* SiteLink/SiteFooter/CoffeeIcon/KOFI_URL). In einer IIFE gekapselt;   */
/* öffentliche Oberfläche: window.FREILOTSE.ui.                        */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { useState, useEffect } = React;
  const t = window.I18N.t;
  const { SiteLink, SiteFooter, KOFI_URL } = window.FREILOTSE.ui;

  function AboutPage() {
    const [dark, setDark] = useState(true);

    // document.title + Meta-Description setzen und beim Verlassen wieder
    // herstellen (analog zum Robots-Meta-Muster in LegalLayout, hier aber
    // bewusst OHNE den Robots-Tag anzufassen, damit die Seite indexierbar bleibt).
    useEffect(() => {
      const previousTitle = document.title;
      document.title = t("about.documentTitle");

      let meta = document.querySelector('meta[name="description"]');
      const created = !meta;
      const previousContent = meta ? meta.getAttribute("content") : null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", t("about.metaDescription"));

      return () => {
        document.title = previousTitle;
        if (created) meta.remove();
        else if (previousContent === null) meta.removeAttribute("content");
        else meta.setAttribute("content", previousContent);
      };
    }, []);

    const softTextCls = dark ? "text-slate-300" : "text-slate-600";
    const mutedTextCls = dark ? "text-slate-400" : "text-slate-500";
    const cardCls = dark
      ? "bg-slate-900 border border-slate-800 rounded-xl shadow-sm"
      : "bg-white border border-slate-200 rounded-xl shadow-sm";

    return (
      <div className={`min-h-screen flex flex-col ${dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"}`}>
        <header className={dark ? "border-b border-slate-800 bg-slate-900" : "border-b border-slate-200 bg-white"}>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
            <SiteLink to="/" className={`font-bold tracking-tight ${dark ? "text-white hover:text-emerald-400" : "text-slate-900 hover:text-emerald-600"}`}>
              FREILOTSE
            </SiteLink>
            <div className="flex items-center gap-4">
              <SiteLink to="/" className={`text-sm ${dark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}>
                {t("about.backToPlanner")}
              </SiteLink>
              <button onClick={() => setDark(!dark)}
                title={t("theme.toggleTitle")}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}>
                {dark ? t("theme.toLight") : t("theme.toDark")}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <article className={`${cardCls} space-y-8 p-5 sm:p-8`}>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">{t("about.pageTitle")}</h1>
              <p className={`text-lg font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>{t("about.intro")}</p>
              <p className={`text-sm leading-7 ${softTextCls}`}>{t("about.body")}</p>
            </div>

            <section>
              <h2 className="mb-3 text-lg font-bold">{t("about.values.heading")}</h2>
              <ul className="space-y-2 text-sm">
                {t("about.values.items").map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-emerald-500">✓</span>
                    <span className={softTextCls}>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`space-y-4 rounded-lg p-5 ${dark ? "bg-slate-950/50 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}>
              <h2 className="text-lg font-bold">{t("about.support.heading")}</h2>
              <p className={`text-sm leading-7 ${softTextCls}`}>{t("about.support.text")}</p>
              <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" aria-label={t("about.support.buttonAriaLabel")}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {t("about.support.button")}
              </a>
            </section>

            <p className={`text-xs ${mutedTextCls}`}>
              {t("about.contact.prefix")}
              <a href="mailto:freilotse@outlook.de"
                className={`underline decoration-emerald-500/40 underline-offset-2 ${dark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-700"}`}>
                freilotse@outlook.de
              </a>
              {t("about.contact.suffix")}
            </p>
          </article>
        </main>

        <SiteFooter dark={dark} />
      </div>
    );
  }

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.ui = window.FREILOTSE.ui || {};
  Object.assign(window.FREILOTSE.ui, { AboutPage });
})();
