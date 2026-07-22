/* ------------------------------------------------------------------ */
/* js/data-sources.js – Anbindung externer Datenquellen (Feiertage-API,  */
/* OpenHolidays, schulferien-api.de): Netzwerkabruf, quellenspezifische  */
/* Normalisierung, Fallback-Orchestrierung, eindeutige Statuswerte. Kein */
/* React, keine Abhängigkeit von window.I18N. Wird unverändert per       */
/* <script src="js/data-sources.js"> geladen (kein Modulsystem, siehe    */
/* CLAUDE.md). Öffentliche Oberfläche: window.FREILOTSE.dataSources.     */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";

  /* --- Feiertage: feiertage-api.de (Primärquelle), integrierte          --- */
  /* --- Berechnung (js/calendar.js: holidayMap) bleibt unveränderter Fallback --- */

  // Fragt feiertage-api.de ab und liefert ein strukturiertes Ergebnis.
  // status "api": Abruf erfolgreich UND mindestens ein Feiertag enthalten.
  // status "lokal": HTTP-/Netzwerkfehler, kein gültiges JSON oder leeres
  // Ergebnis -> Aufrufer verwendet die integrierte Berechnung als Fallback.
  // Wirft nie – jeder Fehlerfall wird als { status: "lokal", holidays: null }
  // codiert, damit ein Ausfall nie zum Absturz führt.
  async function loadPublicHolidays(year, stateCode) {
    try {
      const r = await fetch(`https://feiertage-api.de/api/?jahr=${year}&nur_land=${stateCode}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const map = {};
      for (const [name, info] of Object.entries(json)) {
        if (!info || !info.datum) continue;
        if (name.toLowerCase().includes("augsburg")) continue; // gilt nur in der Stadt Augsburg
        const [yy, mm, dd] = info.datum.split("-").map((x) => parseInt(x, 10));
        if (yy === year && mm >= 1 && dd >= 1) map[`${mm - 1}-${dd}`] = name;
      }
      if (Object.keys(map).length === 0) throw new Error("keine Daten");
      return { status: "api", holidays: map };
    } catch (e) {
      return { status: "lokal", holidays: null };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Schulferien: Primärquelle OpenHolidays API, Ersatzquelle             */
  /* schulferien-api.de – beide werden unmittelbar nach dem Abruf auf     */
  /* ein gemeinsames internes Format normalisiert: { start, end, name,    */
  /* source }. "start"/"end" sind gültige ISO-Datumswerte, "end" ist bei  */
  /* BEIDEN Quellen inklusive (letzter Ferientag), sodass vacationDayMap()*/
  /* (js/calendar.js) unverändert bleiben kann.                          */
  /* ------------------------------------------------------------------ */

  // OpenHolidays SchoolHolidays liefert ein JSON-Array direkt (kein Wrapper-
  // Objekt), Felder u. a. startDate/endDate ("YYYY-MM-DD", ohne Uhrzeit -> von
  // JS als UTC-Mitternacht interpretiert, keine Zeitzonenverschiebung) sowie
  // name als Array [{ language, text }]. endDate ist INKLUSIVE: Einträge mit
  // nur einem Ferientag haben startDate === endDate (z. B. „Buß- und Bettag“),
  // was bei einem exklusiven Enddatum nicht möglich wäre.
  function normalizeOpenHolidaysPeriod(e) {
    if (!e || typeof e !== "object") return null;
    const start = typeof e.startDate === "string" ? e.startDate : null;
    const end = typeof e.endDate === "string" ? e.endDate : null;
    if (!start || !end) return null;
    const sd = new Date(start), ed = new Date(end);
    if (isNaN(sd) || isNaN(ed) || ed < sd) return null; // ungültigen Zeitraum verwerfen
    let name = null;
    if (Array.isArray(e.name)) {
      const de = e.name.find((n) => n && n.language === "DE" && typeof n.text === "string");
      const first = e.name.find((n) => n && typeof n.text === "string");
      name = (de || first || {}).text || null;
    }
    return { start, end, name, source: "openholidays" };
  }

  // schulferien-api.de (v1) liefert ein JSON-Array mit Feldern start/end
  // (ISO-Zeitstempel inkl. "Z", z. B. "2029-07-30T00:00Z" / "...T23:59Z" –
  // das Enddatum bezeichnet seit der v1-Datenkorrektur den tatsächlichen
  // letzten Ferientag, also ebenfalls INKLUSIVE) sowie name/name_cp.
  function normalizeSchulferienApiPeriod(e) {
    if (!e || typeof e !== "object") return null;
    const start = typeof e.start === "string" ? e.start : null;
    const end = typeof e.end === "string" ? e.end : null;
    if (!start || !end) return null;
    const sd = new Date(start), ed = new Date(end);
    if (isNaN(sd) || isNaN(ed) || ed < sd) return null;
    const name = (typeof e.name_cp === "string" && e.name_cp) || (typeof e.name === "string" && e.name) || null;
    return { start, end, name, source: "schulferien-api" };
  }

  function fetchOpenHolidaysResponse(year, st) {
    // Interne Bundeslandcodes (z. B. "BY") bleiben unverändert; nur für diese
    // eine Anfrage wird daraus der OpenHolidays-Subdivision-Code "DE-BY".
    const url = `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-${st}&languageIsoCode=DE&validFrom=${year}-01-01&validTo=${year}-12-31`;
    return fetch(url);
  }
  function fetchSchulferienApiResponse(year, st) {
    return fetch(`https://schulferien-api.de/api/v1/${year}/${st}/`);
  }

  // Fragt eine einzelne Quelle ab und unterscheidet dabei klar zwischen
  // "technisch nicht erreichbar" (Netzwerkfehler oder HTTP-Fehlerstatus) und
  // "erreichbar, aber ohne verwertbare Daten" (Antwort kam an, war jedoch kein
  // gültiges Array, enthielt nur ungültige Einträge oder schlicht keine Ferien
  // für Jahr+Bundesland). Wirft nie – Fehler werden immer als Ergebnis codiert,
  // damit ein Ausfall nie zum Absturz führt.
  async function trySchoolHolidaySource(requestFn, normalizeFn) {
    let response;
    try {
      response = await requestFn();
    } catch (e) {
      return { reachable: false, periods: [] }; // Netzwerkfehler o. Ä.
    }
    if (!response || !response.ok) return { reachable: false, periods: [] }; // HTTP-Fehler
    let json;
    try {
      json = await response.json();
    } catch (e) {
      return { reachable: true, periods: [] }; // Antwort kam an, kein gültiges JSON
    }
    if (!Array.isArray(json)) return { reachable: true, periods: [] }; // kein gültiges Array
    const periods = json.map(normalizeFn).filter(Boolean); // ungültige Einträge verwerfen
    return { reachable: true, periods };
  }

  // Orchestriert Primär- und Ersatzquelle gemäß der geforderten Strategie:
  // 1) OpenHolidays versuchen; liefert es Daten, werden diese verwendet.
  // 2) Sonst (nicht erreichbar, HTTP-Fehler, kein Array, nur ungültige
  //    Einträge oder schlicht keine Ferien) schulferien-api.de versuchen.
  // 3) Liefert auch die Ersatzquelle nichts: "keine" (mind. eine Quelle war
  //    erreichbar) oder "fehler" (beide technisch nicht erreichbar).
  async function loadSchoolHolidays(year, st) {
    const primary = await trySchoolHolidaySource(() => fetchOpenHolidaysResponse(year, st), normalizeOpenHolidaysPeriod);
    if (primary.periods.length > 0) return { status: "openholidays", periods: primary.periods };

    const fallback = await trySchoolHolidaySource(() => fetchSchulferienApiResponse(year, st), normalizeSchulferienApiPeriod);
    if (fallback.periods.length > 0) return { status: "ersatz", periods: fallback.periods };

    if (primary.reachable || fallback.reachable) return { status: "keine", periods: [] };
    return { status: "fehler", periods: [] };
  }

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.dataSources = {
    loadPublicHolidays,
    loadSchoolHolidays,
    normalizeOpenHolidaysPeriod,
    normalizeSchulferienApiPeriod,
  };
})();
