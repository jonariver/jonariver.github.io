# CLAUDE.md

> Falls im Repo bereits eine `CLAUDE.md` existiert, den folgenden Abschnitt dort
> einfügen statt die Datei zu ersetzen.

## Projektüberblick

Einzeldatei-App `app.jsx` (React über globale `React`/`ReactDOM`, JSX per
Babel-Standalone im Browser – **kein Build/Bundler, kein TypeScript**).
Der gesamte Urlaubsplan ist eine **reine Ableitung**: `plan(days, cfg)` berechnet
alles aus den Eingaben. Es gibt **keine** separaten Listen manueller/automatischer
Tage.

- **Manuelle Tage** leben in `overrides`: Map `"JAHR:m-d" → "vac" | "ot" | "none"`
  (`vac` = Urlaub, `ot` = Überstundenabbau, `none` = entfernt/gesperrt, bleibt
  Arbeitstag und wird von der Automatik nicht belegt).
- **Automatische Tage** stammen aus `plan()` (`result.sel[]` + `origin[]`) und
  werden **nicht** persistiert, sondern deterministisch neu berechnet.
- **Halbe Tage** ergeben sich aus `xmasRule` (24./31.12.), nicht aus einer
  beliebigen Tagesdauer.
- Ein Datum kann **nicht** gleichzeitig Urlaub und Überstundenabbau sein
  (ein Map-Key → ein Wert).

## Share-Link-Funktion

### Zweck
Aktuellen Planungsstand über einen teilbaren Link weitergeben – ohne Backend,
lauffähig auf GitHub Pages.

### Speicherort der Logik
Alles in `app.jsx`:
- Reine Helfer (vor der Komponente, Abschnitt „Teilen: versionierter Share-Link"):
  `bytesToB64url` / `b64urlToBytes`, `isValidMd`, `buildSharePayload`,
  `encodeShare`, `decodeShare`, `readSharedPlan` sowie die Konstanten
  `SHARE_VERSION`, `SHARE_MAX_URL`, `SHARE_MAX_DECODED`, `SHARE_MAX_OVERRIDES`,
  `SHARE_MAX_BLOCKS`.
- In der Komponente: `buildShareUrl`, `handleShare`, `copyFromModal`, `showToast`,
  ein Mount-`useEffect` (Lade-Hinweis + Fragment-Bereinigung), Header-Button
  „Planung teilen", Fallback-Kopier-Dialog (`copyUrl`) und Toast (`toast`).

### Datenformat (Version 1)
Kodierung: `base64url(UTF-8(JSON))` im **URL-Fragment**: `…/#plan=<code>`.
Fragment, weil es auf GitHub Pages ohne Backend funktioniert und nicht an den
Server übertragen wird. Kodiert ≠ verschlüsselt.

Es werden **nur Eingaben** gespeichert (kompakte Kurzfelder):

```jsonc
{
  "version": 1,
  "state": {
    "y": 2027, "st": "BY", "vac": 30, "ot": 5, "x": "50",   // Jahr, Land, Kontingente, 24./31.12.-Regel
    "m": "profi", "g": "free", "ss": 0,                       // uiMode, simpleGoal, simpleStarted
    "sh": "avoid",                                            // Schulferien-Präferenz
    "av": "", "ao": "0", "sf": "vac", "af": 0, "wh": 1,       // Auto-Budget/-Optionen, showWeekendHolidays
    "b": [["16","","" ],["9","",""]],                         // Wunschblöcke [len, month, ot]
    "ov": { "v": ["4-14"], "o": ["5-4"], "n": ["6-1"] }       // manuelle Tage: vac / ot / none (Keys "m-d")
  }
}
```

Bewusst **nicht** gespeichert (weil ableitbar bzw. UI-lokal): Feiertage,
Schulferien, `days`, das Planungsergebnis, sowie `dark`, `panels`, `clickMode`,
`drag`, `dialogDay`, `vacTip`, `showSimpleCal`. Keine personenbezogenen Daten.

### Urlaub vs. Überstunden, manuell vs. automatisch
- **Urlaub/Überstunden** werden über den Override-Wert unterschieden (`vac`/`ot`),
  in `ov.v` bzw. `ov.o` abgelegt; Datumsformat der Tage effektiv `YYYY-MM-DD`
  (im Link als kompaktes `"m-d"`, das Jahr steht in `y`).
- **Manuell** = alles in `ov` (wird gespeichert und beim Laden 1:1 gesetzt).
  **Automatisch** = wird aus denselben Eingaben deterministisch neu berechnet.
- Entfernte/gesperrte Tage = `ov.n` (Typ „none", gilt für Urlaub und Überstunden
  gleichermaßen; der Tag bleibt Arbeitstag).

### Konfliktregeln
- Dasselbe Datum in mehreren Kategorien (`v`/`o`/`n`) → **beide verworfen**, kein
  stillschweigendes Überschreiben, Hinweis-Flag (`warning=true`) → Toast
  „…teilweise geladen".
- Doppelte Datumswerte innerhalb einer Kategorie → dedupliziert.
- Manuell hat Vorrang: Ein Override belegt den Tag in Phase 0 von `plan()`; die
  Automatik kann ihn nicht überschreiben (weder Auto-Urlaub auf manuellem
  Überstundentag noch umgekehrt).

### Kontingent-Validierung
Urlaubs- und Überstundenkontingent bleiben getrennt (`budget.vac`/`budget.ot`)
und werden **nicht** verrechnet. `plan()` setzt manuelle Tage nur, solange das
jeweilige Budget reicht; nicht mehr passende manuelle Tage erhöhen `failedManual`
und lösen im UI den bestehenden roten Hinweis aus. Werte werden beim Dekodieren
auf `0…366` begrenzt.

### Verhalten beim Laden
`readSharedPlan(location.hash)` wird **einmal synchron als erster Hook** gelesen;
alle betroffenen `useState` werden direkt daraus initialisiert. Dadurch gibt es
**keinen Flash und keine Race Condition** – keine Standardwerte oder Effekte
überschreiben den geladenen Zustand. Feiertage/Schulferien werden über die
bestehenden Effekte (`year`, `st`) nachgeladen; der Plan wird deterministisch neu
berechnet. Nach dem Laden: Toast („Geteilte Planung wurde geladen." / „…teilweise
geladen." / bei kaputtem `#plan=`: „…konnte nicht vollständig geladen werden.")
und Entfernen des Fragments via `history.replaceState`.

Validierung: Version, Jahr (1970–2100), bekanntes Bundesland, Enums
(`xmasRule`/`uiMode`/`simpleGoal`/`schoolHolidayPreference`/`spendFirst`),
`autoFrom` 0–11, echte Kalenderprüfung jedes `"m-d"` fürs Jahr, Deckelung von
Blöcken (≤20) und Overrides (≤400), Payload-Größe (≤100 000 Zeichen). Teilweise
gültige Links laden die gültigen Teile + Hinweis; vollständig ungültige/veraltete
Links werden ignoriert und die App startet normal. Links ohne `#plan=` funktionieren
unverändert.

### Teilen (Button)
`handleShare`: baut die URL → `navigator.share()` (falls verfügbar,
`AbortError` still) → sonst Clipboard-API („Link wurde kopiert.") → sonst
Fallback-Dialog mit markierbarem Eingabefeld + Kopier-Button (`execCommand`).
Datenschutzhinweis im Dialog: „Der Link enthält deine Planungseinstellungen.
Jeder mit diesem Link kann die Planung öffnen." Button ist in beiden Modi im
Header sichtbar, mit `aria-label`, Fokusring und Teilen-Icon.

### Einschränkungen
- **Linklänge**: praktische Obergrenze `SHARE_MAX_URL = 8000`; darüber
  Hinweis „Planung zu umfangreich für einen Link." (typische Pläne bleiben
  deutlich darunter).
- **Determinismus**: Automatische Tage werden neu berechnet und stimmen exakt
  überein, solange Feiertage/Schulferien für (Jahr, Bundesland) identisch geladen
  werden. Fällt eine API aus, greift die integrierte Feiertagsberechnung; sehr
  seltene Randfälle bei abweichenden externen Daten sind möglich. Manuelle Tage
  sind davon nie betroffen (sie werden explizit gespeichert).
- **Datenschutz**: keine Übertragung an zusätzliche Server; kein externer
  Shortener/Speicherdienst.
- Ein geteiltes Jahr außerhalb der Dropdown-Spanne (aktuelles Jahr … +4) wird
  korrekt geladen und gerechnet; nur das Jahr-Auswahlfeld zeigt es evtl. nicht an.
