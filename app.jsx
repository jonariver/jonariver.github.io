const { useEffect, useMemo, useRef, useState } = React;

// Zentrale Übersetzungsfunktion (siehe locales/de.js, dort vor app.jsx geladen).
const t = window.I18N.t;

/* ------------------------------------------------------------------ */
/* Daten: Bundesländer, Feiertage                                      */
/* ------------------------------------------------------------------ */

// Anzeigenamen kommen aus der Locale; die Codes (Schlüssel) selbst sind
// sprachunabhängig und werden u. a. für die Share-Link-Validierung benötigt.
const STATES = t("states");
const STATE_CODES = Object.keys(STATES);

const MONTHS = t("months");
const DOWS = t("weekdaysApiOrder");

/* ------------------------------------------------------------------ */
/* Ausgelagerte Module (kein Modulsystem -> window.FREILOTSE.*-Namespaces, */
/* siehe js/planning.js, js/calendar.js, js/data-sources.js,                */
/* js/share-link.js sowie CLAUDE.md, Abschnitt „Architektur/Module").       */
/* Nur die tatsächlich in app.jsx direkt genutzten Namen werden hier        */
/* zurückgeholt, um keine unnötigen globalen Bindungen zu erzeugen.         */
/* ------------------------------------------------------------------ */
const { plan, minimalBridgeBudget } = window.FREILOTSE.planning;
const { DAY, buildDays, vacationDayMap } = window.FREILOTSE.calendar;
const { loadPublicHolidays, loadSchoolHolidays } = window.FREILOTSE.dataSources;
const {
  SHARE_MAX_URL, SHARE_MAX_DECODED, HAS_COMPRESSION,
  buildSharePayload, encodePlain, validateSharePayload, decodeShare,
  readShareFragment, deflateToB64url, inflateFromB64url,
} = window.FREILOTSE.shareLink;
// jsx/common-components.jsx, jsx/kofi-components.jsx, jsx/landing-page.jsx
// und jsx/legal-pages.jsx müssen vor app.jsx geladen sein (siehe index.html).
const {
  CollapsibleCard, InfoHint,
  SiteFooter, KofiFloatingButton,
  LandingPage,
  ImpressumPage, DatenschutzPage,
} = window.FREILOTSE.ui;

/* ------------------------------------------------------------------ */
/* Hilfen fürs Rendering                                               */
/* ------------------------------------------------------------------ */

const fmtNum = (x) => (x % 1 === 0 ? String(x) : x.toFixed(1).replace(".", ","));
// Wie fmtNum, aber mit bis zu ZWEI Nachkommastellen (für den Überstunden-Rechner:
// Stunden/Tagesstunden ergibt selten ein glattes Halb-/Ganztages-Vielfaches).
// Rundet nur auf 2 Nachkommastellen, nicht zusätzlich auf halbe/ganze Tage.
const fmtNum2 = (x) => {
  let s = x.toFixed(2);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
};
const fmtDate = (day) => `${DOWS[day.dow]} ${String(day.d).padStart(2, "0")}.${String(day.m + 1).padStart(2, "0")}.`;
// Reines Datumsformat "DD.MM." aus einem UTC-Timestamp (Tag-genau), fuer die
// Monatszusammenfassung (Feiertage/Schulferien) unter den Monatskarten.
const fmtDDMM = (ts) => {
  const dt = new Date(ts);
  return `${String(dt.getUTCDate()).padStart(2, "0")}.${String(dt.getUTCMonth() + 1).padStart(2, "0")}.`;
};

function dayClass(day, selType, showWeekendHolidays, dark) {
  if (selType === "vac") return "bg-emerald-600 text-white";
  if (selType === "ot") return "bg-sky-600 text-white";
  if (day.holiday) {
    if (day.weekend) {
      if (!showWeekendHolidays) return dark ? "bg-slate-800 text-slate-600" : "bg-slate-200 text-slate-400";
      return dark ? "bg-rose-900/70 text-rose-300" : "bg-rose-200 text-rose-800";
    }
    return "bg-rose-600 text-white";
  }
  if (day.special && day.cost === 0 && !day.weekend) return dark ? "bg-amber-400 text-amber-950" : "bg-amber-300 text-amber-900";
  if (day.special && day.cost === 0.5) return dark ? "bg-amber-900/70 text-amber-300" : "bg-amber-100 text-amber-800";
  // Echtes Kalenderwochenende behält bewusst IMMER das bestehende Wochenend-
  // Styling, auch wenn Samstag/Sonntag laut individueller Arbeitswoche
  // tatsächlich ein persönlicher Arbeitstag ist (z. B. Di–Sa) – die konkrete
  // Belegung/Kosten sind dann trotzdem über selType (grün/blau) bzw. den
  // Tooltip (dayTitle) erkennbar.
  if (day.weekend) return dark ? "bg-slate-800 text-slate-600" : "bg-slate-200 text-slate-400";
  // Persönlicher regulärer freier Werktag (kein echtes Wochenende, aber laut
  // workingWeekdays trotzdem arbeitsfrei) – eigenes, aber verwandtes Styling
  // (gleiche gedämpfte Farbfamilie wie Wochenende, gestrichelter Rahmen zur
  // Unterscheidung), siehe Legende "Regelmäßig frei".
  if (!day.isWorkingDay) {
    return dark
      ? "bg-slate-800/60 text-slate-500 border border-dashed border-slate-700"
      : "bg-slate-100 text-slate-400 border border-dashed border-slate-300";
  }
  return dark ? "bg-slate-800 text-slate-200 border border-slate-600" : "bg-white text-slate-700 border border-slate-200";
}

// Mariä Himmelfahrt (15.8.) ist in Bayern gesetzlich nur in Gemeinden mit
// überwiegend katholischer Bevölkerung ein Feiertag, nicht landesweit – anders
// als bei allen übrigen Feiertagen kann das weder die lokale Berechnung noch
// (mangels Gemeinde-Granularität) eine externe Feiertags-API abbilden. Die
// Erkennung erfolgt bewusst über Datum + Bundesland statt über den
// Feiertagsnamen-String, damit sie unabhängig von der exakten Schreibweise der
// jeweils aktiven Quelle (lokale Berechnung oder externe API) funktioniert.
const isBavarianPartialAssumptionDay = (day, st) => st === "BY" && day.m === 7 && day.d === 15 && !!day.holiday;
const withAssumptionDayCaveat = (name, day, st) =>
  isBavarianPartialAssumptionDay(day, st) ? `${name} ${t("holidayCaveats.assumptionDayInline")}` : name;

function dayTitle(day, selType, st, inPeriod) {
  const parts = [fmtDate(day)];
  if (day.holiday) parts.push(withAssumptionDayCaveat(day.holiday, day, st));
  if (day.special) parts.push(day.special);
  // Nur dort ergänzen, wo die reine Zellfarbe allein nicht eindeutig wäre:
  // ein echtes Wochenende behält sein Styling auch als persönlicher Arbeitstag
  // (siehe dayClass), daher hier explizit klarstellen; ein regelmäßig freier
  // Werktag hat bereits eine eigene, unterscheidbare Zellfarbe (siehe dayClass/
  // Legende "Regelmäßig frei") – der Tooltip ergänzt es trotzdem knapp.
  if (day.weekend && day.isWorkingDay) parts.push(t("calendar.personalWorkday"));
  else if (!day.weekend && !day.isWorkingDay) parts.push(t("legend.regularlyOff"));
  if (selType === "vac") parts.push(t("dayType.vacation"));
  else if (selType === "ot") parts.push(t("dayType.overtime"));
  // "Freier Zeitraum" nur ergänzen, wenn dadurch keine unnötige Wiederholung
  // entsteht: ein eingesetzter Urlaubs-/Überstundentag sagt über selType
  // bereits eindeutig, dass er Teil der Planung ist; für die "verbindenden"
  // Tage eines Zeitraums (Wochenende, Feiertag, regelmäßig frei) ohne selType
  // liefert der Hinweis dagegen echten Mehrwert (dieser Tag gehört zu einem
  // größeren, geplanten freien Block statt isoliert zu stehen).
  if (inPeriod && !selType) parts.push(t("legend.freePeriod"));
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function Urlaubsplaner({ onPlanReady }) {
  const currentYear = new Date().getFullYear();
  // Geteilte Planung EINMAL aus dem URL-Fragment lesen, bevor die States
  // initialisiert werden. Das alte #plan=-Format wird synchron dekodiert und
  // fließt direkt in die useState-Initialwerte (kein Flackern, keine Race).
  // Das neue #p=-Format ist deflate-komprimiert und lässt sich nur asynchron
  // (DecompressionStream) lesen; es wird daher erst im Mount-Effekt angewendet.
  const sharedRef = useRef(undefined);
  if (sharedRef.current === undefined) {
    const frag = readShareFragment(typeof window !== "undefined" ? window.location.hash : "");
    const parsed = frag && frag.type === "plan" ? decodeShare(frag.raw, STATE_CODES) : null;
    sharedRef.current = { frag, parsed, had: !!frag };
  }
  const shared = sharedRef.current.parsed ? sharedRef.current.parsed.state : null;

  const [year, setYear] = useState(shared ? shared.year : currentYear);
  const [dark, setDark] = useState(true); // Dark-Mode ist Standard, umschaltbar im Kopfbereich
  const [st, setSt] = useState(shared ? shared.st : "BY");
  const [vac, setVac] = useState(shared ? shared.vac : 30);
  const [ot, setOt] = useState(shared ? shared.ot : 0);
  const [xmasRule, setXmasRule] = useState(shared ? shared.xmasRule : "50"); // Standard: halber Urlaubstag am 24./31.12.
  const [showWeekendHolidays, setShowWeekendHolidays] = useState(shared ? shared.showWeekendHolidays : true);
  // Regelmäßige Arbeitstage – gemeinsamer Zustand für Einfach- UND Profi-Modus
  // (siehe CLAUDE.md, Abschnitt „Regelmäßige Arbeitstage"). Format: Array von
  // Date.getUTCDay()-Indizes (0=So…6=Sa), Standard Montag–Freitag. NUR für
  // dauerhaft gleichbleibende Wochenmuster – keine wechselnden Schichten.
  const [workingWeekdays, setWorkingWeekdays] = useState(shared ? shared.workingWeekdays : [1, 2, 3, 4, 5]);
  const [blocks, setBlocks] = useState(shared ? shared.blocks : []);
  // Budget der automatischen Verteilung; "" = automatisch das Minimum nutzen
  const [autoVac, setAutoVac] = useState(shared ? shared.autoVac : "");
  const [autoOt, setAutoOt] = useState(shared ? shared.autoOt : "0");
  const [spendFirst, setSpendFirst] = useState(shared ? shared.spendFirst : "vac"); // "vac" | "ot"
  const [autoFrom, setAutoFrom] = useState(shared ? shared.autoFrom : 0); // Automatik plant ab diesem Monat (0 = Januar)
  // Schulferien-Präferenz – gemeinsame Variable für Einfach- UND Profi-Modus
  const [schoolHolidayPreference, setSchoolHolidayPreference] = useState(shared ? shared.schoolHolidayPreference : "neutral"); // prefer | avoid | neutral
  // Manuelles Planen per Klick im Kalender
  const [clickMode, setClickMode] = useState("vac"); // Klick setzt "vac" | "ot"
  // Manuelle Tage aus dem Link mit dem geteilten Jahr rekonstruieren ("jahr:m-d").
  const [overrides, setOverrides] = useState(() => {
    if (!shared) return {};
    const o = {};
    for (const [md, val] of Object.entries(shared.overridesMd || {})) o[`${shared.year}:${md}`] = val;
    return o;
  }); // "jahr:m-d" -> "vac" | "ot" | "none"
  // Teilen-UI: kurze Bestätigung (Toast) und Fallback-Dialog zum manuellen Kopieren
  const [toast, setToast] = useState(null);
  const [copyUrl, setCopyUrl] = useState(null);
  const toastTimer = useRef(null);
  const shareUrlRef = useRef(null); // vorab erzeugter (komprimierter) Link – für Safari/iOS-Aktivierung
  const [dialogDay, setDialogDay] = useState(null); // Index des angeklickten geplanten Tags
  const [drag, setDrag] = useState(null); // { anchor, current } während einer Zieh-Auswahl
  const [vacTip, setVacTip] = useState(null); // { text } – Ferien-Info per Antippen (mobil)
  // Übergeordnete Ansicht: "landing" (Startansicht) | "loading" (kurzer,
  // neutraler Zwischenzustand) | "planner" (bestehende Einfach-/Profi-
  // Ansicht). Reines Rendering – kein Reset bestehender Eingaben beim
  // Wechsel, nicht Teil des Share-Link-Payloads. Ein bereits synchron
  // erkannter gültiger Share-Link (altes #plan=-Format) überspringt die
  // Landing Page direkt. Das neue, komprimierte #p=-Format lässt sich nur
  // asynchron dekomprimieren; damit dabei nicht kurz die Landing Page
  // aufblitzt, startet die Ansicht in diesem Fall auf "loading" und
  // schaltet erst nach der asynchronen Validierung auf "planner" (Erfolg)
  // oder "landing" (ungültig/fehlgeschlagen) um (siehe Mount-Effekt unten).
  const [view, setView] = useState(() => {
    if (shared) return "planner";
    if (sharedRef.current.had && sharedRef.current.frag.type === "p") return "loading";
    return "landing";
  });
  // Einfach-/Profi-Modus: neuer UI-Modus, die Logik bleibt unverändert
  const [uiMode, setUiMode] = useState(shared ? shared.uiMode : "einfach"); // "einfach" | "profi"
  const [simpleGoal, setSimpleGoal] = useState(shared ? shared.simpleGoal : "free"); // free | blocks | short
  const [simpleStarted, setSimpleStarted] = useState(shared ? shared.simpleStarted : false);
  const [showSimpleCal, setShowSimpleCal] = useState(false);
  // Nur lokaler UI-Zustand (Einfachmodus): ist die Wochentags-Auswahl gerade
  // aufgeklappt? Nicht Teil von workingWeekdays selbst, nicht im Share-Link.
  const [showWorkingDaysEditor, setShowWorkingDaysEditor] = useState(false);
  // Mobilfreundliche Kalender-Navigation: Zielmonat, der nach dem Sprung kurz
  // hervorgehoben wird, und ein wartender Zielmonat, falls der Kalender im
  // Einfachmodus erst noch eingeblendet werden muss. Gemeinsam für beide Modi.
  const [highlightedMonth, setHighlightedMonth] = useState(null);
  const [scrollTarget, setScrollTarget] = useState(null); // { month, period } | null
  const monthRefs = useRef([]); // DOM-Referenzen der 12 Monats-Container (Index = Monat 0-basiert)
  const highlightTimerRef = useRef(null);
  // Temporäre, deutlich stärkere Hervorhebung des konkret angeklickten
  // Zeitraums (zusätzlich zur Monatskarten-Hervorhebung oben). Speichert nur
  // { s, e } – die Gültigkeit wird bei jedem Render gegen das aktuelle
  // result.periods geprüft (siehe highlightedPeriodRange weiter unten), damit
  // nach einer Neuberechnung (z. B. manuelles Entfernen) nie eine veraltete
  // Markierung stehen bleibt.
  const [highlightedPeriod, setHighlightedPeriod] = useState(null);
  const periodHighlightTimerRef = useRef(null);
  // Eingeklappte Bereiche gelten nur für die aktuelle Sitzung im React-State;
  // Standard: mobil nur "Allgemein" offen. Keine Browser-Persistenz.
  const [panels, setPanels] = useState(() => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return { allgemein: true, regelung: !mobile, auto: !mobile, bloecke: !mobile };
  });
  const togglePanel = (key) => {
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Überstunden-Rechner (nur Profi-Modus): rechnet Stunden in Überstundentage
  // um (Stunden ÷ Stunden pro Arbeitstag). Rein lokale UI-Hilfe – beeinflusst
  // "ot" (Überstundenabbau in Tagen) erst, wenn "übernehmen" geklickt wird.
  // Alle Werte sind transient und werden nicht im Browser gespeichert.
  const [showOtCalc, setShowOtCalc] = useState(false);
  const [otCalcHours, setOtCalcHours] = useState("");
  const [otCalcHoursPerDay, setOtCalcHoursPerDay] = useState("8");
  const updateOtCalcHoursPerDay = setOtCalcHoursPerDay;
  // Bewusst kein Fallback wie bei num(): negative Eingaben sollen hier als
  // ungültig erkannt werden statt still auf 0 zu fallen.
  const parseLooseNumber = (v) => (v === "" || v == null ? NaN : parseFloat(String(v).replace(",", ".")));
  const otCalcHoursNum = parseLooseNumber(otCalcHours);
  const otCalcHpdNum = parseLooseNumber(otCalcHoursPerDay);
  const otCalcValid = Number.isFinite(otCalcHoursNum) && otCalcHoursNum >= 0 &&
    Number.isFinite(otCalcHpdNum) && otCalcHpdNum > 0;
  // Nur auf 2 Nachkommastellen gerundet (keine unnötige Rundung auf halbe/ganze Tage).
  const otCalcResult = otCalcValid ? Math.round((otCalcHoursNum / otCalcHpdNum) * 100) / 100 : null;
  const applyOtCalc = () => {
    if (otCalcResult === null) return;
    setOt(otCalcResult);
  };

  // Dokumenttitel aus der aktiven Locale setzen (aktuell nur Deutsch; der
  // statische Titel in index.html dient dabei als initialer Fallback, bevor
  // dieser Effekt beim ersten Render greift). Rein informativ/technisch –
  // beeinflusst weder Layout noch Planungslogik. Bei einer späteren
  // Sprachumschaltung muss hier zusätzlich document.documentElement.lang
  // aktualisiert werden (siehe CLAUDE.md, Abschnitt „Internationalisierung
  // und UI-Texte").
  useEffect(() => {
    document.title = t("common.documentTitle");
  }, []);

  // Beim Fokussieren eines Zahlenfelds den gesamten Wert markieren,
  // damit der Nutzer direkt lostippen kann statt erst zu löschen
  const selectAllOnFocus = (e) => e.target.select();

  const num = (v, fallback = 0) => {
    const x = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(x) && x >= 0 ? x : fallback;
  };

  // Feiertage bevorzugt von der öffentlichen API beziehen (feiertage-api.de).
  // Schlägt der Abruf fehl (offline, blockiert), greift die integrierte Berechnung.
  const [apiHolidays, setApiHolidays] = useState(null);
  const [apiStatus, setApiStatus] = useState("laedt"); // "laedt" | "api" | "lokal"
  useEffect(() => {
    // Solange ein #p=-Link noch dekomprimiert wird, stehen year/st noch auf
    // Standardwerten – erst nach Anwendung des geteilten Zustands (oder nach
    // dessen Scheitern) mit den dann gültigen Werten abfragen.
    if (view === "loading") return;
    let ignore = false;
    setApiStatus("laedt");
    setApiHolidays(null);
    loadPublicHolidays(year, st).then((result) => {
      if (ignore) return;
      setApiHolidays(result.holidays);
      setApiStatus(result.status);
    });
    return () => { ignore = true; };
  }, [year, st, view]);

  const days = useMemo(() => buildDays(year, st, xmasRule, apiHolidays, t, workingWeekdays),
    [year, st, xmasRule, apiHolidays, workingWeekdays]);

  // Schulferien: Primärquelle OpenHolidays API, automatische Ersatzquelle
  // schulferien-api.de (siehe loadSchoolHolidays() oben). Nur Planungshinweis
  // bzw. Präferenz-Gewichtung – fließt NICHT direkt in plan() ein, sondern nur
  // über die weiter unten abgeleitete effektive Präferenz. Ergebnisse (inkl.
  // tatsächlich verwendeter Quelle/Status) werden pro Kombination aus Jahr und
  // Bundesland zwischengespeichert.
  const [vacations, setVacations] = useState([]); // normalisierte Zeiträume { start, end, name, source }
  const [vacStatus, setVacStatus] = useState("laedt"); // "laedt" | "openholidays" | "ersatz" | "keine" | "fehler"
  const vacCache = useRef({}); // { "jahr-kürzel": { periods, status } } – vermeidet doppelte Aufrufe
  useEffect(() => {
    // Siehe Kommentar bei der Feiertags-API oben: während "loading" stehen
    // year/st noch auf Standardwerten.
    if (view === "loading") return;
    let ignore = false;
    const cacheKey = `${year}-${st}`;
    const cached = vacCache.current[cacheKey];
    if (cached) {
      setVacations(cached.periods);
      setVacStatus(cached.status);
      return;
    }
    setVacStatus("laedt");
    setVacations([]);
    (async () => {
      const result = await loadSchoolHolidays(year, st);
      if (ignore) return; // Jahr/Bundesland wurde zwischenzeitlich gewechselt
      vacCache.current[cacheKey] = result;
      setVacations(result.periods);
      setVacStatus(result.status);
    })();
    return () => { ignore = true; };
  }, [year, st, view]);

  // Ferien-Tagesmap fürs sichtbare Jahr (beide Modi nutzen dieselben Daten)
  const vacationDays = useMemo(() => vacationDayMap(vacations, year, t), [vacations, year]);
  // Echte Daten liegen nur vor, wenn eine Quelle erfolgreich UND mit Inhalt
  // geladen wurde – ein leeres, aber technisch erfolgreiches Ergebnis zählt
  // ausdrücklich NICHT als "Daten vorhanden" (siehe vacStatus "keine").
  const hasVacationData = (vacStatus === "openholidays" || vacStatus === "ersatz") && vacations.length > 0;
  // Ohne Daten – auch WÄHREND des Ladens – darf die gewählte Präferenz keinen
  // Einfluss auf die Berechnung haben; die Auswahl selbst (schoolHolidayPreference)
  // bleibt dabei unverändert erhalten, nur die für plan() verwendete effektive
  // Präferenz wird auf "neutral" erzwungen.
  const effectiveSchoolHolidayPreference = hasVacationData ? schoolHolidayPreference : "neutral";
  const schoolPrefOptionsDisabled = vacStatus === "laedt" || vacStatus === "keine" || vacStatus === "fehler";
  const schoolHolidayNotice =
    vacStatus === "keine" ? t("schoolHolidays.notice.noData", { state: STATES[st], year })
    : vacStatus === "fehler" ? t("schoolHolidays.notice.unreachable")
    : null;


  const yearOverrides = useMemo(() => {
    const o = {};
    for (const [k, v] of Object.entries(overrides)) {
      const [y, md] = k.split(":");
      if (parseInt(y, 10) === year) o[md] = v;
    }
    return o;
  }, [overrides, year]);
  const minBudget = useMemo(() => minimalBridgeBudget(days, autoFrom), [days, autoFrom]);
  const effAutoVac = autoVac === "" ? minBudget : num(autoVac);
  const effAutoOt = num(autoOt);

  const result = useMemo(() => {
    const cfg = {
      vac: num(vac), ot: num(ot),
      autoVac: Math.min(effAutoVac, num(vac)),
      autoOt: Math.min(effAutoOt, num(ot)),
      spendFirst,
      autoFromMonth: autoFrom,
      schoolHolidayPreference: effectiveSchoolHolidayPreference,
      vacationDays: hasVacationData && effectiveSchoolHolidayPreference !== "neutral" ? vacationDays : null,
      overrides: yearOverrides,
      blocks: blocks
        .filter((b) => num(b.len) >= 1)
        .map((b) => ({
          len: num(b.len),
          month: b.month === "" ? null : parseInt(b.month, 10),
          ot: b.ot === "" ? null : num(b.ot),
        })),
    };
    return plan(days, cfg);
  }, [days, vac, ot, blocks, effAutoVac, effAutoOt, spendFirst, autoFrom, yearOverrides, effectiveSchoolHolidayPreference, hasVacationData, vacationDays]);

  // Zuordnung Tag-Index -> Zeitraum, EINMAL aus result.periods abgeleitet
  // (Single Source of Truth, keine doppelte Berechnung, kein eigener
  // persistenter State) – aktualisiert sich automatisch bei jeder
  // Neuberechnung von result (z. B. nach manuellem Entfernen eines Tages).
  // isStart/isEnd steuern die abgerundeten Ecken des Freizeitbands im Kalender.
  const periodDayInfo = useMemo(() => {
    const map = new Map();
    for (const p of result.periods) {
      for (let k = p.s; k <= p.e; k++) map.set(k, { isStart: k === p.s, isEnd: k === p.e });
    }
    return map;
  }, [result.periods]);

  // Ko-fi-Hinweis: einmalig pro Seitenaufruf, sobald erstmals ein echtes
  // Planungsergebnis mit mindestens einem Urlaubsblock sichtbar ist (Einfach-
  // Modus: nach Klick auf "Beste Planung berechnen"; Profi-Modus: sobald das
  // Ergebnis, das dort ohnehin live berechnet wird, Blöcke enthält). Löst
  // weder auf der Landing Page noch bei leerem Ergebnis aus.
  const firstPlanShownRef = useRef(false);
  useEffect(() => {
    if (firstPlanShownRef.current || view !== "planner") return;
    const hasBlocks = result.periods.length > 0;
    const ready = (uiMode === "einfach" && simpleStarted && hasBlocks) || (uiMode === "profi" && hasBlocks);
    if (!ready) return;
    firstPlanShownRef.current = true;
    if (onPlanReady) onPlanReady();
  }, [view, uiMode, simpleStarted, result.periods.length, onPlanReady]);

  // Single Source of Truth: Beide Modi nutzen dieselben States und dasselbe
  // Ergebnis. Der Einfachmodus übersetzt das gewählte Ziel direkt in die
  // gemeinsamen Einstellungen (Wunschblöcke + Auto-Budget) – dadurch ist der
  // Profi-Modus immer korrekt vorausgefüllt und umgekehrt, und ein
  // Moduswechsel löst keine Neuberechnung aus.
  const applySimpleGoal = (goal) => {
    setSimpleGoal(goal);
    if (goal === "free") {
      // Möglichst viele freie Tage: keine Blöcke, volles Budget für Brückentage.
      // "9999" wird durch die bestehende Deckelung immer auf die Urlaubstage begrenzt.
      setBlocks([]);
      setAutoVac("9999");
    } else if (goal === "blocks") {
      // Lange Urlaubsblöcke: zwei große Wunschblöcke, Automatik auf Minimum ("")
      setBlocks([{ len: 16, month: "", ot: "" }, { len: 9, month: "", ot: "" }]);
      setAutoVac("");
    } else if (goal === "short") {
      // Viele Kurzurlaube: vier verlängerte Wochenenden, Rest in Brückentage
      setBlocks([
        { len: 4, month: "", ot: "" }, { len: 4, month: "", ot: "" },
        { len: 4, month: "", ot: "" }, { len: 4, month: "", ot: "" },
      ]);
      setAutoVac("9999");
    }
  };

  // Einstieg von der Landing Page: nur uiMode + view wechseln, keine
  // vorhandenen Eingaben zurücksetzen (identische Jahres-Korrektur wie beim
  // bestehenden Einfach-/Profi-Umschalter im Planer-Header).
  const goToPlanner = (mode) => {
    setUiMode(mode);
    if (mode === "einfach" && year > currentYear + 2) setYear(currentYear);
    setView("planner");
  };

  const ovrKey = (day) => `${year}:${day.m}-${day.d}`;
  const dragAppliedRef = useRef(false); // unterdrückt den Klick direkt nach einer Zieh-Auswahl

  // Zieh-Auswahl über Pointer-Events (funktioniert mit Maus UND Touch):
  // Bewegung wird global verfolgt, beim Loslassen werden alle markierten,
  // noch ungeplanten Arbeitstage im Bereich mit dem gewählten Tagestyp belegt.
  useEffect(() => {
    if (drag === null) return;
    const move = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el && el.closest ? el.closest("[data-dayindex]") : null;
      if (cell) {
        const i = parseInt(cell.getAttribute("data-dayindex"), 10);
        setDrag((d) => (d && d.current !== i ? { ...d, current: i } : d));
      }
    };
    const up = () => {
      setOverrides((prev) => {
        const next = { ...prev };
        const lo = Math.min(drag.anchor, drag.current);
        const hi = Math.max(drag.anchor, drag.current);
        for (let i = lo; i <= hi; i++) {
          const day = days[i];
          if (!day || day.cost === 0) continue; // frei -> nichts zu planen
          if (result.sel[i]) continue; // bereits geplante Tage nicht überschreiben
          next[`${year}:${day.m}-${day.d}`] = clickMode;
        }
        return next;
      });
      dragAppliedRef.current = true;
      setDrag(null);
    };
    const cancel = () => setDrag(null); // abgebrochene Geste: nichts übernehmen
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag, days, result, year, clickMode]);

  const onDayClick = (day) => {
    if (day.cost === 0) return; // Wochenenden/Feiertage sind nicht planbar
    if (result.sel[day.i]) { setDialogDay(day.i); return; } // geplanter Tag -> Dialog
    setOverrides({ ...overrides, [ovrKey(day)]: clickMode }); // leerer Arbeitstag -> setzen
  };
  const applyDialog = (action) => {
    if (dialogDay === null) return;
    const day = days[dialogDay];
    const cur = result.sel[dialogDay];
    if (action === "remove") setOverrides({ ...overrides, [ovrKey(day)]: "none" });
    if (action === "swap") setOverrides({ ...overrides, [ovrKey(day)]: cur === "vac" ? "ot" : "vac" });
    setDialogDay(null);
  };

  /* --- Teilen --- */
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // Nur aktuelle Eingaben serialisieren; ableitbare Daten (Feiertage,
  // Schulferien, Plan) bleiben draußen. yearOverrides = manuelle Tage des Jahres.
  const currentSharePayload = () =>
    buildSharePayload({
      year, st, vac: num(vac), ot: num(ot), xmasRule,
      uiMode, simpleGoal, simpleStarted, schoolHolidayPreference,
      autoVac, autoOt, spendFirst, autoFrom, showWeekendHolidays,
      blocks, overridesMd: yearOverrides, workingWeekdays,
    });
  const shareBaseUrl = () => `${window.location.origin}${window.location.pathname}`;

  // Synchroner Fallback: unkomprimierter #plan=-Link (immer verfügbar).
  const buildShareUrl = () => `${shareBaseUrl()}#plan=${encodePlain(currentSharePayload())}`;

  // Bevorzugt der kompakte, komprimierte #p=-Link. Ohne CompressionStream
  // (oder bei Fehler) automatisch der alte #plan=-Weg.
  const buildShareUrlCompressed = async () => {
    const payload = currentSharePayload();
    if (HAS_COMPRESSION) {
      try { return `${shareBaseUrl()}#p=${await deflateToB64url(JSON.stringify(payload))}`; }
      catch (e) { /* auf #plan= zurückfallen */ }
    }
    return `${shareBaseUrl()}#plan=${encodePlain(payload)}`;
  };

  // Geteilten (validierten) Zustand auf die States anwenden – nur für den
  // asynchronen #p=-Pfad; #plan= ist bereits in den Initialwerten enthalten.
  const applySharedState = (s) => {
    setYear(s.year); setSt(s.st); setVac(s.vac); setOt(s.ot); setXmasRule(s.xmasRule);
    setUiMode(s.uiMode); setSimpleGoal(s.simpleGoal); setSimpleStarted(s.simpleStarted);
    setSchoolHolidayPreference(s.schoolHolidayPreference);
    setAutoVac(s.autoVac); setAutoOt(s.autoOt); setSpendFirst(s.spendFirst);
    setAutoFrom(s.autoFrom); setShowWeekendHolidays(s.showWeekendHolidays); setBlocks(s.blocks);
    setWorkingWeekdays(s.workingWeekdays);
    const o = {};
    for (const [md, val] of Object.entries(s.overridesMd || {})) o[`${s.year}:${md}`] = val;
    setOverrides(o);
  };

  const handleShare = async () => {
    // Vorab erzeugten (i. d. R. komprimierten) Link nutzen, damit vor
    // navigator.share/clipboard KEIN await steht – sonst verliert u. a. Safari
    // die User-Aktivierung. Fehlt der Vorab-Link, synchron den #plan=-Fallback.
    let url = shareUrlRef.current;
    if (!url) { try { url = buildShareUrl(); } catch (e) { showToast(t("share.toast.createFailed")); return; } }
    if (url.length > SHARE_MAX_URL) { showToast(t("share.toast.tooLong")); return; }
    const shareData = {
      title: t("share.nativeTitle", { year }),
      text: t("share.nativeText", { year, state: STATES[st] }),
      url,
    };
    // 1) Nativer Teilen-Dialog (Mobil/unterstützte Geräte)
    if (typeof navigator !== "undefined" && navigator.share &&
        (!navigator.canShare || navigator.canShare(shareData))) {
      try { await navigator.share(shareData); return; }
      catch (e) { if (e && e.name === "AbortError") return; /* sonst Fallback */ }
    }
    // 2) Clipboard-API
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(url); showToast(t("share.toast.linkCopied")); return; }
      catch (e) { /* Fallback */ }
    }
    // 3) Manuelles Kopieren anbieten
    setCopyUrl(url);
  };

  const copyFromModal = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(copyUrl);
      } else {
        const inp = document.getElementById("share-url-input");
        if (inp) { inp.focus(); inp.select(); document.execCommand("copy"); }
      }
      showToast(t("share.toast.linkCopied"));
      setCopyUrl(null);
    } catch (e) {
      showToast(t("share.toast.copyManually"));
    }
  };

  // Den (komprimierten) Teilen-Link vorab im Hintergrund erzeugen, sobald sich
  // relevante Eingaben ändern. So liegt er beim Klick synchron bereit.
  useEffect(() => {
    // Solange ein #p=-Link noch dekomprimiert wird, stehen die Eingaben noch
    // auf Standardwerten – noch keinen (falschen) Vorab-Link dafür bauen.
    if (view === "loading") return;
    let cancelled = false;
    (async () => {
      try {
        const url = await buildShareUrlCompressed();
        if (!cancelled) shareUrlRef.current = url;
      } catch (e) { if (!cancelled) shareUrlRef.current = null; }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, st, vac, ot, xmasRule, uiMode, simpleGoal, simpleStarted,
      schoolHolidayPreference, autoVac, autoOt, spendFirst, autoFrom,
      showWeekendHolidays, workingWeekdays, blocks, yearOverrides, view]);

  // Beim Start: geteilte Planung anwenden (bei #p= asynchron dekomprimieren),
  // Hinweis zeigen und das Fragment aus der Adresszeile entfernen (sauberes
  // erneutes Teilen/Reload).
  useEffect(() => {
    const info = sharedRef.current;
    const clearFragment = () => {
      try { window.history.replaceState(null, "", window.location.pathname + window.location.search); }
      catch (e) { /* z. B. sandboxed Vorschau */ }
    };
    const toastFor = (res) => showToast(
      !res ? t("share.toast.loadFailed")
        : res.warning ? t("share.toast.loadedPartially")
        : t("share.toast.loadedFully")
    );
    if (!info || !info.had) {
      return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
    }
    if (info.frag.type === "plan") {
      // Bereits synchron in die Initialwerte geflossen – nur Hinweis + aufräumen.
      toastFor(info.parsed);
      clearFragment();
      return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
    }
    // info.frag.type === "p": komprimiert -> asynchron dekomprimieren + anwenden
    let cancelled = false;
    (async () => {
      let res = null;
      try {
        if (info.frag.raw.length <= SHARE_MAX_DECODED) {
          const json = await inflateFromB64url(info.frag.raw);
          res = validateSharePayload(json, STATE_CODES);
        }
      } catch (e) { res = null; }
      if (cancelled) return;
      if (res && res.state) { applySharedState(res.state); setView("planner"); }
      else setView("landing"); // ungültig/fehlgeschlagen -> aus "loading" zur Landing Page
      toastFor(res);
      clearFragment();
    })();
    return () => { cancelled = true; if (toastTimer.current) clearTimeout(toastTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Export eines freien Zeitraums als Kalendereintrag (ganztägig, Ende exklusiv)
  const ymdOf = (day) => `${year}${String(day.m + 1).padStart(2, "0")}${String(day.d).padStart(2, "0")}`;
  const ymdAfter = (day) => {
    const dt = new Date(Date.UTC(year, day.m, day.d) + DAY);
    return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
  };
  const exportInfo = (p) => {
    const dtStart = ymdOf(days[p.s]);
    const dtEnd = ymdAfter(days[p.e]); // exklusiv, iCalendar-Standard
    const desc = t("exportCal.icsDescription", { len: p.len, vac: fmtNum(p.vac), ot: fmtNum(p.ot), otRaw: p.ot });
    return { dtStart, dtEnd, desc };
  };
  const googleUrl = (p) => {
    const { dtStart, dtEnd, desc } = exportInfo(p);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t("exportCal.eventTitle"))}` +
      `&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(desc)}`;
  };
  const downloadIcs = async (p) => {
    const { dtStart, dtEnd, desc } = exportInfo(p);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Urlaubsplaner//DE",
      "BEGIN:VEVENT",
      `UID:urlaubsplaner-${year}-${p.s}-${p.e}@local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${t("exportCal.eventTitle")}`,
      `DESCRIPTION:${desc.replace(/([,;])/g, "\\$1")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const fileName = `urlaub-${dtStart}.ics`;
    // iPhone/iPad: natives Teilen-Menü öffnen -> von dort direkt in den iOS-Kalender
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS && typeof File !== "undefined" && navigator.canShare) {
      try {
        const file = new File([ics], fileName, { type: "text/calendar" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: t("exportCal.eventTitle") });
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return; // Nutzer hat das Teilen abgebrochen
        // sonst: normaler Download als Fallback
      }
    }
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const usedVac = num(vac) - result.budget.vac;
  const usedOt = num(ot) - result.budget.ot;
  const totalFree = result.periods.reduce((a, p) => a + p.len, 0);
  const periodCount = result.periods.length;
  const longest = result.periods.reduce((a, p) => Math.max(a, p.len), 0);
  const leverage = usedVac + usedOt > 0 ? totalFree / (usedVac + usedOt) : 0;
  // Nur Feiertage INNERHALB der vorgeschlagenen freien Zeiträume zählen, nicht
  // das gesamte Kalenderjahr – sonst wäre die Kennzahl unabhängig davon, ob die
  // Planung diese Feiertage überhaupt nutzt. Ein Feiertag "spart" bzw. "nutzt"
  // dabei nur dann etwas, wenn er auf einen PERSÖNLICHEN regulären Arbeitstag
  // fällt (isWorkingDay) – ein Feiertag an einem regelmäßig freien Wochentag
  // hätte ohnehin keinen Urlaubstag gekostet. Getrennt davon: echte
  // Wochenendfeiertage (Sa/So) werden nur zusätzlich angezeigt (Checkbox
  // "Feiertage an Samstag/Sonntag einbeziehen"), unabhängig vom Wochenplan –
  // ohne die "&& !isWorkingDay"-Einschränkung würde ein Feiertag an einem
  // persönlichen Arbeits-Samstag (z. B. Di–Sa) doppelt gezählt.
  const countHolidaysInPeriods = (predicate) => result.periods.reduce((sum, p) => {
    let c = 0;
    for (let k = p.s; k <= p.e; k++) if (days[k].holiday && predicate(days[k])) c++;
    return sum + c;
  }, 0);
  const periodWorkingDayHolidayCount = countHolidaysInPeriods((d) => d.isWorkingDay);
  const periodWeekendHolidayCount = countHolidaysInPeriods((d) => d.weekend && !d.isWorkingDay);

  const addBlock = () => setBlocks([...blocks, { len: 9, month: "", ot: "" }]);
  const updBlock = (i, patch) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const delBlock = (i) => setBlocks(blocks.filter((_, j) => j !== i));

  const inputCls = dark
    ? "w-full rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    : "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = `block text-xs font-semibold uppercase tracking-wide ${dark ? "text-slate-400" : "text-slate-500"} mb-1`;
  const cardCls = dark ? "bg-slate-900 border border-slate-800 rounded-xl shadow-sm" : "bg-white rounded-xl shadow-sm";
  const subLabelCls = `text-xs font-semibold uppercase tracking-wide ${dark ? "text-slate-400" : "text-slate-600"}`;

  // Regelmäßige Arbeitstage – EIN gemeinsamer Zustand (workingWeekdays) und
  // EIN Rendering für Einfach- UND Profi-Modus. Reine UI-/Ableitungslogik;
  // greift nicht in plan()/buildDays() selbst ein (das übernimmt der bereits
  // an buildDays() übergebene workingWeekdays-State weiter oben).
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Anzeige Mo..So (Woche beginnt Montag, wie im Kalender)
  const weekdayFullNames = t("weekdaysFullApiOrder"); // Index = Date.getUTCDay()
  const isDefaultWorkweek = workingWeekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => workingWeekdays.includes(d));
  const toggleWorkingWeekday = (dow) => {
    setWorkingWeekdays((prev) => {
      if (prev.includes(dow)) {
        if (prev.length <= 1) return prev; // mindestens ein Arbeitstag muss ausgewählt bleiben
        return prev.filter((d) => d !== dow);
      }
      return [...prev, dow].sort((a, b) => a - b);
    });
  };
  const resetWorkingWeekdays = () => setWorkingWeekdays([1, 2, 3, 4, 5]);
  // Zusammenfassungstext: erkennt eine lückenlose Kette in der Mo..So-Reihenfolge
  // ("Montag bis Freitag"/"Dienstag bis Samstag") und fällt sonst auf eine
  // einfache Aufzählung zurück (z. B. "Dienstag, Donnerstag").
  const workingWeekdaysSummary = () => {
    if (isDefaultWorkweek) return t("workingDays.defaultSummary");
    const ordered = WEEKDAY_ORDER.filter((d) => workingWeekdays.includes(d));
    const idxs = ordered.map((d) => WEEKDAY_ORDER.indexOf(d));
    const contiguous = ordered.length > 1 && idxs.every((v, i) => i === 0 || v === idxs[i - 1] + 1);
    if (contiguous) {
      return t("workingDays.summaryRange", { from: weekdayFullNames[ordered[0]], to: weekdayFullNames[ordered[ordered.length - 1]] });
    }
    return t("workingDays.summaryList", { days: ordered.map((d) => weekdayFullNames[d]) });
  };
  // Sieben Wochentags-Schaltflächen (Mo..So), identisch in Einfach- und
  // Profi-Modus. aria-pressed macht den Auswahlzustand für Screenreader
  // eindeutig; Kurzform (DOWS) sichtbar, voller Name als aria-label.
  const workingWeekdayButtons = () => (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("workingDays.question")}>
      {WEEKDAY_ORDER.map((dow) => {
        const active = workingWeekdays.includes(dow);
        return (
          <button key={dow} type="button"
            aria-pressed={active}
            aria-label={weekdayFullNames[dow]}
            onClick={() => toggleWorkingWeekday(dow)}
            className={`h-9 min-w-[2.75rem] px-2 rounded-md text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              active
                ? "bg-emerald-600 border-emerald-600 text-white"
                : dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}>
            {DOWS[dow]}
          </button>
        );
      })}
    </div>
  );

  // Schulferien-Präferenz – EIN Markup für beide Modi (kein doppelter Erklärtext).
  // withHint=true zeigt zusätzlich den kurzen Hilfetext (nur im Profi-Modus nötig).
  // Ohne verwendbare Daten (bzw. während des Ladens) werden die Optionen sichtbar
  // deaktiviert; die getroffene Auswahl bleibt dabei unverändert erhalten
  // (siehe effectiveSchoolHolidayPreference weiter oben).
  const schoolPrefControl = (withHint) => (
    <div>
      <span className={`block ${subLabelCls} mb-1`}>{t("schoolHolidays.question")}</span>
      <div className={`space-y-2 ${schoolPrefOptionsDisabled ? "opacity-50" : ""}`}>
        {[["prefer", t("schoolHolidays.preference.prefer")], ["avoid", t("schoolHolidays.preference.avoid")], ["neutral", t("schoolHolidays.preference.neutral")]].map(([k, l]) => (
          <label key={k}
            title={schoolPrefOptionsDisabled ? t("schoolHolidays.optionsDisabledTitle") : undefined}
            className={`flex items-center gap-2 text-sm ${
              schoolPrefOptionsDisabled ? "cursor-not-allowed" : "cursor-pointer"
            } ${dark ? "text-slate-300" : "text-slate-700"}`}>
            <input type="radio" name="schoolPref" className="accent-emerald-600"
              disabled={schoolPrefOptionsDisabled}
              checked={schoolHolidayPreference === k}
              onChange={() => setSchoolHolidayPreference(k)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {withHint && (
        <p className={`mt-1 text-[11px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}>
          {t("schoolHolidays.hint")}
        </p>
      )}
      {schoolHolidayNotice && (
        <p className={`mt-1 text-[11px] leading-snug font-semibold ${dark ? "text-orange-300/90" : "text-orange-700"}`}>
          {schoolHolidayNotice}
        </p>
      )}
    </div>
  );

  // Mobilfreundliche Navigation: von einem empfohlenen Zeitraum weich zum
  // passenden Monat im Kalender springen. EINE Quelle für Einfach- UND
  // Profi-Modus; greift NICHT in plan()/die Kernberechnung, den Share-Link
  // oder gespeicherte Daten ein – reines Rendering/Scrolling. Hebt zusätzlich
  // zur Monatskarte auch den konkret angeklickten Zeitraum kurz stärker hervor.
  const performScroll = (m, period) => {
    const el = monthRefs.current[m];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedMonth(m);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedMonth(null), 1800);
    if (period) {
      setHighlightedPeriod({ s: period.s, e: period.e });
      if (periodHighlightTimerRef.current) clearTimeout(periodHighlightTimerRef.current);
      periodHighlightTimerRef.current = setTimeout(() => setHighlightedPeriod(null), 2000);
    }
  };
  // Wartet im Einfachmodus, bis der Kalender nach setShowSimpleCal(true)
  // tatsächlich gerendert ist (monthRefs gefüllt), bevor gescrollt wird.
  useEffect(() => {
    if (scrollTarget === null) return;
    if (uiMode === "einfach" && !showSimpleCal) return; // erst wenn der Kalender sichtbar ist
    const id = requestAnimationFrame(() => {
      performScroll(scrollTarget.month, scrollTarget.period);
      setScrollTarget(null);
    });
    return () => cancelAnimationFrame(id);
  }, [scrollTarget, showSimpleCal, uiMode]);
  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (periodHighlightTimerRef.current) clearTimeout(periodHighlightTimerRef.current);
  }, []);
  // Gültigkeit erst beim Rendern gegen das AKTUELLE result.periods prüfen
  // (nicht nur beim Auslösen): ändert sich die Planung während der ~2s
  // Anzeige (z. B. manuelles Entfernen), verschwindet eine dadurch veraltete
  // Hervorhebung automatisch, statt falsche Tage weiter zu markieren.
  const highlightedPeriodValid = highlightedPeriod
    && result.periods.some((p) => p.s === highlightedPeriod.s && p.e === highlightedPeriod.e);
  const scrollToPeriod = (p) => {
    const targetMonth = days[p.s].m; // Zeiträume über mehrere Monate: Startmonat
    if (uiMode === "einfach" && !showSimpleCal) {
      setShowSimpleCal(true);
      setScrollTarget({ month: targetMonth, period: p });
    } else {
      performScroll(targetMonth, p);
    }
  };
  // Tastaturbedienung: nur reagieren, wenn der Fokus auf der Zeile selbst liegt
  // (nicht auf verschachtelten Buttons/Links wie ICS/iCal oder Google).
  const onRowKeyDown = (e, p) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      scrollToPeriod(p);
    }
  };

  // Kurze Monatszusammenfassung für Feiertage und Schulferien direkt unter
  // jeder Monatskarte. Nutzt ausschließlich vorhandene Daten (days, vacations,
  // vacStatus, year, showWeekendHolidays) – keine neuen API-Aufrufe, keine
  // Änderung an plan()/Kernberechnung/Share-Link/gespeicherten Daten.
  // Rückgabe: { holidaysText, vacationsText } (jeweils null, wenn nichts anzuzeigen ist).
  const monthSummary = (m) => {
    // --- Feiertage: Namen dieses Monats sammeln, deduplizieren, ggf. Wochenende ausschließen ---
    const holidayNames = [];
    const seenH = new Set();
    for (const d of days) {
      if (d.m !== m || !d.holiday) continue;
      if (d.weekend && !showWeekendHolidays) continue;
      if (!seenH.has(d.holiday)) { seenH.add(d.holiday); holidayNames.push(withAssumptionDayCaveat(d.holiday, d, st)); }
    }
    let holidaysText = null;
    if (holidayNames.length > 0) {
      const shown = holidayNames.slice(0, 2);
      const rest = holidayNames.length - shown.length;
      holidaysText = shown.join(", ") + (rest === 1 ? t("calendar.summary.oneMore") : rest > 1 ? t("calendar.summary.nMore", { count: rest }) : "");
    }

    // --- Schulferien: Zeiträume aus "vacations" auf den Monat zuschneiden ---
    let vacationsText = null;
    if (hasVacationData && Array.isArray(vacations)) {
      const monthStart = Date.UTC(year, m, 1);
      const monthEnd = Date.UTC(year, m + 1, 0); // letzter Tag des Monats
      const entries = [];
      for (const p of vacations) {
        if (!p || !p.start || !p.end) continue;
        const s = new Date(p.start), e = new Date(p.end);
        if (isNaN(s) || isNaN(e) || e < s) continue;
        const sTs = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
        const eTs = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
        if (eTs < monthStart || sTs > monthEnd) continue; // kein Bezug zu diesem Monat
        const startsBefore = sTs < monthStart;
        const endsAfter = eTs > monthEnd;
        const overlapS = Math.max(sTs, monthStart);
        const overlapE = Math.min(eTs, monthEnd);
        let dateText;
        if (startsBefore && !endsAfter) dateText = t("calendar.summary.rangeUntil", { date: fmtDDMM(overlapE) });
        else if (!startsBefore && endsAfter) dateText = t("calendar.summary.rangeFrom", { date: fmtDDMM(overlapS) });
        else dateText = t("calendar.summary.rangeBetween", { from: fmtDDMM(overlapS), to: fmtDDMM(overlapE) });
        const name = p.name_cp || p.name || t("fallback.schoolHolidays");
        entries.push({ name, dateText, sortKey: overlapS });
      }
      // Nach Beginn sortieren, dann pro Name nur den ersten (chronologisch frühesten) Eintrag behalten
      entries.sort((a, b) => a.sortKey - b.sortKey);
      const seenV = new Set();
      const unique = [];
      for (const en of entries) {
        if (seenV.has(en.name)) continue;
        seenV.add(en.name);
        unique.push(en);
      }
      if (unique.length > 0) {
        const shown = unique.slice(0, 2);
        const rest = unique.length - shown.length;
        vacationsText = shown.map((u) => `${u.name} ${u.dateText}`).join(", ") + (rest > 0 ? t("calendar.summary.nMore", { count: rest }) : "");
      }
    }

    return { holidaysText, vacationsText };
  };

  // Jahreskalender – in beiden Modi identisch wiederverwendet
  const calendarSection = (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {MONTHS.map((mName, m) => {
              const mDays = days.filter((d) => d.m === m);
              const lead = (mDays[0].dow + 6) % 7; // Woche beginnt Montag
              const summary = monthSummary(m);
              return (
                <div key={m} ref={(el) => { monthRefs.current[m] = el; }}
                  className={`${cardCls} p-3 scroll-mt-24 transition-shadow duration-300 ${
                    highlightedMonth === m ? (dark ? "ring-2 ring-emerald-400" : "ring-2 ring-emerald-500") : ""
                  }`}>
                  <h3 className="text-sm font-bold mb-2">{mName}</h3>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
                    {t("calendar.weekdaysMonFirst").map((w) => <span key={w}>{w}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: lead }).map((_, i) => <span key={`x${i}`} />)}
                    {mDays.map((day) => {
                      const selType = result.sel[day.i];
                      const clickable = day.cost > 0;
                      const manual = yearOverrides[`${day.m}-${day.d}`];
                      const vac = vacationDays[`${day.m}-${day.d}`]; // Schulferien an diesem Tag (oder undefined)
                      const lo = drag ? Math.min(drag.anchor, drag.current) : -1;
                      const hi = drag ? Math.max(drag.anchor, drag.current) : -1;
                      const inDrag = drag && clickable && !selType && day.i >= lo && day.i <= hi;
                      const ring = inDrag
                        ? clickMode === "vac" ? "ring-2 ring-emerald-500" : "ring-2 ring-sky-500"
                        : manual && manual !== "none" ? (dark ? "ring-2 ring-slate-300" : "ring-2 ring-slate-500")
                        : clickable ? "hover:ring-2 hover:ring-emerald-400" : "";
                      // Freizeitband: Tag-Index -> Zeitraum ausschließlich über die
                      // oben aus result.periods abgeleitete periodDayInfo-Map (Single
                      // Source of Truth, keine doppelte Berechnung).
                      const periodInfo = periodDayInfo.get(day.i);
                      const inHighlightedPeriod = periodInfo && highlightedPeriodValid
                        && day.i >= highlightedPeriod.s && day.i <= highlightedPeriod.e;
                      // Tooltip-Text für Ferien, z. B. "Sommerferien in Bayern · 2.8.2027 bis 14.9.2027"
                      const vacTipText = vac
                        ? t("calendar.vacationTooltip", {
                            name: vac.name, state: STATES[st],
                            start: vac.start.toLocaleDateString("de-DE"), end: vac.end.toLocaleDateString("de-DE"),
                          })
                        : null;
                      const titleText = dayTitle(day, selType, st, !!periodInfo);
                      return (
                        <button key={day.i} type="button"
                          title={vacTipText ? `${titleText} · ${vacTipText}` : titleText}
                          data-dayindex={day.i}
                          onClick={() => {
                            if (dragAppliedRef.current) { dragAppliedRef.current = false; return; }
                            // Auf Touch-Geräten: Antippen eines Ferientags zeigt die Info dezent an
                            if (vacTipText) setVacTip({ text: vacTipText }); else setVacTip(null);
                            onDayClick(day);
                          }}
                          onPointerDown={(e) => {
                            dragAppliedRef.current = false;
                            // Zieh-Auswahl nur mit Maus/Stift – auf Touch-Geräten
                            // bleibt Wischen dem Scrollen vorbehalten (Tippen setzt einzelne Tage)
                            if (clickable && !selType && e.pointerType !== "touch") {
                              e.preventDefault(); // Textauswahl unterdrücken
                              try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                              setDrag({ anchor: day.i, current: day.i });
                            }
                          }}
                          className={`relative h-7 rounded-md flex items-center justify-center text-[11px] tabular-nums select-none ${
                            clickable ? "cursor-pointer" : "cursor-default"
                          } ${ring} ${dayClass(day, selType, showWeekendHolidays, dark)}`}>
                          {day.d}
                          {periodInfo && (
                            /* Freier Zeitraum (result.periods): dünner mintgrüner Innenrahmen als
                               reines Overlay – überschreibt die Grundfarbe/den Ring der Zelle nicht.
                               Abgerundete Ecken nur am tatsächlichen Anfang/Ende des Zeitraums (p.s/p.e);
                               dazwischen (auch über Zeilen-/Monatsgrenzen hinweg) bewusst ohne Rundung
                               und ohne seitlichen Rand auf der "offenen" Seite, damit die Fortsetzung
                               als durchgehendes Band erkennbar bleibt. Bei aktiver, gültiger
                               Kurz-Hervorhebung (highlightedPeriodValid) kräftiger/deckend statt dezent. */
                            <span aria-hidden="true"
                              className={`pointer-events-none absolute inset-0.5 border-t-2 border-b-2 transition-colors duration-300 ${
                                periodInfo.isStart ? "rounded-l-md border-l-2" : "border-l-0"
                              } ${periodInfo.isEnd ? "rounded-r-md border-r-2" : "border-r-0"} ${
                                inHighlightedPeriod
                                  ? (dark ? "border-emerald-300" : "border-emerald-600")
                                  : (dark ? "border-emerald-300/50" : "border-emerald-600/40")
                              }`} />
                          )}
                          {vac && (
                            /* Schulferien: dezente Ebene – Streifen am unteren Rand in eigener Farbe (Orange),
                               deutlich verschieden von Urlaub (grün), Feiertag (rot), Überstunden (blau),
                               Wochenende (grau). Überschreibt die Grundfarbe der Zelle nicht. */
                            <span aria-hidden="true"
                              className="pointer-events-none absolute inset-x-1 bottom-0.5 h-[3px] rounded-full bg-orange-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {(summary.holidaysText || summary.vacationsText) && (
                    <div className={`mt-2 pt-2 border-t space-y-0.5 ${dark ? "border-slate-800" : "border-slate-100"}`}>
                      {summary.holidaysText && (
                        <p className={`text-[10px] leading-snug ${dark ? "text-rose-400/80" : "text-rose-600/80"}`}>
                          {t("calendar.summary.publicHolidays")} {summary.holidaysText}
                        </p>
                      )}
                      {summary.vacationsText && (
                        <p className={`text-[10px] leading-snug ${dark ? "text-orange-400/80" : "text-orange-600/80"}`}>
                          {t("calendar.summary.schoolHolidays")} {summary.vacationsText}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
  );

  // Strukturierte, dynamisch erzeugte Begründung für einen empfohlenen Zeitraum.
  // EINE Quelle für Einfach- UND Profi-Modus; leitet alles aus der Periode, den
  // Tagen und den aktuellen Einstellungen ab und greift NICHT in plan()/die
  // Kernberechnung, den Share-Link oder gespeicherte Daten ein.
  // Rückgabe: { reason, holidayNote, holidayConflict }.
  const blockReason = (p) => {
    // Feiertage + Sondertage im Zeitraum sammeln (Kalenderreihenfolge, dedupliziert)
    // und zählen, wie viele getrennte Wochenenden der Zeitraum verbindet.
    const holidayNames = [];
    const seen = new Set();
    let hasXmasEve = false, hasNYE = false;
    let weekends = 0, inWeekend = false;
    for (let k = p.s; k <= p.e; k++) {
      const d = days[k];
      // Ein Feiertag/Sondertag erklärt die Attraktivität des Zeitraums nur dann
      // sinnvoll, wenn er auf einen persönlichen regulären Arbeitstag fällt -
      // an einem regelmäßig freien Wochentag hätte er ohnehin nichts "gespart".
      if (d.holiday && d.isWorkingDay && !seen.has(d.holiday)) { seen.add(d.holiday); holidayNames.push(d.holiday); }
      if (d.special === t("special.christmasEve") && d.isWorkingDay) hasXmasEve = true;
      if (d.special === t("special.newYearsEve") && d.isWorkingDay) hasNYE = true;
      // "weekends" zählt bewusst ECHTE Kalenderwochenenden (unabhängig vom
      // persönlichen Wochenplan) - die Formulierungen sprechen explizit von
      // "Wochenende" und meinen damit Samstag/Sonntag, nicht regelmäßig freie Tage.
      if (d.weekend) { if (!inWeekend) { weekends++; inWeekend = true; } } else inWeekend = false;
    }
    const invested = p.vac + p.ot;

    // --- Hauptbegründung: was macht den Zeitraum attraktiv? ---
    let reason = null;
    const xmas = holidayNames.some((n) => n.includes("Weihnachtstag"));
    if (xmas && (hasXmasEve || hasNYE)) {
      // Weihnachts-/Silvester-Serie
      if (hasXmasEve && hasNYE) reason = t("results.reason.xmasBoth");
      else if (hasXmasEve) reason = t("results.reason.xmasEveOnly");
      else reason = t("results.reason.xmasNyeOnly");
    } else {
      // Namen für den Satz wählen: Feiertage bevorzugt, sonst Sondertage
      let names = holidayNames.slice();
      if (names.length === 0) {
        if (hasXmasEve) names.push(t("special.christmasEve"));
        if (hasNYE) names.push(t("special.newYearsEve"));
      }
      names = names.slice(0, 2);
      if (names.length > 0) {
        const subject = names.length === 2 ? `${names[0]}${t("results.andSeparator")}${names[1]}` : names[0];
        const plural = names.length > 1;
        if (weekends >= 2) reason = t("results.reason.namedTwoWeekends", { subject, plural });
        else reason = t("results.reason.namedExtends", { subject, plural });
      } else if (invested > 0) {
        // kein Feiertag/Sondertag – rein über Urlaubstage erzeugter Zeitraum
        if (weekends >= 2) reason = t("results.reason.vacTwoWeekends");
        else if (weekends === 1) reason = t("results.reason.vacOneWeekend");
        else reason = t("results.reason.vacOnly");
      }
      // invested === 0 ohne Feiertag: nichts Sinnvolles zu sagen -> reason bleibt null
    }

    // --- Schulferienhinweis: nur bei gesicherten Feriendaten (hasVacationData) ---
    let holidayNote = null, holidayConflict = false;
    if (hasVacationData && (schoolHolidayPreference === "avoid" || schoolHolidayPreference === "prefer")) {
      let ferienTage = 0;
      for (let k = p.s; k <= p.e; k++) if (vacationDays[`${days[k].m}-${days[k].d}`]) ferienTage++;
      if (ferienTage > 0) {
        if (schoolHolidayPreference === "avoid") {
          holidayConflict = true;
          holidayNote = t("results.warning.schoolHolidayOverlap", { count: ferienTage });
        } else {
          holidayNote = t("results.note.schoolHolidayMatch");
        }
      }
    }

    return { reason, holidayNote, holidayConflict };
  };

  // Gemeinsame Darstellung der Begründung – identisch in Einfach- und Profi-Modus.
  // Hauptbegründung als dezente graue Zeile; Schulferien-Konflikt (avoid) als
  // zweite Zeile in zurückhaltendem Orange; erfüllter Ferienwunsch (prefer)
  // ebenfalls separat, aber gedämpft. Höchstens zwei Zusatzzeilen pro Zeitraum.
  const reasonLines = (p) => {
    const r = blockReason(p);
    if (!r || (!r.reason && !r.holidayNote)) return null;
    return (
      <>
        {r.reason && (
          <span className={`w-full text-[11px] leading-snug ${dark ? "text-slate-500" : "text-slate-400"}`}>{r.reason}</span>
        )}
        {r.holidayNote && (
          <span className={`w-full text-[11px] leading-snug ${
            r.holidayConflict
              ? (dark ? "text-orange-300/80" : "text-orange-600/90")
              : (dark ? "text-slate-500" : "text-slate-400")
          }`}>{r.holidayNote}</span>
        )}
      </>
    );
  };

  return (
    <div className={`min-h-screen ${dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"}`} style={{ fontFeatureSettings: '"tnum"' }}>
      <style>{`@keyframes upFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
      {view === "loading" ? (
        <div className="min-h-screen flex items-center justify-center px-4">
          <p role="status" aria-live="polite" className={`text-sm font-semibold ${dark ? "text-slate-300" : "text-slate-600"}`}>
            {t("common.loadingSharedPlan")}
          </p>
        </div>
      ) : view === "landing" ? (
        <LandingPage dark={dark} setDark={setDark} cardCls={cardCls}
          onStartSimple={() => goToPlanner("einfach")}
          onStartPro={() => goToPlanner("profi")} />
      ) : (
      <>
      {/* Kopf */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <button onClick={() => setView("landing")}
              className="mb-1 inline-flex focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded opacity-90 hover:opacity-100 transition-opacity"
              aria-label={t("nav.backToStartAriaLabel")}>
              <img src="./assets/logo/freilotse-nav-dark-bg.svg" alt="" className="w-28 sm:w-32 h-auto" />
            </button>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-1">
              {t("header.tagline", { state: STATES[st] })}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{t("header.title", { year })}</h1>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-600 p-1 self-start">
            {[["einfach", t("nav.simpleMode")], ["profi", t("nav.proMode")]].map(([k, l]) => (
              <button key={k}
                onClick={() => {
                  setUiMode(k);
                  // Einfachmodus bietet nur 3 Jahre an – Auswahl ggf. zurückholen
                  if (k === "einfach" && year > currentYear + 2) setYear(currentYear);
                }}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  uiMode === k ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={handleShare}
            className="self-start inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={t("share.ariaLabel")}
            title={t("share.title")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
            </svg>
            {t("share.button")}
          </button>
          <button onClick={() => setDark(!dark)}
            className="self-start rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            title={t("theme.toggleTitle")}>
            {dark ? t("theme.toLight") : t("theme.toDark")}
          </button>
          <div className="text-right">
            <p className="text-4xl font-bold tabular-nums text-emerald-400">{totalFree}</p>
            <p className="text-xs text-slate-300">
              {t("header.freeDaysSuffix", {
                total: totalFree, periods: periodCount,
                usedVac: fmtNum(usedVac), usedVacRaw: usedVac,
                usedOt: usedOt > 0 ? fmtNum(usedOt) : 0, usedOtRaw: usedOt,
              })}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {uiMode === "einfach" ? (
          <div key="einfach" className="grid gap-6 lg:grid-cols-[320px_1fr]" style={{ animation: "upFade .35s ease" }}>
            {/* Einfachmodus: kleiner Assistent – fragt nur das Nötigste ab.
                Alle Eingaben nutzen die vorhandenen States (vac, year, st, xmasRule);
                es gibt keine neue Berechnungslogik. */}
            <aside className="space-y-4">
              <section className={`${cardCls} p-5 space-y-5`}>
                <h2 className="text-sm font-bold">{t("simple.stepperTitle")}</h2>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.step1Question")}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setVac(String(Math.max(0, num(vac) - 1)))}
                      className={`w-10 h-10 rounded-md border text-lg font-bold ${dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>
                      −
                    </button>
                    <span className="w-14 text-center text-2xl font-bold tabular-nums">{fmtNum(num(vac))}</span>
                    <button onClick={() => setVac(String(num(vac) + 1))}
                      className={`w-10 h-10 rounded-md border text-lg font-bold ${dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.step2Question")}</p>
                  {/* Immer genau drei Jahre: aktuelles Jahr, +1, +2 – aktualisiert sich selbst */}
                  <select className={inputCls} value={year}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10);
                      setYear(y);
                      if (y !== currentYear) setAutoFrom(0);
                    }}>
                    {Array.from({ length: 3 }, (_, i) => currentYear + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.step3Question")}</p>
                  <select className={inputCls} value={st} onChange={(e) => setSt(e.target.value)}>
                    {Object.entries(STATES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.stepWorkdaysQuestion")}</p>
                  {!showWorkingDaysEditor ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        {workingWeekdaysSummary()}
                      </span>
                      <button type="button" onClick={() => setShowWorkingDaysEditor(true)}
                        className="shrink-0 text-xs font-semibold text-emerald-600 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">
                        {t("workingDays.changeButton")}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workingWeekdayButtons()}
                      <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>{workingWeekdaysSummary()}</p>
                      <div className="flex items-center justify-between gap-2">
                        {!isDefaultWorkweek ? (
                          <button type="button" onClick={resetWorkingWeekdays}
                            className="text-xs font-semibold text-emerald-600 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">
                            {t("workingDays.resetButton")}
                          </button>
                        ) : <span />}
                        <button type="button" onClick={() => setShowWorkingDaysEditor(false)}
                          className={`text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded ${
                            dark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
                          }`}>
                          {t("workingDays.closeButton")}
                        </button>
                      </div>
                      <p className={`text-[11px] leading-snug ${dark ? "text-slate-500" : "text-slate-400"}`}>
                        {t("workingDays.minOneRequired")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.step4Question")}</p>
                  <div className="space-y-2">
                    {[["100", t("simple.step4Options.full")],
                      ["50", t("simple.step4Options.half")],
                      ["0", t("simple.step4Options.none")]].map(([k, l]) => (
                      <label key={k} className={`flex items-start gap-2 text-sm cursor-pointer ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        <input type="radio" name="simpleXmas" className="mt-0.5 accent-emerald-600"
                          checked={xmasRule === k} onChange={() => setXmasRule(k)} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                  <p className={`text-[11px] leading-snug ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {t("simple.step4Hint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.step5Question")}</p>
                  <div className={`space-y-2 ${schoolPrefOptionsDisabled ? "opacity-50" : ""}`}>
                    {[["prefer", t("schoolHolidays.preference.prefer")], ["avoid", t("schoolHolidays.preference.avoid")], ["neutral", t("schoolHolidays.preference.neutral")]].map(([k, l]) => (
                      <label key={k}
                        title={schoolPrefOptionsDisabled ? t("schoolHolidays.optionsDisabledTitle") : undefined}
                        className={`flex items-center gap-2 text-sm ${
                          schoolPrefOptionsDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        } ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        <input type="radio" name="schoolPrefSimple" className="accent-emerald-600"
                          disabled={schoolPrefOptionsDisabled}
                          checked={schoolHolidayPreference === k}
                          onChange={() => setSchoolHolidayPreference(k)} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                  {schoolHolidayNotice && (
                    <p className={`text-[11px] leading-snug font-semibold ${dark ? "text-orange-300/90" : "text-orange-700"}`}>
                      {schoolHolidayNotice}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>{t("simple.step6Question")}</p>
                  <div className="space-y-2">
                    {[["free", t("simple.goal.free")], ["blocks", t("simple.goal.blocks")], ["short", t("simple.goal.short")], ["custom", t("simple.goal.custom")]].map(([k, l]) => (
                      <label key={k} className={`flex items-center gap-2 text-sm cursor-pointer ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        <input type="radio" name="simpleGoal" className="accent-emerald-600"
                          checked={k !== "custom" && simpleGoal === k}
                          onChange={() => { if (k === "custom") { setUiMode("profi"); } else { applySimpleGoal(k); } }} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={() => { applySimpleGoal(simpleGoal); setSimpleStarted(true); }}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                  {t("simple.calcButton")}
                </button>
              </section>
            </aside>

            {/* Einfachmodus: Ergebnis */}
            <div className="space-y-6">
              {!simpleStarted ? (
                <section className={`${cardCls} p-8 text-center`}>
                  <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    {t("simple.notStartedHint")}
                  </p>
                </section>
              ) : (
                <div className="space-y-6" style={{ animation: "upFade .35s ease" }}>
                  <section className={`${cardCls} p-6`}>
                    <h2 className="text-sm font-bold mb-3">{t("simple.resultHeading")}</h2>
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                      <div>
                        <p className={`text-6xl font-bold tabular-nums ${dark ? "text-emerald-400" : "text-emerald-600"}`}>{totalFree}</p>
                        <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>{t("simple.freeDaysLabel")}</p>
                      </div>
                      <div className={`text-sm space-y-1 ${dark ? "text-slate-300" : "text-slate-600"}`}>
                        <p>{t("simple.statTotalFree", { count: totalFree, periods: periodCount })}</p>
                        <p>{t("simple.statVacationDaysUsed", { count: fmtNum(usedVac), countRaw: usedVac })}</p>
                        <p>{t("simple.statHolidaysUsed", { count: periodWorkingDayHolidayCount })}</p>
                        <p>{t("simple.statLongestStreak", { count: longest })}</p>
                      </div>
                    </div>
                    <p className={`mt-4 text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
                      {t("simple.summarySentence", { usedVac: fmtNum(usedVac), totalVac: fmtNum(num(vac)), totalFree, periods: periodCount })}
                    </p>
                  </section>

                  <section className={`${cardCls} p-4`}>
                    <h3 className="text-sm font-bold mb-2">{t("simple.recommendedBlocksHeading")}</h3>
                    {result.periods.length === 0 ? (
                      <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
                        {t("simple.noSuggestions")}
                      </p>
                    ) : (
                      <ul className={`divide-y ${dark ? "divide-slate-800" : "divide-slate-100"}`}>
                        {result.periods.map((p, i) => (
                          <li key={i} role="button" tabIndex={0}
                            onClick={() => scrollToPeriod(p)}
                            onKeyDown={(e) => onRowKeyDown(e, p)}
                            title={t("simple.jumpToMonthTitle")}
                            className={`py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                              dark ? "active:bg-slate-800/60" : "active:bg-slate-100"
                            }`}>
                            <span className="font-medium">{fmtDate(days[p.s])} – {fmtDate(days[p.e])}</span>
                            <span className={`tabular-nums flex items-center gap-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                              <span>{t("simple.periodFreeDaysLabel", { len: p.len, vac: fmtNum(p.vac), vacRaw: p.vac })}</span>
                              <span aria-hidden="true" className={dark ? "text-slate-600" : "text-slate-300"}>›</span>
                            </span>
                            {reasonLines(p)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <button onClick={() => setShowSimpleCal(!showSimpleCal)}
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-bold ${
                      dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}>
                    {showSimpleCal ? t("simple.hideCalendar") : t("simple.showCalendar")}
                  </button>
                  {showSimpleCal && (
                    <div style={{ animation: "upFade .35s ease" }}>
                      {calendarSection}
                      {vacTip && (
                        <p className="mt-1 text-[11px] text-orange-500">{vacTip.text}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div key="profi" className="grid gap-6 lg:grid-cols-[320px_1fr]" style={{ animation: "upFade .35s ease" }}>
        {/* Einstellungen */}
        <aside className="space-y-4">
              <CollapsibleCard icon="📅" title={t("settings.panelTitle")} open={panels.allgemein}
                onToggle={() => togglePanel("allgemein")} dark={dark} cardCls={cardCls}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("settings.year")}</label>
                    <select className={inputCls} value={year}
                      onChange={(e) => {
                        const y = parseInt(e.target.value, 10);
                        setYear(y);
                        if (y !== currentYear) setAutoFrom(0);
                      }}>
                      {Array.from({ length: 5 }, (_, i) => currentYear + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("settings.federalState")}</label>
                    <select className={inputCls} value={st} onChange={(e) => setSt(e.target.value)}>
                      {Object.entries(STATES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("settings.vacationDays")}</label>
                    <input className={inputCls} type="number" min="0" step="0.5" value={vac}
                      onFocus={selectAllOnFocus} onChange={(e) => setVac(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("settings.overtimeDaysLabel")}</label>
                    <input className={inputCls} type="number" min="0" step="0.5" value={ot}
                      onFocus={selectAllOnFocus} onChange={(e) => setOt(e.target.value)} />
                    <button type="button" onClick={() => setShowOtCalc((v) => !v)}
                      aria-expanded={showOtCalc} aria-controls="ot-calc-panel"
                      className="mt-1 text-[11px] font-semibold text-emerald-600 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">
                      {showOtCalc ? t("settings.otCalc.toggleHide") : t("settings.otCalc.toggleShow")}
                    </button>
                    {showOtCalc && (
                      <div id="ot-calc-panel"
                        className={`mt-2 space-y-2 rounded-md border p-2 ${dark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                        <div>
                          <label htmlFor="ot-calc-hours" className={labelCls}>{t("settings.otCalc.hoursLabel")}</label>
                          <input id="ot-calc-hours" className={inputCls} type="number" min="0" step="0.5"
                            value={otCalcHours} onFocus={selectAllOnFocus}
                            onChange={(e) => setOtCalcHours(e.target.value)} />
                        </div>
                        <div>
                          <label htmlFor="ot-calc-hpd" className={labelCls}>{t("settings.otCalc.hoursPerDayLabel")}</label>
                          <input id="ot-calc-hpd" className={inputCls} type="number" min="0" step="0.5"
                            value={otCalcHoursPerDay} onFocus={selectAllOnFocus}
                            onChange={(e) => updateOtCalcHoursPerDay(e.target.value)} />
                        </div>
                        <p aria-live="polite" className={`text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>
                          {otCalcResult !== null
                            ? t("settings.otCalc.result", { value: fmtNum2(otCalcResult), valueRaw: otCalcResult })
                            : t("settings.otCalc.resultInvalid")}
                        </p>
                        <button type="button" onClick={applyOtCalc} disabled={otCalcResult === null}
                          aria-label={t("settings.otCalc.applyAriaLabel")}
                          className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600">
                          {t("settings.otCalc.apply")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  {t("settings.holidaySource")}{" "}
                  {apiStatus === "api" && <span className="text-emerald-600 font-semibold">{t("settings.holidaySourceApi")}</span>}
                  {apiStatus === "laedt" && t("settings.holidaySourceLoading")}
                  {apiStatus === "lokal" && t("settings.holidaySourceLocal")}
                </p>
                <p className="text-[11px] text-slate-400">
                  {t("settings.schoolHolidaySourceLabel")}{" "}
                  {vacStatus === "openholidays" && <span className="text-emerald-600 font-semibold">{t("settings.schoolHolidaySourceOpenHolidays")}</span>}
                  {vacStatus === "ersatz" && <span className="text-orange-500 font-semibold">{t("settings.schoolHolidaySourceErsatz")}</span>}
                  {vacStatus === "laedt" && t("settings.holidaySourceLoading")}
                  {vacStatus === "keine" && <span className="text-rose-600 font-semibold">{t("settings.schoolHolidaySourceNone")}</span>}
                  {vacStatus === "fehler" && <span className="text-rose-600 font-semibold">{t("settings.schoolHolidaySourceUnreachable")}</span>}
                </p>
                {st === "BY" && (
                  <p className={`text-[11px] leading-snug ${dark ? "text-amber-300/90" : "text-amber-700"}`}>
                    {t("holidayCaveats.assumptionDayNotice")}
                  </p>
                )}
              </CollapsibleCard>

              <CollapsibleCard icon="⚙" title={t("workRules.panelTitle")} open={panels.regelung}
                onToggle={() => togglePanel("regelung")} dark={dark} cardCls={cardCls}>
                <div>
                  <label className={labelCls}>{t("workRules.xmasLabel")}</label>
                  <select className={inputCls} value={xmasRule} onChange={(e) => setXmasRule(e.target.value)}>
                    <option value="100">{t("workRules.xmasOptionFull")}</option>
                    <option value="50">{t("workRules.xmasOptionHalf")}</option>
                    <option value="0">{t("workRules.xmasOptionNone")}</option>
                  </select>
                </div>
                <label className={`flex items-start gap-2 text-sm ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={showWeekendHolidays}
                    onChange={(e) => setShowWeekendHolidays(e.target.checked)} />
                  <span>{t("workRules.includeWeekendHolidays")}</span>
                </label>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={subLabelCls}>{t("workingDays.proPanelTitle")}</span>
                    {!isDefaultWorkweek && (
                      <button type="button" onClick={resetWorkingWeekdays}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">
                        {t("workingDays.resetButton")}
                      </button>
                    )}
                  </div>
                  {workingWeekdayButtons()}
                  <p className={`mt-1 text-[11px] leading-snug ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {t("workingDays.proHint")}
                  </p>
                  <p className={`text-[11px] leading-snug ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {t("workingDays.minOneRequired")}
                  </p>
                </div>
              </CollapsibleCard>

              <CollapsibleCard icon="🤖" title={t("auto.panelTitle")} open={panels.auto}
                onToggle={() => togglePanel("auto")} dark={dark} cardCls={cardCls}>
                <div className="flex items-center justify-between">
                  <span className={subLabelCls}>{t("auto.budgetLabel")}</span>
                  <button onClick={() => { setAutoVac(""); setAutoOt("0"); }}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline">
                    {t("auto.toMinimum")}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={subLabelCls}>{t("auto.useVacationDays")}</span>
                      <span className={`text-xs font-bold tabular-nums ${dark ? "text-emerald-300" : "text-emerald-800"}`}>
                        {fmtNum(Math.min(effAutoVac, num(vac)))} / {fmtNum(num(vac))}
                      </span>
                    </div>
                    <input type="range" className="w-full accent-emerald-600 disabled:opacity-40"
                      min="0" max={num(vac)} step="0.5"
                      value={Math.min(effAutoVac, num(vac))} disabled={num(vac) === 0}
                      onChange={(e) => setAutoVac(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={subLabelCls}>{t("auto.useOvertimeDays")}</span>
                      <span className={`text-xs font-bold tabular-nums ${dark ? "text-emerald-300" : "text-emerald-800"}`}>
                        {fmtNum(Math.min(effAutoOt, num(ot)))} / {fmtNum(num(ot))}
                      </span>
                    </div>
                    <input type="range" className="w-full accent-emerald-600 disabled:opacity-40"
                      min="0" max={num(ot)} step="0.5"
                      value={Math.min(effAutoOt, num(ot))} disabled={num(ot) === 0}
                      onChange={(e) => setAutoOt(e.target.value)} />
                  </div>
                </div>
                <div>
                  <span className={`block ${subLabelCls} mb-1`}>{t("auto.fromMonth")}</span>
                  <select className={inputCls} value={autoFrom}
                    onChange={(e) => setAutoFrom(parseInt(e.target.value, 10))}>
                    {MONTHS.map((m, mi) => (
                      <option key={mi} value={mi}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={`block ${subLabelCls} mb-1`}>{t("auto.spendFirst")}</span>
                  <div className={`grid grid-cols-2 gap-1 rounded-md border p-1 ${dark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}>
                    {[["vac", t("auto.spendFirstVac")], ["ot", t("auto.spendFirstOt")]].map(([k, l]) => (
                      <button key={k} onClick={() => setSpendFirst(k)}
                        className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                          spendFirst === k
                            ? "bg-emerald-600 text-white"
                            : dark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {schoolPrefControl(true)}
                <p className={`text-[11px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}>
                  {t("auto.minimumHintPrefix", { days: fmtNum(Math.min(minBudget, num(vac))) })}
                  <InfoHint dark={dark} text={t("auto.minimumHintDetail")} />
                </p>
              </CollapsibleCard>

              <CollapsibleCard icon="⭐" title={t("blocks.panelTitle")} open={panels.bloecke}
                onToggle={() => togglePanel("bloecke")} dark={dark} cardCls={cardCls}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>{t("blocks.prioritizedHint")}</span>
                  <button onClick={addBlock}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                    {t("blocks.addButton")}
                  </button>
                </div>
                {blocks.length === 0 && (
                  <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    {t("blocks.emptyHint")}
                  </p>
                )}
                {blocks.map((b, i) => {
                  const r = result.blockResults[i];
                  return (
                    <div key={i} className={`rounded-lg border p-2.5 space-y-2 ${dark ? "border-slate-700" : "border-slate-200"}`}>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={labelCls}>{t("blocks.freeDaysLabel")}</label>
                          <input className={inputCls} type="number" min="1" value={b.len}
                            onFocus={selectAllOnFocus} onChange={(e) => updBlock(i, { len: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelCls}>{t("blocks.monthLabel")}</label>
                          <select className={inputCls} value={b.month} onChange={(e) => updBlock(i, { month: e.target.value })}>
                            <option value="">{t("blocks.monthAny")}</option>
                            {MONTHS.map((m, mi) => (
                              <option key={mi} value={mi}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>{t("blocks.overtimeDaysLabel")}</label>
                          <input className={inputCls} type="number" min="0" step="0.5" placeholder="0" value={b.ot}
                            onFocus={selectAllOnFocus} onChange={(e) => updBlock(i, { ot: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs">
                          {r?.placed ? (
                            <span className="text-emerald-700">
                              {t("blocks.placed", { start: fmtDate(days[r.start]), end: fmtDate(days[r.end]), cost: fmtNum(r.cost) })}
                            </span>
                          ) : (
                            <span className="text-rose-600">{t("blocks.notPlaced")}</span>
                          )}
                        </p>
                        <button onClick={() => delBlock(i)} className="text-xs text-slate-400 hover:text-rose-600">{t("blocks.removeButton")}</button>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleCard>
            </aside>

        {/* Ergebnisse */}
        <div className="space-y-6">
          {/* Kennzahlen */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { v: fmtNum(leverage), l: t("metrics.leverage") },
              { v: longest, l: t("metrics.longestStreak") },
              { v: showWeekendHolidays ? `${periodWorkingDayHolidayCount} + ${periodWeekendHolidayCount}` : periodWorkingDayHolidayCount,
                l: showWeekendHolidays ? t("metrics.holidaysWithWeekend") : t("metrics.holidaysWorkdaysOnly") },
              { v: `${fmtNum(result.budget.vac)} / ${fmtNum(result.budget.ot)}`, l: t("metrics.remaining") },
            ].map((s, i) => (
              <div key={i} className={`${cardCls} p-3 text-center`}>
                <p className="text-2xl font-bold tabular-nums">{s.v}</p>
                <p className={`text-xs leading-tight mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{s.l}</p>
              </div>
            ))}
          </section>

          {/* Freie Perioden */}
          <section className={`${cardCls} p-4`}>
            <h2 className="text-sm font-bold mb-2">{t("results.periodsHeading")}</h2>
            {result.periods.length === 0 ? (
              <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>{t("results.periodsEmptyHint")}</p>
            ) : (
              <ul className={`divide-y ${dark ? "divide-slate-800" : "divide-slate-100"}`}>
                {result.periods.map((p, i) => (
                  <li key={i} role="button" tabIndex={0}
                    onClick={() => scrollToPeriod(p)}
                    onKeyDown={(e) => onRowKeyDown(e, p)}
                    title={t("results.jumpToMonthTitle")}
                    className={`py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      dark ? "active:bg-slate-800/60" : "active:bg-slate-100"
                    }`}>
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {fmtDate(days[p.s])} – {fmtDate(days[p.e])}
                      {p.origins.includes("block") && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{t("results.badgeBlock")}</span>
                      )}
                      {p.origins.includes("manual") && (
                        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-white">{t("results.badgeManual")}</span>
                      )}
                      {p.origins.includes("auto") && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{t("results.badgeAuto")}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`tabular-nums ${dark ? "text-slate-400" : "text-slate-500"}`}>
                        {t("results.periodSummary", { len: p.len, vac: fmtNum(p.vac), ot: fmtNum(p.ot), otRaw: p.ot })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); downloadIcs(p); }}
                          title={t("results.icsTitle")}
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                          }`}>
                          {t("results.icsButton")}
                        </button>
                        <a href={googleUrl(p)} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={t("results.googleTitle")}
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                          }`}>
                          {t("results.googleButton")}
                        </a>
                      </span>
                      <span aria-hidden="true" className={`hidden sm:inline-block ${dark ? "text-slate-600" : "text-slate-300"}`}>›</span>
                    </span>
                    {reasonLines(p)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Manuell planen + Legende */}
          <section className={`${cardCls} p-3 space-y-2`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={subLabelCls}>{t("manual.clickSetsLabel")}</span>
              <div className={`grid grid-cols-2 gap-1 rounded-md border p-1 ${dark ? "border-slate-600" : "border-slate-200"}`}>
                {[["vac", t("manual.vacationDay")], ["ot", t("manual.overtimeReduction")]].map(([k, l]) => (
                  <button key={k} onClick={() => setClickMode(k)}
                    className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                      clickMode === k
                        ? k === "vac" ? "bg-emerald-600 text-white" : "bg-sky-600 text-white"
                        : dark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              {Object.keys(overrides).length > 0 && (
                <button onClick={() => setOverrides({})}
                  className="text-xs text-slate-400 hover:text-rose-600">
                  {t("manual.resetButton", { count: Object.keys(overrides).length })}
                </button>
              )}
            </div>
            {result.failedManual > 0 && (
              <p className="text-xs font-semibold text-rose-600">
                {result.failedManual === 1
                  ? t("manual.failedOne")
                  : t("manual.failedMany", { count: result.failedManual })}
              </p>
            )}
            <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
              {[
                ["bg-emerald-600", t("legend.vacation")],
                ["bg-sky-600", t("legend.overtime")],
                ["bg-rose-600", t("legend.holiday")],
                ["bg-amber-300", t("legend.xmasFree")],
                ["bg-amber-100 border border-amber-300", t("legend.xmasHalf")],
                [dark ? "bg-slate-700" : "bg-slate-200", t("legend.weekend")],
                // Nur relevant (und daher nur sichtbar), wenn von Montag–Freitag
                // abgewichen wird – überlädt die Legende sonst unnötig.
                ...(isDefaultWorkweek ? [] : [[
                  dark ? "bg-slate-800/60 border border-dashed border-slate-700" : "bg-slate-100 border border-dashed border-slate-300",
                  t("legend.regularlyOff"),
                ]]),
                [dark ? "bg-slate-800 ring-2 ring-slate-400" : "bg-white ring-2 ring-slate-500", t("legend.manualSet")],
                ["bg-orange-400", t("legend.schoolHolidays")],
                // Swatch als Rahmen statt Füllung, passend zur tatsächlichen
                // Darstellung im Kalender (dünner Innenrahmen, kein Flächenfüllen).
                [`bg-transparent border-2 rounded ${dark ? "border-emerald-300" : "border-emerald-600"}`, t("legend.freePeriod")],
              ].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block w-3 h-3 rounded-sm ${c}`} /> {l}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              {t("manual.helpText")}
              <InfoHint dark={dark} text={t("manual.helpDetail")} />
            </p>
          </section>

          {/* Jahreskalender */}
          {calendarSection}
          {vacTip && (
            <p className="text-[11px] text-orange-500">{vacTip.text}</p>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            {t("footerHint.text")}
            <InfoHint dark={dark} text={t("footerHint.detail")} />
          </p>
        </div>
          </div>
        )}
      </main>

      <SiteFooter dark={dark} />

      {/* Dialog: geplanten Tag entfernen oder tauschen */}
      {dialogDay !== null && result.sel[dialogDay] && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${dark ? "bg-black/60" : "bg-slate-900/40"}`}
          onClick={() => setDialogDay(null)}>
          <div className={`w-full max-w-xs rounded-xl p-4 shadow-xl space-y-3 ${dark ? "bg-slate-900 border border-slate-700" : "bg-white"}`}
            onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-bold">{fmtDate(days[dialogDay])}</p>
              <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {t("dayDialog.currentLabel", {
                  type: result.sel[dialogDay] === "vac" ? t("dayDialog.vacationDayType") : t("dayType.overtime"),
                  half: days[dialogDay].cost === 0.5,
                })}
              </p>
            </div>
            <div className="space-y-2">
              <button onClick={() => applyDialog("swap")}
                className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-white ${
                  result.sel[dialogDay] === "vac" ? "bg-sky-600 hover:bg-sky-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}>
                {t("dayDialog.swapButton", { target: result.sel[dialogDay] === "vac" ? t("dayType.overtime") : t("dayDialog.vacationDayType") })}
              </button>
              <button onClick={() => applyDialog("remove")}
                className="w-full rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                {t("dayDialog.removeButton")}
              </button>
              <button onClick={() => setDialogDay(null)}
                className={`w-full rounded-md px-3 py-2 text-sm ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
                {t("dayDialog.cancelButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback-Dialog: Link manuell kopieren (wenn navigator.share und
          Clipboard-API nicht verfügbar sind) */}
      {copyUrl && (
        <div role="dialog" aria-modal="true" aria-label={t("share.modal.title")}
          className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${dark ? "bg-black/60" : "bg-slate-900/40"}`}
          onClick={() => setCopyUrl(null)}>
          <div className={`w-full max-w-md rounded-xl p-4 shadow-xl space-y-3 ${dark ? "bg-slate-900 border border-slate-700" : "bg-white"}`}
            onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">{t("share.modal.title")}</p>
            <p className={`text-[11px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}>
              {t("share.modal.privacyNote")}
            </p>
            <label htmlFor="share-url-input" className="sr-only">{t("share.modal.linkLabel")}</label>
            <input id="share-url-input" readOnly value={copyUrl}
              onFocus={(e) => e.target.select()} className={inputCls} />
            <div className="flex gap-2">
              <button onClick={copyFromModal}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {t("share.modal.copyButton")}
              </button>
              <button onClick={() => setCopyUrl(null)}
                className={`rounded-md px-3 py-2 text-sm ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
                {t("share.modal.closeButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Kurze Statusmeldung (Screenreader-freundlich) */}
      {toast && (
        <div role="status" aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function App() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, "") || "/");
  const [planReady, setPlanReady] = useState(false);
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname.replace(/\/+$/, "") || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const page = path === "/impressum" ? <ImpressumPage />
    : path === "/datenschutz" ? <DatenschutzPage />
    : <Urlaubsplaner onPlanReady={() => setPlanReady(true)} />;

  return (
    <>
      {page}
      <KofiFloatingButton planReady={planReady} path={path} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
