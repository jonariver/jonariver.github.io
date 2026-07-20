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

## Internationalisierung und UI-Texte

### Grundprinzip
Die Anwendung ist aktuell **ausschließlich Deutsch**. Es gibt keinen sichtbaren
Sprachumschalter, und es darf ohne ausdrückliche Anweisung auch keiner ergänzt
werden. Die technische Struktur ist aber bereits so vorbereitet, dass eine
weitere Sprache später ergänzt werden kann, ohne `app.jsx` grundlegend
umzubauen.

### Speicherort der Übersetzungen
- `locales/de.js`: einzige aktive Sprachdatei. Definiert das globale Objekt
  `window.I18N` (keine ES-Module, kein Bundler – reines Script, kompatibel mit
  Babel-Standalone/GitHub Pages) mit:
  - der zentralen Funktion `t(key, params)`,
  - `setLocale(loc)` / `getLocale()`,
  - `registerLocale(loc, dict)` für spätere zusätzliche Sprachen,
  - `LOCALES` (Objekt mit den registrierten Sprachwörterbüchern, aktuell nur `de`).
- `locales/en.js`: **inaktive** Strukturvorlage für eine spätere englische
  Übersetzung. Wird aktuell **nicht** geladen und **nicht** registriert und hat
  keinerlei Effekt auf die Anwendung.
- `index.html` lädt `locales/de.js` als normales, synchron ausgeführtes
  `<script>` **vor** `app.jsx`. Dadurch ist `window.I18N` beim Start von
  `app.jsx` garantiert vorhanden – keine Race Condition, kein Flackern.
- `app.jsx` definiert direkt zu Beginn `const t = window.I18N.t;` und nutzt ab
  dort ausschließlich `t(...)` für sichtbare Texte.

### Verbindliche Regel für alle künftigen Änderungen
- Neue oder geänderte **nutzersichtbare** Texte dürfen **nicht** direkt als
  String-Literal in `app.jsx` oder künftigen Komponenten stehen.
- Sämtliche UI-Texte müssen als **semantisch benannte** Schlüssel in
  `locales/de.js` gepflegt und ausschließlich über `t(key, params)` ausgegeben
  werden. Das gilt insbesondere für:
  - Buttons, Überschriften, Labels, Auswahloptionen,
  - Tooltips, `title`-Attribute, `aria-label` und sonstige Accessibility-Texte,
  - Toasts, Dialoge, Bestätigungs- und Fehlermeldungen,
  - Platzhalter (`placeholder`), sofern es sich um Text und nicht um reine
    Zahlenwerte handelt,
  - Hilfetexte (`InfoHint` u. Ä.) und Fußnoten,
  - dynamisch zusammengesetzte Begründungen (z. B. `blockReason`,
    `monthSummary`) sowie Singular-/Pluralformen.
- Dynamische Sätze werden als **Funktionen** in `locales/de.js` hinterlegt
  (z. B. `results.reason.namedExtends: (p) => ...`), die strukturierte Werte
  entgegennehmen. Die Komponenten in `app.jsx` übergeben nur den Schlüssel und
  die benötigten Werte – sie bauen selbst **keine** deutschen Satzfragmente
  mehr per String-Konkatenation zusammen.
- **Wichtig bei Zahlenwerten:** Wird ein Wert sowohl angezeigt (formatiert,
  z. B. über `fmtNum`, mit Komma statt Punkt) als auch für eine numerische
  Bedingung (Singular/Plural, `> 0`-Prüfungen) benötigt, müssen **beide**
  Formen an die Locale-Funktion übergeben werden (z. B. `vac` für die Anzeige
  und `vacRaw` für den Vergleich). Ein Vergleich darf nie gegen den bereits
  formatierten String erfolgen.
- Von externen APIs gelieferte Inhalte (z. B. Feiertagsnamen von
  `feiertage-api.de`, Ferienbezeichnungen von `schulferien-api.de`) dürfen
  **unverändert** angezeigt werden und müssen nicht künstlich übersetzt werden.
- Von der Anwendung selbst definierte **Fallback-Texte** (z. B. „Schulferien",
  wenn die API keinen Namen liefert) sowie **intern berechnete Feiertagsnamen**
  (z. B. „Christi Himmelfahrt") gehören dagegen zwingend in `locales/de.js`.
- Interne, niemals für Nutzer sichtbare Inhalte dürfen weiterhin Deutsch
  bleiben, z. B. Code-Kommentare, ausschließlich über ein Debug-Flag aktivierte
  `console.log`-Ausgaben, sowie rein technische Metadaten ohne UI-Bezug (z. B.
  das `PRODID`-Feld einer erzeugten `.ics`-Datei).
- Bestehende Übersetzungsschlüssel sollen möglichst weiterverwendet und nicht
  ohne konkreten Grund umbenannt werden.
- Änderungen an Übersetzungsschlüsseln oder deren Werten dürfen **niemals**
  `plan()`, die Bewertungslogik, die Schulferienlogik, das Share-Link-Format
  oder gespeicherte Einstellungen beeinflussen. Bundesland-**Codes** (z. B.
  `"BY"`) sind von Übersetzungen ausdrücklich ausgenommen und bleiben
  sprachunabhängig (siehe `STATE_CODES` in `app.jsx`).
- Deutsch bleibt bis zur ausdrücklichen Einführung weiterer Sprachen die
  einzige aktive Sprache. Eine englische Übersetzung oder ein sichtbarer
  Sprachumschalter dürfen erst nach ausdrücklicher Anweisung ergänzt werden.
- Bei jeder künftigen Änderung an `app.jsx` ist zu prüfen, ob dabei neue
  sichtbare String-Literale außerhalb der Locale-Dateien entstanden sind
  (z. B. per Textsuche nach Umlauten oder typischen deutschen Wörtern in
  Anführungszeichen).

### Fehlende Schlüssel
Fehlt ein Schlüssel in der aktiven Sprache, fällt `t()` automatisch auf Deutsch
zurück; fehlt er auch dort, gibt `t()` sichtbar `⚠ <key>` zurück und schreibt
eine Warnung in die Browser-Konsole – ein fehlender Schlüssel führt also nie zu
einem stillen Absturz, sondern ist im Entwicklungsfall sofort erkennbar.

### Spätere Ergänzung von `locales/en.js`
1. `locales/en.js` vollständig und korrekt ins Englische übersetzen (gleiche
   Schlüsselstruktur und gleiche Funktionssignaturen wie `locales/de.js`).
2. In `index.html` zusätzlich **vor** `app.jsx` laden (nach `locales/de.js`).
3. Am Ende der Datei `window.I18N.registerLocale("en", EN)` aufrufen.
4. Erst danach `window.I18N.setLocale("en")` aktiv nutzbar machen und einen
   Sprachumschalter ergänzen – beides ist ausdrücklich **nicht** Teil der
   aktuellen Vorbereitung und erfordert eine gesonderte, ausdrückliche
   Anweisung.
