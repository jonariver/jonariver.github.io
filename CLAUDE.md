# CLAUDE.md

> Falls im Repo bereits eine `CLAUDE.md` existiert, den folgenden Abschnitt dort
> einfügen statt die Datei zu ersetzen.

## Projektüberblick

React-App über globale `React`/`ReactDOM`, JSX per Babel-Standalone im
Browser – **kein Build/Bundler, kein TypeScript, keine ES-Module**. Seit dem
Modul-Refactoring ist die Anwendung auf mehrere `<script>`-Dateien aufgeteilt
(siehe Abschnitt „Architektur/Module" weiter unten); `app.jsx` bleibt die
zentrale Komponentendatei (`Urlaubsplaner`, `App`) und lädt die übrigen Module
zuletzt.
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
- **Regelmäßige Arbeitstage** (`workingWeekdays`, Standard Montag–Freitag)
  bestimmen, an welchen Wochentagen überhaupt ein Urlaubstag benötigt würde –
  siehe eigener Abschnitt „Regelmäßige Arbeitstage" weiter unten.

## Architektur/Module

Kein Modulsystem (kein `import`/`export`, keine ES-Module) und kein Bundler –
jede Datei ist ein eigenes klassisches `<script>`-Tag. Da klassische
`<script>`-Tags sich dieselbe globale lexikalische Umgebung teilen, ist jede
Datei in eine **IIFE** gekapselt und hängt ihre öffentliche Oberfläche
explizit an einen `window.FREILOTSE.*`-Namespace, statt eigene `const`/`let`
auf oberster Ebene zu deklarieren (das würde bei mehrfacher Deklaration
desselben Namens in verschiedenen Dateien sonst zu einem `SyntaxError`
führen). `app.jsx` holt sich die benötigten Funktionen/Komponenten direkt zu
Beginn per Kurzschreibweise zurück, z. B. `const { plan, minimalBridgeBudget }
= window.FREILOTSE.planning;` – dadurch bleiben alle bestehenden Aufrufstellen
innerhalb von `app.jsx` unverändert (keine Umbenennungen).

### Dateien und Zuständigkeiten

| Datei | Namespace | Inhalt |
|---|---|---|
| `locales/de.js` | `window.I18N` | Übersetzungen/Fallback-Texte, `t(key, params)` (siehe Abschnitt „Internationalisierung" unten). Muss als Erstes geladen werden. |
| `js/planning.js` | `window.FREILOTSE.planning` | `plan()`, `minimalBridgeBudget()`. Rein deterministisch: kein React, kein DOM, kein `fetch()`, keine Abhängigkeit von `window.I18N`. |
| `js/calendar.js` | `window.FREILOTSE.calendar` | `DAY`, `easterUTC()`, `holidayMap()`, `buildDays()`, `vacationDayMap()`. Reine Kalenderlogik ohne Netzwerkzugriff. `holidayMap`/`buildDays`/`vacationDayMap` erhalten die Übersetzungsfunktion `t` als **Parameter** (z. B. `buildDays(year, st, xmasRule, extHolidays, t, workingWeekdays)`) statt selbst auf `window.I18N` zuzugreifen. `workingWeekdays` ist optional (Fallback Montag–Freitag) – siehe Abschnitt „Regelmäßige Arbeitstage". |
| `js/data-sources.js` | `window.FREILOTSE.dataSources` | Anbindung externer Quellen: `loadPublicHolidays(year, stateCode)` (liefert `{ status: "api"\|"lokal", holidays }`, Ersatz für den früheren feiertage-api.de-`useEffect`), `loadSchoolHolidays()`, Normalisierer `normalizeOpenHolidaysPeriod`/`normalizeSchulferienApiPeriod`. Kein React, keine Abhängigkeit von `window.I18N`. |
| `js/share-link.js` | `window.FREILOTSE.shareLink` | Gesamte Share-Link-Logik (siehe Abschnitt „Share-Link-Funktion" unten). `validateSharePayload`/`decodeShare` erhalten bekannte Bundesland-Codes als Parameter (`knownStateCodes`) statt direkt auf `STATES` zuzugreifen. |
| `jsx/common-components.jsx` | `window.FREILOTSE.ui` | `CollapsibleCard`, `InfoHint`. |
| `jsx/kofi-components.jsx` | `window.FREILOTSE.ui` | `internalNavigate`, `SiteLink`, `CoffeeIcon`, `KofiFooterLink`, `KofiFloatingButton`, `SiteFooter` (Site-Chrome + Ko-fi, eng gekoppelt). |
| `jsx/landing-page.jsx` | `window.FREILOTSE.ui` | `ExplainerVideoSection`, `LandingPage`. Nutzt `SiteFooter` aus `kofi-components.jsx`. |
| `jsx/legal-pages.jsx` | `window.FREILOTSE.ui` | `LegalLayout`, `LegalSection`, `ExternalLegalLink`, `ProviderDetailsImage`, `ImpressumPage`, `DatenschutzPage`. Nutzt `SiteLink`/`SiteFooter` aus `kofi-components.jsx`. |
| `app.jsx` | – (Wurzel) | `Urlaubsplaner` (zentrale Komponente, bewusst nicht weiter aufgeteilt – zu große/kritische Prop-Kette), `App` (Routing), Rendering-Helfer (`fmtNum`, `dayClass`, `dayTitle` u. Ä.), Mount (`ReactDOM.createRoot(...).render(...)`). |

### Erforderliche Ladereihenfolge (siehe `index.html`)
1. `locales/de.js`
2. `js/planning.js`, `js/calendar.js`, `js/data-sources.js`, `js/share-link.js`
   (Reihenfolge untereinander unkritisch, keine Abhängigkeiten untereinander)
3. `jsx/common-components.jsx`, dann `jsx/kofi-components.jsx` (wird von den
   folgenden beiden genutzt), dann `jsx/landing-page.jsx` und
   `jsx/legal-pages.jsx`
4. `app.jsx` (mountet die Anwendung, muss zuletzt laden)

Bei Änderungen an einer dieser Dateien die Cache-Busting-Version in
`index.html` (`?v=…`) hochzählen. Weiterhin **kein** Bundler, **kein**
npm-basierter Build-Schritt – jede Datei bleibt ein direkt ladbares
`<script>` (JS-Dateien ohne JSX regulär, JSX-Dateien über
`type="text/babel" data-presets="react"`).

## Regelmäßige Arbeitstage

### Zweck und Abgrenzung
Nutzer können festlegen, an welchen Wochentagen sie regelmäßig arbeiten (z. B.
Montag–Freitag, Montag–Donnerstag, Dienstag–Samstag, einzelne Tage), damit
insbesondere regelmäßige Teilzeitmodelle korrekt berechnet werden.
**Ausdrücklich nicht** abgedeckt: wechselnde Schichten, rollierende
Dienstpläne, wochenabhängige Arbeitszeiten, konkrete Stunden pro Tag,
Teilzeitquoten oder halbe reguläre Arbeitstage. Für all das müsste
`workingWeekdays` durch ein grundsätzlich anderes, wochenbezogenes Modell
ersetzt werden – das aktuelle Format (ein einziges, dauerhaft gültiges Array
von Wochentagen) ist dafür bewusst **nicht** vorgesehen und sollte dafür auch
nicht zweckentfremdet werden.

### Zustand und Format
`workingWeekdays`: **ein** gemeinsamer State für Einfach- und Profi-Modus
(wie `vac`, `st`, `blocks` usw.) – Array von Wochentags-Indizes wie
`Date.getUTCDay()` (`0` = Sonntag … `6` = Samstag), z. B. `[1,2,3,4,5]` für
Montag–Freitag (Standard). Reihenfolge im Array ist beliebig, wird aber beim
Setzen/Teilen aufsteigend sortiert. Mindestens ein Eintrag ist Pflicht – die
UI verhindert das Abwählen des letzten verbleibenden Arbeitstags (kein
Fehlerzustand, kein leeres Array möglich). Ein Moduswechsel Einfach ↔ Profi
liest/schreibt denselben State, die Auswahl geht dabei nie verloren.

### Verwendung in `buildDays()`
`buildDays(year, st, xmasRule, extHolidays, t, workingWeekdays)`
(`js/calendar.js`) erzeugt pro Tag zusätzlich zu `weekend` (tatsächliches
Kalenderwochenende, bleibt für Darstellung/echte Wochenend-Erkennung
erhalten) das Feld `isWorkingDay` (persönlicher regulärer Arbeitstag laut
`workingWeekdays`, unabhängig davon, ob der Wochentag ein Kalenderwochenende
ist). Kostenregel (ersetzt die frühere feste Annahme Montag–Freitag):

```js
let cost = 1;
if (!isWorkingDay || holiday) cost = 0;
else if (special) cost = xmasRule === "0" ? 0 : xmasRule === "50" ? 0.5 : 1;
```

Daraus folgt automatisch – ohne separaten Sonderfall –, dass die
24./31.12.-Regel nur an persönlichen Arbeitstagen greift; an einem
persönlich freien 24.12./31.12. ist `cost` immer `0`. Fehlt `workingWeekdays`
oder ist es leer, fällt `buildDays()` auf Montag–Freitag zurück (identisches
Verhalten wie vor dieser Erweiterung). `plan()`/`minimalBridgeBudget()`
(`js/planning.js`) bleiben **unverändert** – sie arbeiten ausschließlich mit
den von `buildDays()` bereits korrekt berechneten `cost`-Werten und kennen
`workingWeekdays` selbst nicht.

Feiertagsbezogene Kennzahlen (`countHolidaysInPeriods()`,
`periodWorkingDayHolidayCount`, Feiertagsbeschreibungen in `blockReason()`)
zählen einen Feiertag nur dann als „gespart"/„genutzt", wenn er auf einen
Tag mit `isWorkingDay === true` fällt. Die Anzeige eines Feiertags (z. B. in
der Monatszusammenfassung) bleibt davon getrennt und richtet sich weiterhin
nach `weekend`/der Option „Feiertage an Samstag/Sonntag einbeziehen".

### Share-Link (optional, rückwärtskompatibel)
Kompaktes, optionales Feld `ww` in `state` (z. B. `"ww": [1,2,3,4,5]`),
verarbeitet in `js/share-link.js`. `SHARE_VERSION` bleibt unverändert – das
Feld ist rein additiv. **Alte Links ohne `ww`** (vor dieser Erweiterung
erzeugt) laden weiterhin einwandfrei und verwenden automatisch
Montag–Freitag, **ohne** den bestehenden Warnhinweis auszulösen (kein
korrigierter Zustand, sondern erwartetes Verhalten für ältere Links). Ist
`ww` vorhanden, aber kein Array, enthält ungültige/doppelte Werte oder ist
nach Bereinigung leer, wird auf Montag–Freitag zurückgesetzt **und** der
bestehende Warnmechanismus (`warning: true`) ausgelöst.

## Share-Link-Funktion

### Zweck
Aktuellen Planungsstand über einen teilbaren Link weitergeben – ohne Backend,
lauffähig auf GitHub Pages.

### Speicherort der Logik
- Reine Helfer in `js/share-link.js` (Namespace `window.FREILOTSE.shareLink`,
  siehe Abschnitt „Architektur/Module" oben): `bytesToB64url` / `b64urlToBytes`,
  `isValidMd`, `buildSharePayload`, `encodePlain`, `decodeShare`,
  `validateSharePayload`, `readShareFragment`, `deflateToB64url`/
  `inflateFromB64url`, `getHashParam` sowie die Konstanten `SHARE_VERSION`,
  `SHARE_MAX_URL`, `SHARE_MAX_DECODED`, `SHARE_MAX_OVERRIDES`,
  `SHARE_MAX_BLOCKS`, `HAS_COMPRESSION`. `validateSharePayload`/`decodeShare`
  erhalten bekannte Bundesland-Codes als Parameter, statt selbst auf `STATES`
  zuzugreifen – `app.jsx` übergibt dafür sein eigenes `STATE_CODES`.
- In der Komponente (`app.jsx`, `Urlaubsplaner`): `buildShareUrl`,
  `handleShare`, `copyFromModal`, `showToast`, ein Mount-`useEffect`
  (Lade-Hinweis + Fragment-Bereinigung), Header-Button „Planung teilen",
  Fallback-Kopier-Dialog (`copyUrl`) und Toast (`toast`).

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
    "ov": { "v": ["4-14"], "o": ["5-4"], "n": ["6-1"] },      // manuelle Tage: vac / ot / none (Keys "m-d")
    "ww": [1, 2, 3, 4, 5]                                     // optional: regelmäßige Arbeitstage, siehe unten
  }
}
```

`ww` (regelmäßige Arbeitstage) ist **optional** und rückwärtskompatibel –
siehe eigener Abschnitt „Regelmäßige Arbeitstage" oben für Format,
Validierung und das Verhalten bei alten Links ohne dieses Feld.

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

## Schulferien-Datenquellen

### Zweck und Charakter
Schulferien sind ausschließlich ein **Planungshinweis** (Kalenderanzeige,
Monatszusammenfassung, optionale Gewichtung bei der automatischen
Brückentage-Verteilung über `schoolHolidayPreference`). Sie fließen an keiner
Stelle in `plan()`s Kernberechnung der Urlaubs-/Überstundentage ein und werden
**nicht** im Share-Link gespeichert (siehe Abschnitt „Share-Link-Funktion“ –
bewusst nicht persistiert, da ableitbar und rein UI-lokal).

### Primär- und Ersatzquelle
- **Primärquelle**: OpenHolidays API
  (`https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-{Code}&languageIsoCode=DE&validFrom={Jahr}-01-01&validTo={Jahr}-12-31`).
  Liefert ein JSON-**Array direkt** (kein Wrapper-Objekt); Felder u. a.
  `startDate`/`endDate` (reine `YYYY-MM-DD`-Werte, **`endDate` inklusiv** –
  belegt durch Einträge mit `startDate === endDate`, z. B. „Buß- und Bettag“)
  sowie `name` als `[{ language, text }]`. Deckt laut Live-Test auch Jahre wie
  2029/2030 ab. Interne Bundeslandcodes (`BY`, `NW`, …) bleiben unverändert;
  nur für diese eine Anfrage wird daraus `DE-BY` etc.
- **Ersatzquelle** (automatisch, falls Primärquelle nicht erreichbar, HTTP-
  Fehler, kein gültiges Array, nur ungültige Einträge oder keine Ferien
  liefert): `https://schulferien-api.de/api/v1/{Jahr}/{Bundeslandcode}/`
  (unverändert wie zuvor). Felder `start`/`end` (ISO-Zeitstempel mit `Z`,
  **`end` ebenfalls inklusiv** – letzter Ferientag um 23:59Z) sowie
  `name`/`name_cp`. Deckt laut Anbieter nur 2022–2028 ab; für spätere Jahre
  liefert sie planmäßig keine Daten, wodurch OpenHolidays dort automatisch
  greift.
- Beide Antworten werden **unmittelbar nach dem Abruf** auf ein gemeinsames
  internes Format normalisiert: `{ start, end, name, source }`
  (`normalizeOpenHolidaysPeriod` / `normalizeSchulferienApiPeriod` in
  `js/data-sources.js`, Namespace `window.FREILOTSE.dataSources`). Die
  bestehende `vacationDayMap()` (`js/calendar.js`) verarbeitet ausschließlich
  diese normalisierten Objekte und musste inhaltlich nicht geändert werden.

### Status, Cache und Race Conditions
`vacStatus` unterscheidet fünf Zustände: `"laedt"` (wird geladen),
`"openholidays"` (Primärquelle erfolgreich), `"ersatz"` (Ersatzquelle
erfolgreich), `"keine"` (beide Quellen erreichbar, aber ohne verwertbare
Daten für Jahr+Bundesland) und `"fehler"` (beide Quellen technisch nicht
erreichbar). Ein leeres, aber technisch erfolgreiches Ergebnis zählt
ausdrücklich **nicht** als „Daten vorhanden“ (`hasVacationData` prüft sowohl
den Status als auch `vacations.length > 0`).

Der Cache (`vacCache`, Schlüssel `"Jahr-Bundesland"`) speichert je Kombination
sowohl die normalisierten Zeiträume als auch den tatsächlich verwendeten
Status; beim Zurückwechseln zu einer bereits geladenen Kombination erfolgt
kein erneuter Netzwerkaufruf. Ein `ignore`-Flag im Cleanup des `useEffect`
verhindert, dass eine verspätete Antwort nach einem zwischenzeitlichen
Jahres-/Bundeslandwechsel den neueren Zustand überschreibt (gleiches Muster
wie bei der Feiertagsabfrage).

### Verhalten ohne verwertbare Daten
Ohne Daten – auch **während des Ladens** – darf die gewählte
Schulferienpräferenz keinen Einfluss auf die Berechnung haben. Die Auswahl
selbst (`schoolHolidayPreference`) bleibt dabei erhalten; für `plan()` wird
stattdessen die abgeleitete `effectiveSchoolHolidayPreference` verwendet, die
bei fehlenden Daten fest auf `"neutral"` steht. Die drei Auswahloptionen
werden in diesem Fall in **beiden Modi** sichtbar deaktiviert
(`schoolPrefOptionsDisabled`), und ein dynamischer Hinweistext mit Bundesland
und Jahr (`schoolHolidays.notice.noData` bzw. `.unreachable`) erscheint direkt
unter der Auswahl.

### Anzeige der Quelle (Profi-Modus)
Im Panel „Allgemein“ steht direkt unter der Feiertagsquelle eine zweite Zeile
mit der tatsächlich verwendeten Schulferienquelle (`vacStatus`-abhängig: grün
= OpenHolidays, orange = Ersatzquelle, rot = keine Daten/nicht erreichbar,
neutral = wird geladen). Der Einfachmodus zeigt keine dauerhafte Quellenzeile,
sondern nur den Hinweis bei fehlenden Daten.

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
  `feiertage-api.de`, Ferienbezeichnungen von OpenHolidays API oder der
  Ersatzquelle `schulferien-api.de`) dürfen **unverändert** angezeigt werden
  und müssen nicht künstlich übersetzt werden.
- Von der Anwendung selbst definierte **Fallback-Texte** (z. B. „Schulferien",
  wenn die API keinen Namen liefert) sowie **intern berechnete Feiertagsnamen**
  (z. B. „Christi Himmelfahrt") gehören dagegen zwingend in `locales/de.js`.
- Interne, niemals für Nutzer sichtbare Inhalte dürfen weiterhin Deutsch
  bleiben, z. B. Code-Kommentare, ausschließlich über ein Debug-Flag aktivierte
  `console.log`-Ausgaben, sowie rein technische Metadaten ohne UI-Bezug (z. B.
  das `PRODID`-Feld einer erzeugten `.ics`-Datei).
- **Technisch notwendige Ausnahme:** Der `<noscript>`-Text in `index.html`
  („Bitte JavaScript aktivieren, um den Urlaubsplaner zu nutzen.") bleibt
  bewusst als deutsches String-Literal direkt in `index.html` bestehen. Er
  wird nur angezeigt, wenn JavaScript deaktiviert ist – in diesem Fall lädt
  weder `locales/de.js` noch `app.jsx`, sodass `t()` nicht zur Verfügung steht
  und dieser Text technisch nicht über die Locale-Struktur ausgegeben werden
  kann. Dasselbe gilt für den statischen `<title>Urlaubsplaner</title>` in
  `index.html`, der lediglich als Fallback dient, bis `app.jsx` geladen ist
  (siehe nächster Punkt).
- Der Browser-/Dokumenttitel wird zusätzlich zur Laufzeit über
  `document.title = t("common.documentTitle")` (in einem `useEffect` in
  `app.jsx`) aus der aktiven Locale gesetzt. Der statische Titel in
  `index.html` bleibt als initialer Fallback bestehen, bis dieser Effekt beim
  ersten Render greift.
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
- **Bei einer späteren Sprachumschaltung** (sobald diese ausdrücklich
  beauftragt wird) muss neben `document.title` auch
  `document.documentElement.lang` (aktuell statisch `"de"` in `index.html`)
  passend zur gewählten Sprache aktualisiert werden, damit Screenreader und
  Browser die Sprache korrekt erkennen.
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
