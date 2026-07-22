/* ------------------------------------------------------------------ */
/* js/planning.js – reine Planungslogik (kein React, kein DOM, kein     */
/* fetch(), keine Abhängigkeit von window.I18N). Deterministisch: bei   */
/* gleichen Eingaben immer dasselbe Ergebnis. Wird unverändert per      */
/* <script src="js/planning.js"> geladen (kein Modulsystem, siehe       */
/* CLAUDE.md). Öffentliche Oberfläche: window.FREILOTSE.planning.       */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";

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

    /* --- Phase 1: Wunschblöcke (priorisiert) ---
       blockOwner reserviert den GESAMTEN Zeitraum eines bereits platzierten
       Wunschblocks (Index in cfg.blocks), inklusive der darin enthaltenen
       Wochenenden/Feiertage. Ohne diese Reservierung würde free(j) einen Tag,
       der nur wegen eines FRÜHEREN Blocks bereits "sel" ist, für einen SPÄTEREN
       Block als kostenlos werten – der spätere Block könnte sich dadurch
       ungewollt exakt in den ersten hineinlegen (0-Kosten-Trugschluss). Manuell
       gesetzte Urlaubstage (Phase 0, origin "manual") bleiben davon unberührt
       und dürfen weiterhin Teil eines Wunschblocks werden.

       Zusätzlich: Zwei Wunschblöcke dürfen nicht nur über eine ununterbrochene
       Kette freier Tage (Wochenende/Feiertag/bereits verplant) direkt ineinander
       übergehen – in Wirklichkeit wäre das ein einziger durchgehend freier
       Zeitraum statt zweier getrennter Urlaube. scanSeparator() läuft von einem
       Blockrand nach außen: Trifft sie auf einen bereits reservierten
       Nachbarblock, OHNE vorher einen echten, noch unverplanten Arbeitstag zu
       finden, ist die Platzierung ungültig. Wird vorher ein solcher Tag
       gefunden (und liegt dahinter überhaupt ein reservierter Nachbarblock),
       merkt sie sich dessen Index als Trenntag. */
    const blockOwner = new Array(n).fill(null);
    const scanSeparator = (from, step) => {
      let k = from, gapDay = null;
      while (k >= 0 && k < n) {
        if (blockOwner[k] !== null) return gapDay !== null ? { ok: true, gapDay } : { ok: false, gapDay: null };
        if (gapDay === null && !free(k)) gapDay = k; // erster echter, noch unverplanter Arbeitstag
        k += step;
      }
      return { ok: true, gapDay: null }; // Kalenderrand erreicht, kein Nachbarblock -> nichts zu reservieren
    };
    const blockResults = [];
    for (let bi = 0; bi < cfg.blocks.length; bi++) {
      const b = cfg.blocks[bi];
      const len = Math.max(1, Math.floor(b.len || 0));
      if (!b.len) { blockResults.push({ b, placed: false }); continue; }
      let best = null;
      for (let s = 0; s + len <= n; s++) {
        if (b.month !== null && days[s].m !== b.month) continue;
        let c = 0, hasBlocked = false, hasReserved = false;
        for (let j = s; j < s + len; j++) {
          if (blockOwner[j] !== null) { hasReserved = true; break; }
          if (!free(j)) { c += days[j].cost; if (blocked[j]) hasBlocked = true; }
        }
        if (hasReserved || hasBlocked || c > budget.vac + budget.ot + 1e-9) continue;
        const left = scanSeparator(s - 1, -1);
        if (!left.ok) continue; // schließt direkt (nur über freie Tage) an einen Nachbarblock an
        const right = scanSeparator(s + len, 1);
        if (!right.ok) continue;
        let ext = 0, k = s - 1;
        while (k >= 0 && free(k)) { ext++; k--; }
        k = s + len;
        while (k < n && free(k)) { ext++; k++; }
        if (!best || c < best.c - 1e-9 || (Math.abs(c - best.c) < 1e-9 && ext > best.ext))
          best = { s, c, ext, leftGapDay: left.gapDay, rightGapDay: right.gapDay };
      }
      if (best) {
        const otCapRef = { left: b.ot ?? 0 };
        for (let j = best.s; j < best.s + len; j++) {
          if (!free(j) && spend(j, true, otCapRef)) origin[j] = "block";
          blockOwner[j] = bi; // ganzer Zeitraum reserviert, auch kostenlose Tage darin
        }
        // Den jeweils nächstgelegenen echten Trenntag zu einem Nachbarblock dauerhaft
        // als Arbeitstag sperren (wie ein manuell entfernter Tag) – sonst könnte ihn
        // Phase 1b oder die Brückentage-Automatik (Phase 2) später doch noch
        // verplanen und die beiden Wunschblöcke nachträglich wieder verschmelzen.
        // Es genügt, jeweils nur den nächstgelegenen Tag zu sperren: Er kann nie
        // frei werden, wodurch die Kette zwischen den Blöcken dauerhaft unterbrochen
        // bleibt, unabhängig davon, was mit weiter entfernten Tagen dazwischen passiert.
        if (best.leftGapDay !== null) blocked[best.leftGapDay] = true;
        if (best.rightGapDay !== null) blocked[best.rightGapDay] = true;
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

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.planning = { plan, minimalBridgeBudget };
})();
