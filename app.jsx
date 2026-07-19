const { useEffect, useMemo, useRef, useState } = React;

/* ------------------------------------------------------------------ */
/* Daten: Bundesländer, Feiertage                                      */
/* ------------------------------------------------------------------ */

const STATES = {
  BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg",
  HB: "Bremen", HH: "Hamburg", HE: "Hessen", MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz",
  SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein", TH: "Thüringen",
};

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DOWS = ["So","Mo","Di","Mi","Do","Fr","Sa"];

// Gauß'sche Osterformel (gregorianisch) -> UTC-Timestamp des Ostersonntags
function easterUTC(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}

const DAY = 86400000;

function holidayMap(year, st) {
  const H = {}; // key "m-d" (m: 0-basiert)
  const fix = (m, d, name, states) => {
    if (!states || states.includes(st)) H[`${m}-${d}`] = name;
  };
  const easter = easterUTC(year);
  const rel = (offset, name, states) => {
    if (states && !states.includes(st)) return;
    const dt = new Date(easter + offset * DAY);
    H[`${dt.getUTCMonth()}-${dt.getUTCDate()}`] = name;
  };

  fix(0, 1, "Neujahr");
  fix(0, 6, "Heilige Drei Könige", ["BW", "BY", "ST"]);
  fix(2, 8, "Internationaler Frauentag", ["BE", "MV"]);
  rel(-2, "Karfreitag");
  rel(0, "Ostersonntag", ["BB"]);
  rel(1, "Ostermontag");
  fix(4, 1, "Tag der Arbeit");
  rel(39, "Christi Himmelfahrt");
  rel(49, "Pfingstsonntag", ["BB"]);
  rel(50, "Pfingstmontag");
  rel(60, "Fronleichnam", ["BW", "BY", "HE", "NW", "RP", "SL"]);
  fix(7, 15, "Mariä Himmelfahrt", ["SL", "BY"]);
  fix(8, 20, "Weltkindertag", ["TH"]);
  fix(9, 3, "Tag der Deutschen Einheit");
  fix(9, 31, "Reformationstag", ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"]);
  fix(10, 1, "Allerheiligen", ["BW", "BY", "NW", "RP", "SL"]);
  fix(11, 25, "1. Weihnachtstag");
  fix(11, 26, "2. Weihnachtstag");
  if (st === "SN") {
    // Buß- und Bettag: Mittwoch vor dem 23.11.
    for (let d = 16; d <= 22; d++) {
      if (new Date(Date.UTC(year, 10, d)).getUTCDay() === 3) { H[`10-${d}`] = "Buß- und Bettag"; break; }
    }
  }
  return H;
}

/* ------------------------------------------------------------------ */
/* Kalender + Optimierung                                              */
/* ------------------------------------------------------------------ */

function buildDays(year, st, xmasRule, extHolidays) {
  // Externe Daten (API) haben Vorrang; sonst integrierte Berechnung als Fallback
  const H = extHolidays || holidayMap(year, st);
  const days = [];
  for (let t = Date.UTC(year, 0, 1); ; t += DAY) {
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== year) break;
    const m = dt.getUTCMonth(), d = dt.getUTCDate(), dow = dt.getUTCDay();
    const holiday = H[`${m}-${d}`] || null;
    const special = m === 11 && d === 24 ? "Heiligabend" : m === 11 && d === 31 ? "Silvester" : null;
    const weekend = dow === 0 || dow === 6;
    let cost = 1;
    if (weekend || holiday) cost = 0;
    else if (special) cost = xmasRule === "0" ? 0 : xmasRule === "50" ? 0.5 : 1;
    days.push({ i: days.length, m, d, dow, holiday, special, weekend, cost });
  }
  return days;
}

// Wandelt die von der API gelieferten Ferien-Zeiträume in eine Map
// "m-d" -> { name, start, end } um, begrenzt auf das sichtbare Kalenderjahr.
// Reine Datenaufbereitung – getrennt von API-Aufruf und Darstellung.
function vacationDayMap(periods, year) {
  const map = {};
  if (!Array.isArray(periods)) return map;
  for (const p of periods) {
    if (!p || !p.start || !p.end) continue; // ungültige Einträge überspringen
    const s = new Date(p.start), e = new Date(p.end);
    if (isNaN(s) || isNaN(e) || e < s) continue;
    // Auf die im Kalender sichtbaren Tage des gewählten Jahres begrenzen
    // (Ferien über den Jahreswechsel werden so korrekt beschnitten).
    let t = Math.max(Date.UTC(year, 0, 1), Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
    const end = Math.min(Date.UTC(year, 11, 31), Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
    for (; t <= end; t += DAY) {
      const dt = new Date(t);
      const key = `${dt.getUTCMonth()}-${dt.getUTCDate()}`;
      if (!map[key]) map[key] = { name: p.name_cp || p.name || "Schulferien", start: s, end: e };
    }
  }
  return map;
}

// Minimalbudget: Summe der Kosten aller isolierten Lücken mit Kosten <= 1 Tag.
// Das sind die klassischen Brückentage mit maximalem Hebel:
// 1 investierter Tag erzeugt i. d. R. 4 zusammenhängende freie Tage.
function minimalBridgeBudget(days, fromMonth = 0) {
  const n = days.length;
  let sum = 0, j = 0;
  while (j < n) {
    if (days[j].cost === 0) { j++; continue; }
    const s = j;
    let c = 0;
    while (j < n && days[j].cost > 0) { c += days[j].cost; j++; }
    if (c > 0 && c <= 1 && s > 0 && j < n && days[s].m >= fromMonth) sum += c; // beidseitig flankiert, ab Wunschmonat
  }
  return sum;
}

function plan(days, cfg) {
  const n = days.length;
  const sel = new Array(n).fill(null); // 'vac' | 'ot'
  const origin = new Array(n).fill(null); // 'manual' | 'block' | 'auto'
  const budget = { vac: cfg.vac, ot: cfg.ot };
  // Budget, das die automatische Verteilung (Phase 2) maximal einsetzen darf.
  // Wunschblöcke (Phase 1) nutzen weiterhin das volle Budget.
  const auto = { vac: cfg.autoVac ?? Infinity, ot: cfg.autoOt ?? Infinity };
  // Manuelle Eingriffe des Nutzers per Klick im Kalender
  const ovr = cfg.overrides || {};
  const blocked = new Array(n).fill(false); // vom Nutzer entfernte Tage bleiben Arbeitstage
  const holidayPref = cfg.schoolHolidayPreference || "neutral"; // prefer | avoid | neutral
  const vacSet = cfg.vacationDays || {}; // m-d -> true, nur fuer die Sortierung genutzt
  const free = (j) => days[j].cost === 0 || sel[j] !== null;

  const spend = (j, preferOt, otCapRef) => {
    if (blocked[j]) return false;
    const c = days[j].cost;
    const canOt = otCapRef ? otCapRef.left >= c && budget.ot >= c : budget.ot >= c;
    if (preferOt && canOt) {
      sel[j] = "ot"; budget.ot -= c; if (otCapRef) otCapRef.left -= c; return true;
    }
    if (budget.vac >= c) { sel[j] = "vac"; budget.vac -= c; return true; }
    if (budget.ot >= c) { sel[j] = "ot"; budget.ot -= c; return true; }
    return false;
  };

  /* --- Phase 0: manuelle Klicks des Nutzers (höchste Priorität) ---
     "vac"/"ot": fest gesetzter Urlaubs- bzw. Überstundentag.
     "none": Tag wurde entfernt und bleibt Arbeitstag – keine Phase darf ihn belegen. */
  let failedManual = 0;
  for (let j = 0; j < n; j++) {
    const o = ovr[`${days[j].m}-${days[j].d}`];
    if (!o || days[j].cost === 0) continue;
    if (o === "none") { blocked[j] = true; continue; }
    const c = days[j].cost;
    if (o === "vac" && budget.vac >= c - 1e-9) { sel[j] = "vac"; budget.vac -= c; origin[j] = "manual"; }
    else if (o === "ot" && budget.ot >= c - 1e-9) { sel[j] = "ot"; budget.ot -= c; origin[j] = "manual"; }
    else failedManual++;
  }

  /* --- Phase 1: Wunschblöcke (priorisiert) --- */
  const blockResults = [];
  for (const b of cfg.blocks) {
    const len = Math.max(1, Math.floor(b.len || 0));
    if (!b.len) { blockResults.push({ b, placed: false }); continue; }
    let best = null;
    for (let s = 0; s + len <= n; s++) {
      if (b.month !== null && days[s].m !== b.month) continue;
      let c = 0, hasBlocked = false;
      for (let j = s; j < s + len; j++) if (!free(j)) { c += days[j].cost; if (blocked[j]) hasBlocked = true; }
      if (hasBlocked || c > budget.vac + budget.ot + 1e-9) continue;
      let ext = 0, k = s - 1;
      while (k >= 0 && free(k)) { ext++; k--; }
      k = s + len;
      while (k < n && free(k)) { ext++; k++; }
      if (!best || c < best.c - 1e-9 || (Math.abs(c - best.c) < 1e-9 && ext > best.ext)) best = { s, c, ext };
    }
    if (best) {
      const otCapRef = { left: b.ot ?? 0 };
      for (let j = best.s; j < best.s + len; j++) if (!free(j) && spend(j, true, otCapRef)) origin[j] = "block";
      blockResults.push({ b, placed: true, start: best.s, end: best.s + len - 1, cost: best.c });
    } else {
      blockResults.push({ b, placed: false });
    }
  }

  /* --- Phase 1b: 24.12. und 31.12. immer freinehmen, wenn sie etwas kosten ---
     Bei 100%- oder 50%-Regelung würden diese Tage sonst die Weihnachts- bzw.
     Silvester-Serie unterbrechen. Sie werden daher fest eingeplant (unabhängig
     vom Budget der automatischen Verteilung), Reihenfolge gemäß spendFirst.
     Bei 0%-Regelung oder am Wochenende sind sie ohnehin frei. */
  for (let j = 0; j < n; j++) {
    if (days[j].special && !free(j) && !blocked[j]) {
      const c = days[j].cost;
      const tryVac = () => {
        if (budget.vac >= c - 1e-9) { sel[j] = "vac"; budget.vac -= c; origin[j] = "auto"; return true; }
        return false;
      };
      const tryOt = () => {
        if (budget.ot >= c - 1e-9) { sel[j] = "ot"; budget.ot -= c; origin[j] = "auto"; return true; }
        return false;
      };
      if (cfg.spendFirst === "ot") { tryOt() || tryVac(); } else { tryVac() || tryOt(); }
    }
  }

  /* --- Phase 2: Brückentage nach strengem ROI-Prinzip ---
     Die Automatik kauft Lücken stufenweise nach Rendite:
     Stufe 1 sind ausschließlich isolierte 1-Tages-Lücken (1 Tag -> ~4 freie
     Tage). Erst wenn keine 1-Tages-Lücke mehr existiert UND noch Auto-Budget
     übrig ist, kommen 2-, 3- und zuletzt 4-Tages-Lücken infrage. Reine
     Urlaubswochen ohne Feiertag werden nie automatisch verplant.
     Innerhalb einer Stufe gilt: beste Effizienz zuerst, pro Runde höchstens
     eine Lücke je Monat (Verteilung übers Jahr). Nicht lohnender Einsatz
     unterbleibt; Restbudget bleibt übrig. */
  const MIN_EFF = 2;
  const MAX_GAP_COST = 4;
  const FLANK_CAP = 4; // angrenzende freie Tage gedeckelt zählen, damit eine
  // bereits lange Serie nicht immer weitere Käufe rechtfertigt
  const autoFrom = cfg.autoFromMonth ?? 0; // Automatik plant nur Lücken ab diesem Monat
  const spendAuto = (j) => {
    if (blocked[j]) return false;
    const c = days[j].cost;
    const tryVac = () => {
      if (auto.vac >= c - 1e-9 && budget.vac >= c - 1e-9) {
        sel[j] = "vac"; budget.vac -= c; auto.vac -= c; origin[j] = "auto"; return true;
      }
      return false;
    };
    const tryOt = () => {
      if (auto.ot >= c - 1e-9 && budget.ot >= c - 1e-9) {
        sel[j] = "ot"; budget.ot -= c; auto.ot -= c; origin[j] = "auto"; return true;
      }
      return false;
    };
    // Reihenfolge wählbar: erst Urlaub oder erst Überstundenabbau aufbrauchen
    return cfg.spendFirst === "ot" ? tryOt() || tryVac() : tryVac() || tryOt();
  };
  let guard = 0;
  let usedMonths = new Set();
  while (guard++ < 400) {
    const pool = Math.min(auto.vac, budget.vac) + Math.min(auto.ot, budget.ot);
    if (pool < 0.5 - 1e-9) break;
    // Lücken (zusammenhängende Arbeitstage zwischen freien Tagen) sammeln
    const gaps = [];
    let j = 0;
    while (j < n) {
      if (free(j)) { j++; continue; }
      const s = j;
      let c = 0, hasBlocked = false;
      while (j < n && !free(j)) { c += days[j].cost; if (blocked[j]) hasBlocked = true; j++; }
      const e = j - 1;
      if (!hasBlocked && c > 0 && c <= MAX_GAP_COST && c <= pool + 1e-9 && days[s].m >= autoFrom) {
        let before = 0, k = s - 1;
        while (k >= 0 && free(k)) { before++; k--; }
        let after = 0; k = e + 1;
        while (k < n && free(k)) { after++; k++; }
        if (before > 0 && after > 0) {
          const eff = (Math.min(before, FLANK_CAP) + (e - s + 1) + Math.min(after, FLANK_CAP)) / c;
          if (eff >= MIN_EFF - 1e-9) gaps.push({ s, e, c, eff, month: days[s].m });
        }
      }
    }
    if (gaps.length === 0) break;
    // ROI-Stufe: nur die Lücken mit den geringsten Kosten kommen infrage
    const minTier = Math.min(...gaps.map((g) => Math.ceil(g.c - 1e-9)));
    // Anteil der Ferientage einer Lücke (0..1). Bei "neutral" ist der Ferienwert
    // per Definition exakt 0 (share wird gar nicht erst berechnet).
    const vacShare = (g) => {
      if (holidayPref === "neutral") return 0;
      let hit = 0, tot = 0;
      for (let k = g.s; k <= g.e; k++) { tot++; if (vacSet[`${days[k].m}-${days[k].d}`]) hit++; }
      return tot ? hit / tot : 0;
    };
    // Additives Scoring: Der Ferienwert fließt als eigener Summand in die
    // Bewertung ein und kann so – anders als ein reiner Tie-Breaker – die
    // Auswahl zwischen ähnlich effizienten Lücken tatsächlich kippen.
    // prefer und avoid nutzen exakt spiegelbildliche Gewichte (+W · share
    // gegenüber −W · share); bei "neutral" ist der Zusatzterm 0.
    const HOLIDAY_WEIGHT = 1.2;
    const holidayScore = (g) => {
      if (holidayPref === "neutral") return 0;
      const signed = holidayPref === "prefer" ? vacShare(g) : -vacShare(g);
      return HOLIDAY_WEIGHT * signed;
    };
    const score = (g) => g.eff + holidayScore(g);
    const tier = gaps
      .filter((g) => Math.ceil(g.c - 1e-9) === minTier)
      // Primärkriterium ist der Gesamtscore (Effizienz + Ferienwert), erst
      // danach reine Effizienz und Position als Tie-Breaker.
      .sort((a, b) => score(b) - score(a) || b.eff - a.eff || a.s - b.s);

    // Vorübergehende Debug-Ausgabe je betrachteter Lücke (nur bei aktiver
    // Präferenz), zeigt Ferienüberschneidung, Feriengewichtung und Gesamtscore.
    if (cfg.debugHolidayScoring && holidayPref !== "neutral") {
      for (const g of tier) {
        const share = vacShare(g);
        console.log(
          `[Ferien-Debug] ${holidayPref} Lücke Tag ${g.s}-${g.e} (Monat ${g.month + 1})` +
          ` | Kosten ${g.c.toFixed(1)} | eff ${g.eff.toFixed(2)}` +
          ` | Ferienanteil ${(share * 100).toFixed(0)}% | Feriengewicht ${holidayScore(g).toFixed(2)}` +
          ` | Gesamtscore ${score(g).toFixed(2)}`
        );
      }
    }
    let pick = tier.find((g) => !usedMonths.has(g.month));
    if (!pick) { usedMonths = new Set(); pick = tier[0]; } // neue Verteilrunde
    usedMonths.add(pick.month);
    let spent = false;
    for (let k = pick.s; k <= pick.e; k++) if (!free(k)) spent = spendAuto(k) || spent;
    if (!spent) break; // Budget lässt sich nicht mehr einsetzen (z. B. gesplittet)
  }

  /* --- Auswertung: freie Perioden mit Herkunft der eingesetzten Tage --- */
  const periods = [];
  let j2 = 0;
  while (j2 < n) {
    if (!free(j2)) { j2++; continue; }
    const s = j2;
    let vacC = 0, otC = 0, hasSel = false;
    const orig = new Set();
    while (j2 < n && free(j2)) {
      if (sel[j2] === "vac") { vacC += days[j2].cost; hasSel = true; }
      if (sel[j2] === "ot") { otC += days[j2].cost; hasSel = true; }
      if (origin[j2]) orig.add(origin[j2]);
      j2++;
    }
    const e = j2 - 1;
    // Platzierte Wunschblöcke zählen auch dann, wenn sie keinen Tag gekostet haben
    for (const r of blockResults) if (r.placed && r.start >= s && r.end <= e) orig.add("block");
    if (hasSel || orig.has("block")) {
      periods.push({ s, e, len: e - s + 1, vac: vacC, ot: otC, origins: [...orig] });
    }
  }
  return { sel, budget, periods, blockResults, failedManual };
}

/* ------------------------------------------------------------------ */
/* Hilfen fürs Rendering                                               */
/* ------------------------------------------------------------------ */

const fmtNum = (x) => (x % 1 === 0 ? String(x) : x.toFixed(1).replace(".", ","));
const fmtDate = (day) => `${DOWS[day.dow]} ${String(day.d).padStart(2, "0")}.${String(day.m + 1).padStart(2, "0")}.`;

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
  if (day.weekend) return dark ? "bg-slate-800 text-slate-600" : "bg-slate-200 text-slate-400";
  return dark ? "bg-slate-800 text-slate-200 border border-slate-600" : "bg-white text-slate-700 border border-slate-200";
}

function dayTitle(day, selType) {
  const parts = [fmtDate(day)];
  if (day.holiday) parts.push(day.holiday);
  if (day.special) parts.push(day.special);
  if (selType === "vac") parts.push("Urlaub");
  if (selType === "ot") parts.push("Überstundenabbau");
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */
/* Wiederverwendbare UI-Bausteine                                      */
/* ------------------------------------------------------------------ */

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
      <button type="button" onClick={() => setShow(!show)} title="Mehr erfahren"
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

/* ------------------------------------------------------------------ */
/* Teilen: versionierter Share-Link im URL-Fragment                    */
/* ------------------------------------------------------------------ */
/* Es werden ausschließlich EINGABEN gespeichert. Der Plan (auto. Tage,
   Farben, Legende, Tooltips, Kontingente) wird beim Laden deterministisch
   über plan(days,cfg) neu berechnet. Feiertage und Schulferien werden aus
   Jahr + Bundesland erneut geladen und daher NICHT im Link abgelegt.

   Format:
   - Neu:    #p=<base64url(deflate(JSON))>   – kompakt, via CompressionStream
   - Alt:    #plan=<base64url(JSON)>         – unverändert lesbar (Abwärtskompat.)
   Ist CompressionStream/DecompressionStream nicht verfügbar, wird beim
   Erstellen automatisch das alte #plan=-Verfahren genutzt. */

const SHARE_VERSION = 1;
const SHARE_MAX_URL = 8000;        // praktische URL-Obergrenze
const SHARE_MAX_DECODED = 100000;  // Schutz vor übermäßig großen (auch dekomprimierten) Payloads
const SHARE_MAX_OVERRIDES = 400;   // Obergrenze manueller Tage
const SHARE_MAX_BLOCKS = 20;

const XMAS_RULES = ["0", "50", "100"];
const UI_MODES = ["einfach", "profi"];
const SIMPLE_GOALS = ["free", "blocks", "short"];
const SCHOOL_PREFS = ["prefer", "avoid", "neutral"];
const SPEND_FIRST = ["vac", "ot"];

// Kompression nur nutzen, wenn beide Stream-APIs vorhanden sind
// (Chrome/Edge ≥80, Firefox ≥113, Safari ≥16.4 – Desktop und Mobil).
const HAS_COMPRESSION =
  typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

// Bytes <-> base64url. TextEncoder/Decoder sorgen für korrekte Unicode-Behandlung.
function bytesToB64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// JSON-String -> deflate -> base64url. Asynchron (Stream-API).
// Über Blob().stream().pipeThrough() geführt: eine einzige awaitbare Rejection,
// keine hängenden Writer-Promises (die bei kaputten Daten sonst als
// unhandledRejection auftauchen würden).
async function deflateToB64url(str) {
  const stream = new Blob([new TextEncoder().encode(str)]).stream()
    .pipeThrough(new CompressionStream("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  return bytesToB64url(new Uint8Array(buf));
}
// base64url(deflate) -> inflate -> JSON-String. Asynchron (Stream-API).
// Wirft bei beschädigten Daten – der Aufrufer fängt das ab und meldet den Link
// als nicht lesbar.
async function inflateFromB64url(b64) {
  const stream = new Blob([b64urlToBytes(b64)]).stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}

// "m-d" (m 0-basiert) prüfen – inkl. echter Kalenderprüfung fürs Jahr,
// damit z. B. der 30.02. oder ungültige Werte zuverlässig abgewiesen werden.
function isValidMd(md, year) {
  if (typeof md !== "string") return false;
  const p = md.split("-");
  if (p.length !== 2) return false;
  const m = parseInt(p[0], 10), d = parseInt(p[1], 10);
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 0 || m > 11 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(year, m, d));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === m && dt.getUTCDate() === d;
}

// Baut das kompakte, versionierte Share-Objekt aus einem Zustands-Snapshot.
// overridesMd: Map "m-d" -> "vac"|"ot"|"none" (nur das geteilte Jahr).
function buildSharePayload(s) {
  const ov = { v: [], o: [], n: [] };
  for (const [md, val] of Object.entries(s.overridesMd || {})) {
    if (val === "vac") ov.v.push(md);
    else if (val === "ot") ov.o.push(md);
    else if (val === "none") ov.n.push(md);
  }
  const blocks = (s.blocks || []).slice(0, SHARE_MAX_BLOCKS).map((b) => [
    String(b.len ?? ""), String(b.month ?? ""), String(b.ot ?? ""),
  ]);
  return {
    version: SHARE_VERSION,
    state: {
      y: s.year, st: s.st, vac: s.vac, ot: s.ot, x: s.xmasRule,
      m: s.uiMode, g: s.simpleGoal, ss: s.simpleStarted ? 1 : 0,
      sh: s.schoolHolidayPreference, av: s.autoVac, ao: s.autoOt,
      sf: s.spendFirst, af: s.autoFrom, wh: s.showWeekendHolidays ? 1 : 0,
      b: blocks, ov,
    },
  };
}

// JSON-Payload -> base64url (unkomprimiert, für das alte #plan=-Format).
function encodePlain(payload) {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
}

// Validiert einen bereits dekodierten JSON-String (gilt für beide Formate:
// #plan= liefert ihn synchron über atob, #p= asynchron über inflate).
// Rückgabe:
//   { state, warning }  – ladbar (warning=true: Teile korrigiert/verworfen)
//   null                – nicht ladbar (kaputt / falsche Version / zu groß)
function validateSharePayload(jsonStr) {
  if (typeof jsonStr !== "string" || jsonStr.length > SHARE_MAX_DECODED) return null;
  let payload;
  try { payload = JSON.parse(jsonStr); } catch (e) { return null; }
  if (!payload || typeof payload !== "object") return null;
  if (payload.version !== SHARE_VERSION) return null; // unbekannte/veraltete Version
  const raw = payload.state;
  if (!raw || typeof raw !== "object") return null;

  let warn = false;
  const out = {
    year: new Date().getFullYear(), st: "BY", vac: 30, ot: 0, xmasRule: "50",
    uiMode: "einfach", simpleGoal: "free", simpleStarted: false,
    schoolHolidayPreference: "neutral", autoVac: "", autoOt: "0",
    spendFirst: "vac", autoFrom: 0, showWeekendHolidays: true, blocks: [], overridesMd: {},
  };
  const bad = (present) => { if (present) warn = true; };

  const y = parseInt(raw.y, 10);
  if (Number.isInteger(y) && y >= 1970 && y <= 2100) out.year = y; else bad(raw.y !== undefined);
  if (typeof raw.st === "string" && Object.prototype.hasOwnProperty.call(STATES, raw.st)) out.st = raw.st; else bad(raw.st !== undefined);
  const vac = Number(raw.vac); if (Number.isFinite(vac) && vac >= 0 && vac <= 366) out.vac = vac; else bad(raw.vac !== undefined);
  const ot = Number(raw.ot); if (Number.isFinite(ot) && ot >= 0 && ot <= 366) out.ot = ot; else bad(raw.ot !== undefined);
  if (XMAS_RULES.includes(raw.x)) out.xmasRule = raw.x; else bad(raw.x !== undefined);
  if (UI_MODES.includes(raw.m)) out.uiMode = raw.m; else bad(raw.m !== undefined);
  if (SIMPLE_GOALS.includes(raw.g)) out.simpleGoal = raw.g; else bad(raw.g !== undefined);
  if (SCHOOL_PREFS.includes(raw.sh)) out.schoolHolidayPreference = raw.sh; else bad(raw.sh !== undefined);
  if (SPEND_FIRST.includes(raw.sf)) out.spendFirst = raw.sf; else bad(raw.sf !== undefined);
  out.simpleStarted = raw.ss === 1 || raw.ss === true;
  out.showWeekendHolidays = raw.wh === undefined ? true : (raw.wh === 1 || raw.wh === true);
  const af = parseInt(raw.af, 10); if (Number.isInteger(af) && af >= 0 && af <= 11) out.autoFrom = af; else bad(raw.af !== undefined);
  out.autoVac = raw.av === "" ? "" : (Number.isFinite(Number(raw.av)) && raw.av != null ? String(raw.av) : "");
  out.autoOt = Number.isFinite(Number(raw.ao)) && raw.ao != null ? String(raw.ao) : "0";

  if (Array.isArray(raw.b)) {
    if (raw.b.length > SHARE_MAX_BLOCKS) warn = true;
    out.blocks = raw.b.slice(0, SHARE_MAX_BLOCKS).map((t) => {
      const a = Array.isArray(t) ? t : [];
      const len = Number(a[0]);
      const mo = a[1], otv = a[2];
      return {
        len: Number.isFinite(len) && len >= 1 ? len : 9,
        month: mo === "" || mo == null ? "" : (Number.isInteger(parseInt(mo, 10)) ? String(parseInt(mo, 10)) : ""),
        ot: otv === "" || otv == null ? "" : String(Number(otv) || 0),
      };
    });
  } else bad(raw.b !== undefined);

  // Overrides einlesen + Konflikte erkennen: taucht ein Datum in mehreren
  // Kategorien auf, wird es NICHT stillschweigend übernommen, sondern
  // vollständig verworfen und als Hinweis markiert. Doppelte Datumswerte
  // innerhalb einer Kategorie werden dedupliziert.
  const ovIn = raw.ov && typeof raw.ov === "object" ? raw.ov : {};
  const seen = {}; // md -> "vac"|"ot"|"none"|"CONFLICT"
  const readList = (list, type) => {
    if (list === undefined) return;
    if (!Array.isArray(list)) { warn = true; return; }
    for (const md of list) {
      if (!isValidMd(md, out.year)) { warn = true; continue; }
      if (seen[md] === undefined) seen[md] = type;
      else if (seen[md] !== type) { seen[md] = "CONFLICT"; warn = true; }
    }
  };
  readList(ovIn.v, "vac");
  readList(ovIn.o, "ot");
  readList(ovIn.n, "none");
  let count = 0;
  for (const [md, type] of Object.entries(seen)) {
    if (type === "CONFLICT") continue;
    if (count >= SHARE_MAX_OVERRIDES) { warn = true; break; }
    out.overridesMd[md] = type; count++;
  }

  return { state: out, warning: warn };
}

// Synchroner Dekoder für das alte #plan=-Format (base64url(JSON)).
function decodeShare(enc) {
  if (!enc || typeof enc !== "string" || enc.length > SHARE_MAX_DECODED) return null;
  let jsonStr;
  try {
    const bytes = b64urlToBytes(enc);
    if (bytes.length > SHARE_MAX_DECODED) return null;
    jsonStr = new TextDecoder().decode(bytes);
  } catch (e) { return null; }
  return validateSharePayload(jsonStr);
}

// Wert eines Schlüssels aus dem URL-Fragment lesen (robust ggü. mehreren
// &-getrennten Parametern; "p" und "plan" werden exakt unterschieden).
function getHashParam(hash, key) {
  const h = (hash || "").replace(/^#/, "");
  for (const part of h.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === key) return part.slice(eq + 1);
  }
  return null;
}

// Erkennt das im Fragment vorliegende Format. #p= (komprimiert) hat Vorrang.
// Rückgabe: { type: "p"|"plan", raw } oder null.
function readShareFragment(hash) {
  const h = (hash != null ? hash : (typeof window !== "undefined" ? window.location.hash : "")) || "";
  const p = getHashParam(h, "p");
  if (p != null && p !== "") return { type: "p", raw: p };
  const legacy = getHashParam(h, "plan");
  if (legacy != null && legacy !== "") return { type: "plan", raw: legacy };
  return null;
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function Urlaubsplaner() {
  const currentYear = new Date().getFullYear();
  // Geteilte Planung EINMAL aus dem URL-Fragment lesen, bevor die States
  // initialisiert werden. Das alte #plan=-Format wird synchron dekodiert und
  // fließt direkt in die useState-Initialwerte (kein Flackern, keine Race).
  // Das neue #p=-Format ist deflate-komprimiert und lässt sich nur asynchron
  // (DecompressionStream) lesen; es wird daher erst im Mount-Effekt angewendet.
  const sharedRef = useRef(undefined);
  if (sharedRef.current === undefined) {
    const frag = readShareFragment(typeof window !== "undefined" ? window.location.hash : "");
    const parsed = frag && frag.type === "plan" ? decodeShare(frag.raw) : null;
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
  // Einfach-/Profi-Modus: neuer UI-Modus, die Logik bleibt unverändert
  const [uiMode, setUiMode] = useState(shared ? shared.uiMode : "einfach"); // "einfach" | "profi"
  const [simpleGoal, setSimpleGoal] = useState(shared ? shared.simpleGoal : "free"); // free | blocks | short
  const [simpleStarted, setSimpleStarted] = useState(shared ? shared.simpleStarted : false);
  const [showSimpleCal, setShowSimpleCal] = useState(false);
  // Eingeklappte Bereiche pro Gerät merken; Standard: mobil nur "Allgemein" offen
  const [panels, setPanels] = useState(() => {
    try {
      const saved = localStorage.getItem("urlaubsplaner-panels");
      if (saved) return JSON.parse(saved);
    } catch (e) { /* z. B. Vorschau-Umgebungen ohne Local Storage */ }
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return { allgemein: true, regelung: !mobile, auto: !mobile, bloecke: !mobile };
  });
  const togglePanel = (key) => {
    setPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("urlaubsplaner-panels", JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

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
    let ignore = false;
    setApiStatus("laedt");
    setApiHolidays(null);
    fetch(`https://feiertage-api.de/api/?jahr=${year}&nur_land=${st}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (ignore) return;
        const map = {};
        for (const [name, info] of Object.entries(json)) {
          if (!info || !info.datum) continue;
          if (name.toLowerCase().includes("augsburg")) continue; // gilt nur in der Stadt Augsburg
          const [yy, mm, dd] = info.datum.split("-").map((x) => parseInt(x, 10));
          if (yy === year && mm >= 1 && dd >= 1) map[`${mm - 1}-${dd}`] = name;
        }
        if (Object.keys(map).length === 0) throw new Error("keine Daten");
        setApiHolidays(map);
        setApiStatus("api");
      })
      .catch(() => {
        if (!ignore) { setApiHolidays(null); setApiStatus("lokal"); }
      });
    return () => { ignore = true; };
  }, [year, st]);

  const days = useMemo(() => buildDays(year, st, xmasRule, apiHolidays), [year, st, xmasRule, apiHolidays]);

  // Schulferien von schulferien-api.de laden (V1: /api/v1/{jahr}/{kürzel}/).
  // Nur Planungshinweis – fließt NICHT in die Berechnung ein.
  // Ergebnisse werden pro Kombination aus Jahr und Bundesland zwischengespeichert.
  const [vacations, setVacations] = useState([]); // roh geladene Zeiträume
  const [vacStatus, setVacStatus] = useState("laedt"); // "laedt" | "ok" | "fehler"
  const vacCache = useRef({}); // { "jahr-kürzel": periods[] } – vermeidet doppelte Aufrufe
  useEffect(() => {
    let ignore = false;
    const cacheKey = `${year}-${st}`;
    if (vacCache.current[cacheKey]) {
      setVacations(vacCache.current[cacheKey]);
      setVacStatus("ok");
      return;
    }
    setVacStatus("laedt");
    setVacations([]);
    fetch(`https://schulferien-api.de/api/v1/${year}/${st}/`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => {
        if (ignore) return;
        // Nur echte Schulferien behalten; ungültige Einträge herausfiltern
        const periods = Array.isArray(json) ? json.filter((p) => p && p.start && p.end) : [];
        vacCache.current[cacheKey] = periods;
        setVacations(periods);
        setVacStatus("ok");
      })
      .catch(() => { if (!ignore) { setVacations([]); setVacStatus("fehler"); } });
    return () => { ignore = true; };
  }, [year, st]);

  // Ferien-Tagesmap fürs sichtbare Jahr (beide Modi nutzen dieselben Daten)
  const vacationDays = useMemo(() => vacationDayMap(vacations, year), [vacations, year]);

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
      schoolHolidayPreference,
      vacationDays: schoolHolidayPreference === "neutral" ? null : vacationDays,
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
  }, [days, vac, ot, blocks, effAutoVac, effAutoOt, spendFirst, autoFrom, yearOverrides, schoolHolidayPreference, vacationDays]);

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
      blocks, overridesMd: yearOverrides,
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
    const o = {};
    for (const [md, val] of Object.entries(s.overridesMd || {})) o[`${s.year}:${md}`] = val;
    setOverrides(o);
  };

  const handleShare = async () => {
    // Vorab erzeugten (i. d. R. komprimierten) Link nutzen, damit vor
    // navigator.share/clipboard KEIN await steht – sonst verliert u. a. Safari
    // die User-Aktivierung. Fehlt der Vorab-Link, synchron den #plan=-Fallback.
    let url = shareUrlRef.current;
    if (!url) { try { url = buildShareUrl(); } catch (e) { showToast("Link konnte nicht erstellt werden."); return; } }
    if (url.length > SHARE_MAX_URL) { showToast("Planung zu umfangreich für einen Link."); return; }
    const shareData = {
      title: `Urlaubsplanung ${year}`,
      text: `Meine Urlaubsplanung ${year} (${STATES[st]}) – im Urlaubsplaner öffnen:`,
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
      try { await navigator.clipboard.writeText(url); showToast("Link wurde kopiert."); return; }
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
      showToast("Link wurde kopiert.");
      setCopyUrl(null);
    } catch (e) {
      showToast("Bitte den Link manuell markieren und kopieren.");
    }
  };

  // Den (komprimierten) Teilen-Link vorab im Hintergrund erzeugen, sobald sich
  // relevante Eingaben ändern. So liegt er beim Klick synchron bereit.
  useEffect(() => {
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
      showWeekendHolidays, blocks, yearOverrides]);

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
      !res ? "Die geteilte Planung konnte nicht geladen werden."
        : res.warning ? "Geteilte Planung wurde teilweise geladen."
        : "Geteilte Planung wurde geladen."
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
          res = validateSharePayload(json);
        }
      } catch (e) { res = null; }
      if (cancelled) return;
      if (res && res.state) applySharedState(res.state);
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
    const desc = `${p.len} Tage frei – ${fmtNum(p.vac)} Urlaubstage${p.ot > 0 ? `, ${fmtNum(p.ot)} Überstundenabbau` : ""} (Urlaubsplaner)`;
    return { dtStart, dtEnd, desc };
  };
  const googleUrl = (p) => {
    const { dtStart, dtEnd, desc } = exportInfo(p);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Urlaub")}` +
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
      "SUMMARY:Urlaub",
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
          await navigator.share({ files: [file], title: "Urlaub" });
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
  const longest = result.periods.reduce((a, p) => Math.max(a, p.len), 0);
  const leverage = usedVac + usedOt > 0 ? totalFree / (usedVac + usedOt) : 0;
  const weekendHolidayCount = days.filter((d) => d.holiday && d.weekend).length;
  const weekdayHolidayCount = days.filter((d) => d.holiday && !d.weekend).length;

  const addBlock = () => setBlocks([...blocks, { len: 9, month: "", ot: "" }]);
  const updBlock = (i, patch) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const delBlock = (i) => setBlocks(blocks.filter((_, j) => j !== i));

  const inputCls = dark
    ? "w-full rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    : "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = `block text-xs font-semibold uppercase tracking-wide ${dark ? "text-slate-400" : "text-slate-500"} mb-1`;
  const cardCls = dark ? "bg-slate-900 border border-slate-800 rounded-xl shadow-sm" : "bg-white rounded-xl shadow-sm";
  const subLabelCls = `text-xs font-semibold uppercase tracking-wide ${dark ? "text-slate-400" : "text-slate-600"}`;

  // Schulferien-Präferenz – EIN Markup für beide Modi (kein doppelter Erklärtext).
  // withHint=true zeigt zusätzlich den kurzen Hilfetext (nur im Profi-Modus nötig).
  const schoolPrefControl = (withHint) => (
    <div>
      <span className={`block ${subLabelCls} mb-1`}>Wie sollen Schulferien bei deiner Planung berücksichtigt werden?</span>
      <div className="space-y-2">
        {[["prefer", "In den Schulferien planen"], ["avoid", "Schulferien möglichst meiden"], ["neutral", "Keine Präferenz"]].map(([k, l]) => (
          <label key={k} className={`flex items-center gap-2 text-sm cursor-pointer ${dark ? "text-slate-300" : "text-slate-700"}`}>
            <input type="radio" name="schoolPref" className="accent-emerald-600"
              checked={schoolHolidayPreference === k}
              onChange={() => setSchoolHolidayPreference(k)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {withHint && (
        <p className={`mt-1 text-[11px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Bestimmt, ob automatisch erzeugte Urlaubsvorschläge bevorzugt innerhalb oder außerhalb der Schulferien liegen.
        </p>
      )}
    </div>
  );

  // Jahreskalender – in beiden Modi identisch wiederverwendet
  const calendarSection = (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {MONTHS.map((mName, m) => {
              const mDays = days.filter((d) => d.m === m);
              const lead = (mDays[0].dow + 6) % 7; // Woche beginnt Montag
              return (
                <div key={m} className={`${cardCls} p-3`}>
                  <h3 className="text-sm font-bold mb-2">{mName}</h3>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
                    {["Mo","Di","Mi","Do","Fr","Sa","So"].map((w) => <span key={w}>{w}</span>)}
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
                      // Tooltip-Text für Ferien, z. B. "Sommerferien in Bayern · 2.8.2027 bis 14.9.2027"
                      const vacTipText = vac
                        ? `${vac.name} in ${STATES[st]} · ${vac.start.toLocaleDateString("de-DE")} bis ${vac.end.toLocaleDateString("de-DE")}`
                        : null;
                      return (
                        <button key={day.i} type="button"
                          title={vacTipText ? `${dayTitle(day, selType)} · ${vacTipText}` : dayTitle(day, selType)}
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
                </div>
              );
            })}
          </section>
  );

  // Dezenter Hinweis, falls die Schulferien nicht geladen werden konnten
  const vacNotice = vacStatus === "fehler" ? (
    <p className="text-[11px] text-orange-500/80">Schulferien konnten derzeit nicht geladen werden.</p>
  ) : null;

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
      if (d.holiday && !seen.has(d.holiday)) { seen.add(d.holiday); holidayNames.push(d.holiday); }
      if (d.special === "Heiligabend") hasXmasEve = true;
      if (d.special === "Silvester") hasNYE = true;
      if (d.weekend) { if (!inWeekend) { weekends++; inWeekend = true; } } else inWeekend = false;
    }
    const invested = p.vac + p.ot;

    // --- Hauptbegründung: was macht den Zeitraum attraktiv? ---
    let reason = null;
    const xmas = holidayNames.some((n) => n.includes("Weihnachtstag"));
    if (xmas && (hasXmasEve || hasNYE)) {
      // Weihnachts-/Silvester-Serie
      if (hasXmasEve && hasNYE) reason = "Die Weihnachtsfeiertage sowie Heiligabend und Silvester werden verbunden.";
      else if (hasXmasEve) reason = "Die Weihnachtsfeiertage und Heiligabend werden verbunden.";
      else reason = "Die Weihnachtsfeiertage und Silvester werden verbunden.";
    } else {
      // Namen für den Satz wählen: Feiertage bevorzugt, sonst Sondertage
      let names = holidayNames.slice();
      if (names.length === 0) {
        if (hasXmasEve) names.push("Heiligabend");
        if (hasNYE) names.push("Silvester");
      }
      names = names.slice(0, 2);
      if (names.length > 0) {
        const subject = names.length === 2 ? `${names[0]} und ${names[1]}` : names[0];
        const plural = names.length > 1;
        if (weekends >= 2) reason = `${subject} ${plural ? "werden" : "wird"} mit zwei Wochenenden verbunden.`;
        else reason = `${subject} verlängert${plural ? "n" : ""} den freien Zeitraum.`;
      } else if (invested > 0) {
        // kein Feiertag/Sondertag – rein über Urlaubstage erzeugter Zeitraum
        if (weekends >= 2) reason = "Urlaubstage verbinden zwei Wochenenden zu einem längeren freien Zeitraum.";
        else if (weekends === 1) reason = "Urlaubstage verlängern ein Wochenende zu einem längeren freien Zeitraum.";
        else reason = "Urlaubstage ergeben einen längeren freien Zeitraum.";
      }
      // invested === 0 ohne Feiertag: nichts Sinnvolles zu sagen -> reason bleibt null
    }

    // --- Schulferienhinweis: nur bei gesicherten Feriendaten (vacStatus "ok") ---
    let holidayNote = null, holidayConflict = false;
    if (vacStatus === "ok" && (schoolHolidayPreference === "avoid" || schoolHolidayPreference === "prefer")) {
      let ferienTage = 0;
      for (let k = p.s; k <= p.e; k++) if (vacationDays[`${days[k].m}-${days[k].d}`]) ferienTage++;
      if (ferienTage > 0) {
        if (schoolHolidayPreference === "avoid") {
          holidayConflict = true;
          holidayNote = `Überschneidet sich an ${ferienTage} ${ferienTage === 1 ? "Tag" : "Tagen"} mit den Schulferien. Deine Auswahl wird als Präferenz und nicht als Ausschluss behandelt.`;
        } else {
          holidayNote = "Liegt wie gewünscht teilweise in den Schulferien.";
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
      {/* Kopf */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-1">
              Feiertage · Brückentage · {STATES[st]}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Urlaubsplaner {year}</h1>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-600 p-1 self-start">
            {[["einfach", "Einfach"], ["profi", "Profi"]].map(([k, l]) => (
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
            aria-label="Aktuelle Planung als Link teilen"
            title="Aktuelle Planung als Link teilen">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
            </svg>
            Planung teilen
          </button>
          <button onClick={() => setDark(!dark)}
            className="self-start rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            title="Zwischen Dark-Mode und hellem Modus umschalten">
            {dark ? "\u2600\ufe0f Heller Modus" : "\ud83c\udf19 Dark-Mode"}
          </button>
          <div className="text-right">
            <p className="text-4xl font-bold tabular-nums text-emerald-400">{totalFree}</p>
            <p className="text-xs text-slate-300">
              freie Tage am Stück aus {fmtNum(usedVac)} Urlaubs-
              {usedOt > 0 ? ` + ${fmtNum(usedOt)} Überstunden-` : ""}Tagen
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
                <h2 className="text-sm font-bold">Deine Planung – Schritt für Schritt</h2>

                <div className="space-y-2">
                  <p className={labelCls}>1 · Wie viele Urlaubstage hast du?</p>
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
                  <p className={labelCls}>2 · Für welches Jahr möchtest du planen?</p>
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
                  <p className={labelCls}>3 · In welchem Bundesland arbeitest du?</p>
                  <select className={inputCls} value={st} onChange={(e) => setSt(e.target.value)}>
                    {Object.entries(STATES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>4 · Wie gelten der 24.12. und 31.12. bei dir?</p>
                  <div className="space-y-2">
                    {[["100", "Ich muss jeweils einen ganzen Urlaubstag nehmen."],
                      ["50", "Sie zählen jeweils als halber Urlaubstag."],
                      ["0", "Ich habe an beiden Tagen frei und benötige keinen Urlaub."]].map(([k, l]) => (
                      <label key={k} className={`flex items-start gap-2 text-sm cursor-pointer ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        <input type="radio" name="simpleXmas" className="mt-0.5 accent-emerald-600"
                          checked={xmasRule === k} onChange={() => setXmasRule(k)} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                  <p className={`text-[11px] leading-snug ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    Viele Arbeitgeber behandeln Heiligabend und Silvester unterschiedlich. Wähle einfach die
                    Regel aus, die für dich gilt.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>5 · Wie sollen Schulferien berücksichtigt werden?</p>
                  <div className="space-y-2">
                    {[["prefer", "In den Schulferien planen"], ["avoid", "Schulferien möglichst meiden"], ["neutral", "Keine Präferenz"]].map(([k, l]) => (
                      <label key={k} className={`flex items-center gap-2 text-sm cursor-pointer ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        <input type="radio" name="schoolPrefSimple" className="accent-emerald-600"
                          checked={schoolHolidayPreference === k}
                          onChange={() => setSchoolHolidayPreference(k)} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className={labelCls}>6 · Was ist dir wichtig?</p>
                  <div className="space-y-2">
                    {[["free", "Möglichst viele freie Tage"], ["blocks", "Lange Urlaubsblöcke"], ["short", "Viele Kurzurlaube"], ["custom", "Eigene Planung (Profi-Modus)"]].map(([k, l]) => (
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
                  Beste Planung berechnen
                </button>
              </section>
            </aside>

            {/* Einfachmodus: Ergebnis */}
            <div className="space-y-6">
              {!simpleStarted ? (
                <section className={`${cardCls} p-8 text-center`}>
                  <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    Wähle links deine Angaben und klicke auf „Beste Planung berechnen".
                  </p>
                </section>
              ) : (
                <div className="space-y-6" style={{ animation: "upFade .35s ease" }}>
                  <section className={`${cardCls} p-6`}>
                    <h2 className="text-sm font-bold mb-3">Deine optimale Urlaubsplanung</h2>
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                      <div>
                        <p className={`text-6xl font-bold tabular-nums ${dark ? "text-emerald-400" : "text-emerald-600"}`}>{totalFree}</p>
                        <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>freie Tage</p>
                      </div>
                      <div className={`text-sm space-y-1 ${dark ? "text-slate-300" : "text-slate-600"}`}>
                        <p>+{weekdayHolidayCount} Feiertage optimal genutzt</p>
                        <p>+{fmtNum(usedVac)} Brückentage eingesetzt</p>
                        <p>{totalFree} freie Tage insgesamt</p>
                      </div>
                    </div>
                    <p className={`mt-4 text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
                      Mit {fmtNum(usedVac)} von {fmtNum(num(vac))} Urlaubstagen erhältst du insgesamt {totalFree} freie Tage.
                    </p>
                  </section>

                  <section className={`${cardCls} p-4`}>
                    <h3 className="text-sm font-bold mb-2">Empfohlene Urlaubsblöcke</h3>
                    {result.periods.length === 0 ? (
                      <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
                        Keine Vorschläge gefunden – erhöhe die Anzahl deiner Urlaubstage.
                      </p>
                    ) : (
                      <ul className={`divide-y ${dark ? "divide-slate-800" : "divide-slate-100"}`}>
                        {result.periods.map((p, i) => (
                          <li key={i} className="py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                            <span className="font-medium">{fmtDate(days[p.s])} – {fmtDate(days[p.e])}</span>
                            <span className={`tabular-nums ${dark ? "text-slate-400" : "text-slate-500"}`}>
                              {p.len} freie Tage · {fmtNum(p.vac)} Urlaubstag{p.vac === 1 ? "" : "e"}
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
                    {showSimpleCal ? "Kalender ausblenden" : "Kalender anzeigen"}
                  </button>
                  {showSimpleCal && (
                    <div style={{ animation: "upFade .35s ease" }}>
                      {calendarSection}
                      {vacNotice}
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
              <CollapsibleCard icon="📅" title="Allgemein" open={panels.allgemein}
                onToggle={() => togglePanel("allgemein")} dark={dark} cardCls={cardCls}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Jahr</label>
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
                    <label className={labelCls}>Bundesland</label>
                    <select className={inputCls} value={st} onChange={(e) => setSt(e.target.value)}>
                      {Object.entries(STATES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Urlaubstage</label>
                    <input className={inputCls} type="number" min="0" step="0.5" value={vac}
                      onFocus={selectAllOnFocus} onChange={(e) => setVac(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Überstundenabbau (Tage)</label>
                    <input className={inputCls} type="number" min="0" step="0.5" value={ot}
                      onFocus={selectAllOnFocus} onChange={(e) => setOt(e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Feiertagsquelle:{" "}
                  {apiStatus === "api" && <span className="text-emerald-600 font-semibold">feiertage-api.de (online)</span>}
                  {apiStatus === "laedt" && "wird geladen …"}
                  {apiStatus === "lokal" && "integrierte Berechnung (API nicht erreichbar)"}
                </p>
              </CollapsibleCard>

              <CollapsibleCard icon="⚙" title="Arbeitsregelung" open={panels.regelung}
                onToggle={() => togglePanel("regelung")} dark={dark} cardCls={cardCls}>
                <div>
                  <label className={labelCls}>24.12. und 31.12. zählen als</label>
                  <select className={inputCls} value={xmasRule} onChange={(e) => setXmasRule(e.target.value)}>
                    <option value="100">voller Urlaubstag (100 %)</option>
                    <option value="50">halber Urlaubstag (50 %)</option>
                    <option value="0">frei – kein Urlaubstag (0 %)</option>
                  </select>
                </div>
                <label className={`flex items-start gap-2 text-sm ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={showWeekendHolidays}
                    onChange={(e) => setShowWeekendHolidays(e.target.checked)} />
                  <span>Feiertage an Samstag/Sonntag einbeziehen</span>
                </label>
              </CollapsibleCard>

              <CollapsibleCard icon="🤖" title="Automatische Planung" open={panels.auto}
                onToggle={() => togglePanel("auto")} dark={dark} cardCls={cardCls}>
                <div className="flex items-center justify-between">
                  <span className={subLabelCls}>Budget der Automatik</span>
                  <button onClick={() => { setAutoVac(""); setAutoOt("0"); }}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline">
                    auf Minimum
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={subLabelCls}>Urlaubstage nutzen</span>
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
                      <span className={subLabelCls}>Überstd.-Tage nutzen</span>
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
                  <span className={`block ${subLabelCls} mb-1`}>Ab Monat</span>
                  <select className={inputCls} value={autoFrom}
                    onChange={(e) => setAutoFrom(parseInt(e.target.value, 10))}>
                    {MONTHS.map((m, mi) => (
                      <option key={mi} value={mi}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={`block ${subLabelCls} mb-1`}>Zuerst aufbrauchen</span>
                  <div className={`grid grid-cols-2 gap-1 rounded-md border p-1 ${dark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200"}`}>
                    {[["vac", "Urlaubstage"], ["ot", "Überstunden"]].map(([k, l]) => (
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
                  Start: Minimum von {fmtNum(Math.min(minBudget, num(vac)))} Tagen – nur 1-Tages-Brücken.
                  <InfoHint dark={dark} text="Mit dem Minimum kauft die Automatik ausschließlich isolierte 1-Tages-Lücken – 1 eingesetzter Tag erzeugt 4 freie Tage am Stück. Mehr Budget schaltet schrittweise 2-, 3- und 4-Tages-Lücken frei. „Ab Monat“ begrenzt nur die Automatik; Wunschblöcke und manuelle Klicks sind davon unabhängig und nutzen das volle Budget. Die Regler sind auf deine Angaben begrenzt." />
                </p>
              </CollapsibleCard>

              <CollapsibleCard icon="⭐" title="Wunschblöcke" open={panels.bloecke}
                onToggle={() => togglePanel("bloecke")} dark={dark} cardCls={cardCls}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>werden priorisiert</span>
                  <button onClick={addBlock}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                    + Block
                  </button>
                </div>
                {blocks.length === 0 && (
                  <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    Noch keine Blöcke – lege fest, wie viele Tage am Stück du frei haben willst.
                  </p>
                )}
                {blocks.map((b, i) => {
                  const r = result.blockResults[i];
                  return (
                    <div key={i} className={`rounded-lg border p-2.5 space-y-2 ${dark ? "border-slate-700" : "border-slate-200"}`}>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={labelCls}>Tage frei</label>
                          <input className={inputCls} type="number" min="1" value={b.len}
                            onFocus={selectAllOnFocus} onChange={(e) => updBlock(i, { len: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelCls}>Monat</label>
                          <select className={inputCls} value={b.month} onChange={(e) => updBlock(i, { month: e.target.value })}>
                            <option value="">egal</option>
                            {MONTHS.map((m, mi) => (
                              <option key={mi} value={mi}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Überstd.-Tage</label>
                          <input className={inputCls} type="number" min="0" step="0.5" placeholder="0" value={b.ot}
                            onFocus={selectAllOnFocus} onChange={(e) => updBlock(i, { ot: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs">
                          {r?.placed ? (
                            <span className="text-emerald-700">
                              {fmtDate(days[r.start])} – {fmtDate(days[r.end])} · kostet {fmtNum(r.cost)} Tage
                            </span>
                          ) : (
                            <span className="text-rose-600">Keine Platzierung möglich (Budget oder Monat prüfen)</span>
                          )}
                        </p>
                        <button onClick={() => delBlock(i)} className="text-xs text-slate-400 hover:text-rose-600">Entfernen</button>
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
              { v: fmtNum(leverage), l: "freie Tage pro eingesetztem Tag" },
              { v: longest, l: "längste freie Serie (Tage)" },
              { v: showWeekendHolidays ? `${weekdayHolidayCount} + ${weekendHolidayCount}` : weekdayHolidayCount,
                l: showWeekendHolidays ? "Feiertage Mo–Fr + Sa/So" : "Feiertage an Werktagen" },
              { v: `${fmtNum(result.budget.vac)} / ${fmtNum(result.budget.ot)}`, l: "übrig: Urlaub / Überstunden" },
            ].map((s, i) => (
              <div key={i} className={`${cardCls} p-3 text-center`}>
                <p className="text-2xl font-bold tabular-nums">{s.v}</p>
                <p className={`text-xs leading-tight mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>{s.l}</p>
              </div>
            ))}
          </section>

          {/* Freie Perioden */}
          <section className={`${cardCls} p-4`}>
            <h2 className="text-sm font-bold mb-2">Deine freien Zeiträume</h2>
            {result.periods.length === 0 ? (
              <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>Gib Urlaubstage ein, um Vorschläge zu sehen.</p>
            ) : (
              <ul className={`divide-y ${dark ? "divide-slate-800" : "divide-slate-100"}`}>
                {result.periods.map((p, i) => (
                  <li key={i} className="py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {fmtDate(days[p.s])} – {fmtDate(days[p.e])}
                      {p.origins.includes("block") && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Wunschblock</span>
                      )}
                      {p.origins.includes("manual") && (
                        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-white">manuell</span>
                      )}
                      {p.origins.includes("auto") && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">automatisch</span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`tabular-nums ${dark ? "text-slate-400" : "text-slate-500"}`}>
                        {p.len} Tage frei · {fmtNum(p.vac)} Urlaub{p.ot > 0 ? ` · ${fmtNum(p.ot)} Überstunden` : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <button onClick={() => downloadIcs(p)}
                          title="Als .ics-Datei herunterladen (Apple Kalender, Outlook, iCal)"
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                          }`}>
                          ICS/iCal
                        </button>
                        <a href={googleUrl(p)} target="_blank" rel="noopener noreferrer"
                          title="In Google Kalender öffnen (vorausgefüllter Termin)"
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                          }`}>
                          Google
                        </a>
                      </span>
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
              <span className={subLabelCls}>Klick im Kalender setzt</span>
              <div className={`grid grid-cols-2 gap-1 rounded-md border p-1 ${dark ? "border-slate-600" : "border-slate-200"}`}>
                {[["vac", "Urlaubstag"], ["ot", "Überstundenabbau"]].map(([k, l]) => (
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
                  Manuelle Änderungen zurücksetzen ({Object.keys(overrides).length})
                </button>
              )}
            </div>
            {result.failedManual > 0 && (
              <p className="text-xs font-semibold text-rose-600">
                {result.failedManual === 1
                  ? "1 manuell gesetzter Tag konnte mangels Budget nicht übernommen werden."
                  : `${result.failedManual} manuell gesetzte Tage konnten mangels Budget nicht übernommen werden.`}
              </p>
            )}
            <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
              {[
                ["bg-emerald-600", "Urlaub"],
                ["bg-sky-600", "Überstundenabbau"],
                ["bg-rose-600", "Feiertag"],
                ["bg-amber-300", "24./31.12. frei"],
                ["bg-amber-100 border border-amber-300", "24./31.12. halber Tag"],
                [dark ? "bg-slate-700" : "bg-slate-200", "Wochenende"],
                [dark ? "bg-slate-800 ring-2 ring-slate-400" : "bg-white ring-2 ring-slate-500", "manuell gesetzt"],
                ["bg-orange-400", "Schulferien"],
              ].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block w-3 h-3 rounded-sm ${c}`} /> {l}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Klick setzt Tage, Ziehen wählt mehrere aus, Klick auf geplante Tage öffnet Entfernen/Tauschen.
              <InfoHint dark={dark} text="Klick auf einen leeren Arbeitstag setzt den oben gewählten Tagestyp – mit der Maus kannst du gedrückt halten und ziehen, um mehrere Tage auf einmal auszuwählen, auch über Wochen- und Monatsgrenzen hinweg; Wochenenden, Feiertage und bereits geplante Tage werden übersprungen. Auf Touch-Geräten setzt du Tage einzeln per Tippen; Wischen scrollt wie gewohnt. Entfernte Tage bleiben Arbeitstage und werden von der Automatik nicht erneut belegt." />
            </p>
          </section>

          {/* Jahreskalender */}
          {calendarSection}
          {vacNotice}
          {vacTip && (
            <p className="text-[11px] text-orange-500">{vacTip.text}</p>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            Wunschblöcke zuerst, dann Brückentage streng nach Rendite.
            <InfoHint dark={dark} text="Mariä Himmelfahrt gilt in Bayern nur in Gemeinden mit überwiegend katholischer Bevölkerung; Fronleichnam gilt in Sachsen und Thüringen nur in einzelnen Regionen und ist hier nicht berücksichtigt. Die Optimierung setzt Wunschblöcke zuerst; der 24.12. und der 31.12. werden bei 100%- oder 50%-Regelung immer fest eingeplant, damit sie die Feiertagsserie nicht unterbrechen. Die automatische Verteilung kauft mit dem Minimalbudget nur isolierte 1-Tages-Brücken (1 Tag → 4 freie Tage); mehr Budget schaltet 2-, 3- und 4-Tages-Lücken frei – verteilt über das Jahr, höchstens eine Lücke je Monat pro Runde. Reine Urlaubswochen ohne Feiertag werden nie automatisch verplant; nicht eingesetzte Tage bleiben als Rest übrig." />
          </p>
        </div>
          </div>
        )}
      </main>

      {/* Dialog: geplanten Tag entfernen oder tauschen */}
      {dialogDay !== null && result.sel[dialogDay] && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${dark ? "bg-black/60" : "bg-slate-900/40"}`}
          onClick={() => setDialogDay(null)}>
          <div className={`w-full max-w-xs rounded-xl p-4 shadow-xl space-y-3 ${dark ? "bg-slate-900 border border-slate-700" : "bg-white"}`}
            onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-bold">{fmtDate(days[dialogDay])}</p>
              <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                Aktuell: {result.sel[dialogDay] === "vac" ? "Urlaubstag" : "Überstundenabbau"}
                {days[dialogDay].cost === 0.5 ? " (halber Tag)" : ""}
              </p>
            </div>
            <div className="space-y-2">
              <button onClick={() => applyDialog("swap")}
                className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-white ${
                  result.sel[dialogDay] === "vac" ? "bg-sky-600 hover:bg-sky-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}>
                In {result.sel[dialogDay] === "vac" ? "Überstundenabbau" : "Urlaubstag"} tauschen
              </button>
              <button onClick={() => applyDialog("remove")}
                className="w-full rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                Tag entfernen (wieder Arbeitstag)
              </button>
              <button onClick={() => setDialogDay(null)}
                className={`w-full rounded-md px-3 py-2 text-sm ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback-Dialog: Link manuell kopieren (wenn navigator.share und
          Clipboard-API nicht verfügbar sind) */}
      {copyUrl && (
        <div role="dialog" aria-modal="true" aria-label="Planung teilen"
          className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${dark ? "bg-black/60" : "bg-slate-900/40"}`}
          onClick={() => setCopyUrl(null)}>
          <div className={`w-full max-w-md rounded-xl p-4 shadow-xl space-y-3 ${dark ? "bg-slate-900 border border-slate-700" : "bg-white"}`}
            onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Planung teilen</p>
            <p className={`text-[11px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}>
              Der Link enthält deine Planungseinstellungen. Jeder mit diesem Link kann die Planung öffnen.
            </p>
            <label htmlFor="share-url-input" className="sr-only">Teilbarer Link</label>
            <input id="share-url-input" readOnly value={copyUrl}
              onFocus={(e) => e.target.select()} className={inputCls} />
            <div className="flex gap-2">
              <button onClick={copyFromModal}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                Link kopieren
              </button>
              <button onClick={() => setCopyUrl(null)}
                className={`rounded-md px-3 py-2 text-sm ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}>
                Schließen
              </button>
            </div>
          </div>
        </div>
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

ReactDOM.createRoot(document.getElementById("root")).render(<Urlaubsplaner />);
