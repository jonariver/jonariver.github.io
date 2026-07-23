/* ------------------------------------------------------------------ */
/* locales/en.js – STRUKTURVORLAGE, NICHT AKTIV                        */
/* ------------------------------------------------------------------ */
/* Diese Datei ist NUR ein technisches Gerüst für eine spätere          */
/* englische Übersetzung. Sie wird aktuell NICHT geladen und NICHT      */
/* verwendet – die Anwendung läuft ausschließlich auf Deutsch.          */
/*                                                                      */
/* Sie ist bewusst NICHT in index.html eingebunden. Erst wenn später    */
/* ausdrücklich eine englische Übersetzung freigegeben wird, muss:      */
/*   1. diese Datei vollständig und korrekt ins Englische übersetzt,    */
/*   2. in index.html VOR app.jsx zusätzlich geladen und                */
/*   3. über window.I18N.registerLocale("en", EN) registriert werden.   */
/* Erst danach darf window.I18N.setLocale("en") aktiv nutzbar gemacht   */
/* und ein Sprachumschalter ergänzt werden – beides ist ausdrücklich    */
/* noch nicht Teil dieser Vorlage.                                      */
/* ------------------------------------------------------------------ */

(function () {
  "use strict";

  // ACHTUNG: Platzhalter-Struktur, Werte sind NICHT übersetzt und dürfen
  // in dieser Form niemals angezeigt werden. Struktur muss exakt zu
  // locales/de.js passen (gleiche Schlüssel, gleiche Funktionssignaturen).
  const EN_TEMPLATE_NOT_ACTIVE = null;

  // Einzelne, gezielt nachgetragene Schlüssel (jeweils ausdrücklich
  // beauftragt) – bewusst NUR diese, keine vollständige Übersetzung der
  // übrigen Datei. Rein vorbereitend: bleibt unregistriert und ohne jede
  // Wirkung auf die Anwendung (siehe Hinweis oben), aktiviert kein Englisch
  // und fügt keinen Sprachumschalter hinzu.
  const EN_PARTIAL_NOT_REGISTERED = {
    // Kalenderlegende "Freier Zeitraum" (siehe locales/de.js, legend.freePeriod)
    legend: { freePeriod: "Free period" },
    // Feiertagskennzahl, zählt nur Feiertage an persönlichen Arbeitstagen
    // innerhalb von result.periods (siehe locales/de.js, metrics.holidaysWorkdaysOnly)
    metrics: { holidaysWorkdaysOnly: "Public holidays on your workdays within your periods" },
  };
  void EN_PARTIAL_NOT_REGISTERED;

  // Bewusst: keine window.I18N.registerLocale(...)-Registrierung hier.
  // Diese Datei hat aktuell keinerlei Effekt auf die Anwendung.
  void EN_TEMPLATE_NOT_ACTIVE;
})();
