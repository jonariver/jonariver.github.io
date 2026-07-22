/* ------------------------------------------------------------------ */
/* js/share-link.js – versionierter Share-Link im URL-Fragment. Reine   */
/* Kodier-/Dekodier-/Validierungslogik, kein React, keine Abhängigkeit  */
/* von window.I18N. Bekannte Bundesland-Codes werden als Parameter       */
/* übergeben (validateSharePayload/decodeShare), statt direkt auf die    */
/* aus der Locale abgeleiteten STATES zuzugreifen. Wird unverändert per  */
/* <script src="js/share-link.js"> geladen (kein Modulsystem, siehe      */
/* CLAUDE.md). Öffentliche Oberfläche: window.FREILOTSE.shareLink.       */
/*                                                                       */
/* Es werden ausschließlich EINGABEN gespeichert. Der Plan (auto. Tage,  */
/* Farben, Legende, Tooltips, Kontingente) wird beim Laden deterministisch */
/* über plan(days,cfg) neu berechnet. Feiertage und Schulferien werden aus */
/* Jahr + Bundesland erneut geladen und daher NICHT im Link abgelegt.    */
/*                                                                       */
/* Format:                                                               */
/* - Neu:    #p=<base64url(deflate(JSON))>   – kompakt, via CompressionStream */
/* - Alt:    #plan=<base64url(JSON)>         – unverändert lesbar (Abwärtskompat.) */
/* Ist CompressionStream/DecompressionStream nicht verfügbar, wird beim  */
/* Erstellen automatisch das alte #plan=-Verfahren genutzt.              */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";

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
        // Optionales Feld, rückwärtskompatibel: fehlt bei alten Links komplett,
        // decodeShare()/validateSharePayload() verwenden dann automatisch
        // Montag–Freitag. SHARE_VERSION bleibt deshalb bewusst unverändert.
        ww: Array.isArray(s.workingWeekdays) ? s.workingWeekdays.slice().sort((a, b) => a - b) : [1, 2, 3, 4, 5],
      },
    };
  }

  // JSON-Payload -> base64url (unkomprimiert, für das alte #plan=-Format).
  function encodePlain(payload) {
    return bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  }

  // Validiert einen bereits dekodierten JSON-String (gilt für beide Formate:
  // #plan= liefert ihn synchron über atob, #p= asynchron über inflate).
  // knownStateCodes: Array bekannter Bundesland-Codes (z. B. STATE_CODES aus
  // app.jsx) – wird als Parameter übergeben, damit dieses Modul nicht direkt
  // von der aus window.I18N abgeleiteten STATES-Liste abhängt.
  // Rückgabe:
  //   { state, warning }  – ladbar (warning=true: Teile korrigiert/verworfen)
  //   null                – nicht ladbar (kaputt / falsche Version / zu groß)
  function validateSharePayload(jsonStr, knownStateCodes) {
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
      workingWeekdays: [1, 2, 3, 4, 5],
    };
    const bad = (present) => { if (present) warn = true; };

    const y = parseInt(raw.y, 10);
    if (Number.isInteger(y) && y >= 1970 && y <= 2100) out.year = y; else bad(raw.y !== undefined);
    if (typeof raw.st === "string" && knownStateCodes.includes(raw.st)) out.st = raw.st; else bad(raw.st !== undefined);
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

    // ww: regelmäßige Arbeitstage (Date.getUTCDay(), 0=So…6=Sa). Fehlt das Feld
    // komplett (alte Links vor dieser Funktion), gilt still und OHNE Warnung
    // Montag–Freitag (out-Skeleton oben) – das ist die geforderte
    // Rückwärtskompatibilität, kein korrigierter/fehlerhafter Zustand.
    // Ist es vorhanden, aber kein Array, kein Ganzzahl-Wert 0–6, doppelt oder
    // nach Bereinigung leer, wird korrigiert/auf den Standard zurückgesetzt UND
    // der bestehende Warnmechanismus ausgelöst.
    if (raw.ww !== undefined) {
      if (Array.isArray(raw.ww)) {
        const cleaned = raw.ww.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        const uniq = [...new Set(cleaned)];
        if (uniq.length !== raw.ww.length) warn = true; // ungültige und/oder doppelte Werte entfernt
        if (uniq.length > 0) out.workingWeekdays = uniq.sort((a, b) => a - b);
        else warn = true; // nach Bereinigung kein Arbeitstag mehr übrig -> Standard + Hinweis
      } else {
        warn = true; // ww vorhanden, aber kein Array
      }
    }

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
  function decodeShare(enc, knownStateCodes) {
    if (!enc || typeof enc !== "string" || enc.length > SHARE_MAX_DECODED) return null;
    let jsonStr;
    try {
      const bytes = b64urlToBytes(enc);
      if (bytes.length > SHARE_MAX_DECODED) return null;
      jsonStr = new TextDecoder().decode(bytes);
    } catch (e) { return null; }
    return validateSharePayload(jsonStr, knownStateCodes);
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

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.shareLink = {
    SHARE_VERSION, SHARE_MAX_URL, SHARE_MAX_DECODED, SHARE_MAX_OVERRIDES, SHARE_MAX_BLOCKS,
    HAS_COMPRESSION,
    buildSharePayload, encodePlain, validateSharePayload, decodeShare,
    readShareFragment, deflateToB64url, inflateFromB64url,
  };
})();
