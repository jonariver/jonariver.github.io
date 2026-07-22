/* ------------------------------------------------------------------ */
/* jsx/landing-page.jsx – Startansicht vor dem Planer (Einfach-/Profi-  */
/* Modus). Rein präsentational – nutzt ausschließlich Props der         */
/* Komponente Urlaubsplaner (dark, cardCls, Einstiegs-Handler). Keine   */
/* eigene Planungslogik, kein eigener State für Eingaben. Wird über     */
/* Babel-Standalone im Browser verarbeitet (kein Bundler, kein          */
/* Modulsystem, siehe CLAUDE.md). Muss NACH jsx/kofi-components.jsx     */
/* geladen werden (nutzt SiteFooter). In einer IIFE gekapselt;          */
/* öffentliche Oberfläche: window.FREILOTSE.ui.                        */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { useState, useEffect } = React;
  const t = window.I18N.t;
  const { SiteFooter } = window.FREILOTSE.ui;

  // Klick-Vorschau für das Erklärvideo der Landing Page: zeigt zunächst nur ein
  // YouTube-Vorschaubild mit Play-Button; der iframe (youtube-nocookie.com) wird
  // erst nach Klick eingebunden, damit vorher keine YouTube-Ressourcen laden.
  // Smartphone (< 640px, derselbe Mobile-Breakpoint wie in KofiFloatingButton)
  // erhält das Hochkantvideo, Tablet/Desktop das Querformatvideo – reaktiv über
  // matchMedia, damit z. B. eine Fenstergrößenänderung/-drehung korrekt umschaltet.
  function ExplainerVideoSection({ dark, cardCls }) {
    const MOBILE_QUERY = "(max-width: 639px)";
    const [isMobile, setIsMobile] = useState(() =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(MOBILE_QUERY).matches
        : false
    );
    useEffect(() => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      const mql = window.matchMedia(MOBILE_QUERY);
      const onChange = (e) => setIsMobile(e.matches);
      if (mql.addEventListener) mql.addEventListener("change", onChange);
      else mql.addListener(onChange); // Safari < 14
      return () => {
        if (mql.removeEventListener) mql.removeEventListener("change", onChange);
        else mql.removeListener(onChange);
      };
    }, []);

    const [played, setPlayed] = useState(false);
    // Bei Wechsel der Videovariante (z. B. Fenstergrößenänderung) wieder das
    // Vorschaubild zeigen statt den zuvor gestarteten iframe der anderen Variante.
    useEffect(() => { setPlayed(false); }, [isMobile]);

    // Vorschaubilder liegen lokal im Projekt (assets/video/), damit vor dem Klick
    // keine Verbindung zu YouTube/Google entsteht (siehe Datenschutzerklärung,
    // Abschnitt "Eingebettete YouTube-Videos").
    const video = isMobile
      ? { id: "Rw0EefsI4sk", ratio: "aspect-[9/16]", widthCls: "max-w-[320px] mx-auto",
          thumbnail: "./assets/video/explainer-mobile-Rw0EefsI4sk.jpg", title: t("landing.video.mobileIframeTitle") }
      : { id: "N1KzGRCX7XA", ratio: "aspect-[16/9]", widthCls: "",
          thumbnail: "./assets/video/explainer-desktop-N1KzGRCX7XA.jpg", title: t("landing.video.desktopIframeTitle") };
    const embedUrl = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1`;

    return (
      <section className="space-y-4">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-xl font-bold">{t("landing.video.heading")}</h2>
          <p className={`text-sm leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"}`}>
            {t("landing.video.description")}
          </p>
        </div>
        <div className={video.widthCls}>
          <div className={`${cardCls} relative w-full ${video.ratio} overflow-hidden`}>
            {played ? (
              <iframe
                src={embedUrl}
                title={video.title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <button type="button" onClick={() => setPlayed(true)}
                aria-label={t("landing.video.playButtonLabel")}
                className="group absolute inset-0 h-full w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset">
                <img src={video.thumbnail} alt={t("landing.video.thumbnailAlt")}
                  className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                  <span className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-105">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7 translate-x-0.5 fill-emerald-600">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  function LandingPage({ dark, setDark, cardCls, onStartSimple, onStartPro }) {
    const softTextCls = dark ? "text-slate-300" : "text-slate-600";
    const mutedTextCls = dark ? "text-slate-400" : "text-slate-500";
    const badgeCls = dark ? "bg-emerald-900/50 text-emerald-300" : "bg-emerald-100 text-emerald-700";

    return (
      <>
        <header className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
            <img src="./assets/logo/freilotse-logo-horizontal-dark-bg.svg" alt="FREILOTSE Urlaubsplaner"
              className="w-[165px] md:w-[200px] h-auto" />
            <button onClick={() => setDark(!dark)}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title={t("theme.toggleTitle")}>
              {dark ? t("theme.toLight") : t("theme.toDark")}
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-10 space-y-14">
          {/* Hero */}
          <section className="text-center max-w-2xl mx-auto space-y-4" style={{ animation: "upFade .35s ease" }}>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight [text-wrap:balance]">{t("landing.hero.heading")}</h2>
            <p className={`text-sm sm:text-base leading-relaxed ${softTextCls}`}>{t("landing.hero.description")}</p>
            <p className={`inline-block rounded-full px-4 py-2 text-sm font-semibold ${dark ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
              {t("landing.hero.example")}
            </p>
          </section>

          {/* Modus-Auswahl */}
          <section aria-labelledby="landing-modes-heading" className="space-y-4">
            <h2 id="landing-modes-heading" className={`text-center text-xs font-bold uppercase tracking-wide ${mutedTextCls}`}>
              {t("landing.modes.heading")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 items-stretch">
              {/* Einfach-Karte: visuell stärker hervorgehoben (primärer Einstieg) */}
              <div className={`${cardCls} p-6 flex flex-col gap-4 border-2 ${dark ? "border-emerald-600" : "border-emerald-500"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold">{t("landing.modes.simple.title")}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${badgeCls}`}>
                    {t("landing.modes.simple.badge")}
                  </span>
                </div>
                <p className={`text-sm ${softTextCls}`}>{t("landing.modes.simple.text")}</p>
                <ul className="text-sm space-y-1.5 flex-1">
                  {t("landing.modes.simple.benefits").map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-emerald-500">✓</span>
                      <span className={dark ? "text-slate-300" : "text-slate-700"}>{b}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={onStartSimple}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {t("landing.modes.simple.button")}
                </button>
              </div>

              {/* Profi-Karte */}
              <div className={`${cardCls} p-6 flex flex-col gap-4`}>
                <h3 className="text-lg font-bold">{t("landing.modes.pro.title")}</h3>
                <p className={`text-sm ${softTextCls}`}>{t("landing.modes.pro.text")}</p>
                <ul className="text-sm space-y-1.5 flex-1">
                  {t("landing.modes.pro.benefits").map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span aria-hidden="true" className={mutedTextCls}>✓</span>
                      <span className={dark ? "text-slate-300" : "text-slate-700"}>{b}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={onStartPro}
                  className={`w-full rounded-lg border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}>
                  {t("landing.modes.pro.button")}
                </button>
              </div>
            </div>
          </section>

          {/* Erklärvideo: Smartphone erhält ein Hochkantvideo (9:16), Tablet/Desktop
              ein Querformatvideo (16:9) – Auswahl rein per matchMedia anhand des
              im Projekt bereits verwendeten Mobile-Breakpoints (< 640px, siehe
              KofiFloatingButton). Es wird nie mehr als ein iframe gleichzeitig
              eingebunden; vor dem Klick nur ein statisches Vorschaubild. */}
          <ExplainerVideoSection dark={dark} cardCls={cardCls} />

          {/* Funktionsbereich */}
          <section className="space-y-4">
            <h2 className="text-center text-xl font-bold">{t("landing.features.heading")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {t("landing.features.items").map((f) => (
                <div key={f.title} className={`${cardCls} p-5 space-y-2`}>
                  <div className="text-2xl" aria-hidden="true">{f.icon}</div>
                  <h3 className="text-sm font-bold">{f.title}</h3>
                  <p className={`text-xs leading-relaxed ${mutedTextCls}`}>{f.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Ablauf: kompakte, verbundene Schrittfolge statt große Karten -
              unterscheidet sich dadurch bewusst vom Funktionsbereich oben. */}
          <section className="space-y-4">
            <h2 className="text-center text-xl font-bold">{t("landing.steps.heading")}</h2>
            <div role="list" className="flex flex-col sm:flex-row sm:items-start">
              {t("landing.steps.items").map((s, i, arr) => (
                <React.Fragment key={s.title}>
                  <div role="listitem" className="flex flex-col gap-1.5 sm:flex-1 sm:items-center sm:gap-2 sm:text-center sm:px-2">
                    <div className="flex items-center gap-2.5 sm:flex-col sm:gap-2">
                      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badgeCls}`}>
                        {i + 1}
                      </span>
                      <h3 className="text-sm font-bold">{s.title}</h3>
                    </div>
                    <p className={`text-xs leading-relaxed pl-[34px] sm:pl-0 ${mutedTextCls}`}>{s.text}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <>
                      {/* Desktop: dezente horizontale Verbindungslinie zwischen den Schritten */}
                      <div aria-hidden="true"
                        className={`hidden sm:block sm:flex-1 sm:mt-3 sm:h-px ${dark ? "bg-slate-700" : "bg-slate-300"}`} />
                      {/* Mobil: kurze vertikale Verbindung statt horizontaler Linie (kein Overflow) */}
                      <div aria-hidden="true"
                        className={`sm:hidden ml-[14px] h-3 w-px ${dark ? "bg-slate-700" : "bg-slate-300"}`} />
                    </>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Vertrauenshinweise */}
          <section className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs ${mutedTextCls}`}>
            {t("landing.trust.items").map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="text-emerald-500">✓</span> {item}
              </span>
            ))}
          </section>
        </main>

        {/* Einheitlicher Seitenabschluss – auch auf der Landingpage */}
        <SiteFooter dark={dark} />
      </>
    );
  }

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.ui = window.FREILOTSE.ui || {};
  Object.assign(window.FREILOTSE.ui, { ExplainerVideoSection, LandingPage });
})();
