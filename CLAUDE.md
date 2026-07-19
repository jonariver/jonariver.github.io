# CLAUDE.md

Leitfaden für Claude-Sitzungen in diesem Repository. Enthält die dauerhaft
relevanten Fakten zum Projekt. Dokumentiert ist nur, was im Code tatsächlich
vorhanden ist.

## Zweck

Ein **Urlaubsplaner** für Deutschland: Er plant Urlaubstage rund um gesetzliche
Feiertage und optimiert **Brückentage**, sodass aus möglichst wenigen
eingesetzten Tagen möglichst viele zusammenhängende freie Tage entstehen.
Zusätzlich lassen sich Überstundenabbau-Tage und feste „Wunschblöcke“
einplanen. Ergebnisse können als `.ics`-Datei oder als Google-Kalender-Link
exportiert werden. Alles läuft rein clientseitig, ohne Backend und ohne
Speicherung von Nutzerdaten.

## Technologien & Projektstruktur

- **React 18** (UMD-Build von unpkg), gerendert per `ReactDOM.createRoot`.
- **Babel Standalone** transpiliert `app.jsx` **im Browser** (`<script type="text/babel" data-presets="react">`). Es gibt **keinen Build-Schritt**.
- **Tailwind CSS** über das CDN `cdn.tailwindcss.com`.
- Keine npm-Abhängigkeiten, kein Bundler, kein Package-Manager, keine Tests.

Dateien (alle im Repo-Wurzelverzeichnis):

- `index.html` – HTML-Shell, lädt die CDNs und `app.jsx?v=2` (der `?v=`-Query dient dem Cache-Busting).
- `app.jsx` – **die gesamte Anwendung in einer Datei** (~73 KB): Daten (Bundesländer, Feiertagsberechnung), Kalender-/Optimierungslogik, Rendering-Helfer, UI-Bausteine und die Hauptkomponente `Urlaubsplaner`.
- `README.md` – Kurzbeschreibung.

Grobe Gliederung innerhalb von `app.jsx`:

- `STATES`, `MONTHS`, `DOWS` – Stammdaten (16 Bundesländer, Monats-/Wochentagsnamen).
- `easterUTC`, `holidayMap` – integrierte Feiertagsberechnung (Fallback, s. u.).
- `buildDays` – baut das Tages-Array eines Jahres inkl. Kosten pro Tag.
- `vacationDayMap` – wandelt Schulferien-Zeiträume in eine Tages-Map (auf das Jahr beschnitten).
- `minimalBridgeBudget`, `plan` – der Optimierer.
- `fmtNum`, `fmtDate`, `dayClass`, `dayTitle` – Rendering-Helfer.
- `CollapsibleCard`, `InfoHint` – wiederverwendbare UI-Bausteine.
- `Urlaubsplaner` – Hauptkomponente mit allen States, Effekten und dem UI.

## Einfach-Modus vs. Profi-Modus

Umschaltbar im Kopfbereich (`uiMode`), Standard ist **Einfach**.

- **Einfach:** geführter Assistent, fragt nur das Nötigste ab (Urlaubstage über
  +/−-Stepper, Jahr, Bundesland, 24./31.12.-Regel, Schulferien-Präferenz, Ziel).
  Zeigt danach das Ergebnis, empfohlene Blöcke und optional den Kalender.
  Jahresauswahl auf **3 Jahre** begrenzt (aktuelles Jahr … +2).
  Das gewählte Ziel (`simpleGoal`) wird über `applySimpleGoal` in die
  gemeinsamen Einstellungen übersetzt:
  - `free` – keine Blöcke, `autoVac = "9999"` (durch Deckelung faktisch alle Urlaubstage).
  - `blocks` – zwei Wunschblöcke (16 und 9 Tage), Automatik auf Minimum (`""`).
  - `short` – vier 4-Tage-Blöcke, `autoVac = "9999"`.
  - `custom` – wechselt in den Profi-Modus.
- **Profi:** volle Kontrolle über einklappbare Karten (Allgemein,
  Arbeitsregelung, Automatische Planung, Wunschblöcke), manuelles Planen im
  Kalender, Kennzahlen und Export. Jahresauswahl **5 Jahre**.

## Gemeinsame Einstellungen beider Modi

**Single Source of Truth:** Beide Modi arbeiten auf **denselben React-States**
und demselben berechneten `result`. Der Einfach-Modus schreibt seine Auswahl
lediglich in dieselben States (Wunschblöcke + Auto-Budget), die auch der
Profi-Modus nutzt. Folgen:

- Der Profi-Modus ist nach einer Einfach-Planung korrekt vorausgefüllt und umgekehrt.
- Ein **Moduswechsel löst keine Neuberechnung aus**.
- Beim Wechsel **zu Einfach** wird das Jahr auf das aktuelle zurückgesetzt, falls es außerhalb der dort erlaubten 3 Jahre liegt.

## Automatische Urlaubsplanung (`plan`)

Der Optimierer arbeitet in Phasen mit fester Priorität:

- **Phase 0 – Manuelle Klicks** (höchste Priorität): per Kalender gesetzte
  Overrides (`"vac"`/`"ot"`/`"none"`). `"none"` bleibt dauerhaft Arbeitstag.
- **Phase 1 – Wunschblöcke:** feste Blöcke gewünschter Länge (optional Monat),
  werden zuerst und möglichst günstig platziert.
- **Phase 1b – 24.12./31.12.:** werden bei 100 %- oder 50 %-Regelung immer fest
  freigenommen, damit sie die Feiertagsserie nicht unterbrechen.
- **Phase 2 – Brückentage nach striktem ROI:** kauft Lücken stufenweise nach
  Rendite. Zuerst **nur isolierte 1-Tages-Lücken** (1 Tag → ~4 freie Tage); erst
  wenn keine mehr existiert und noch Auto-Budget übrig ist, folgen 2-, 3- und
  4-Tages-Lücken. Pro Runde höchstens **eine Lücke je Monat** (Verteilung übers
  Jahr). **Reine Urlaubswochen ohne Feiertag werden nie automatisch verplant.**
  Konstanten: `MIN_EFF = 2` (Mindest-Effizienz), `MAX_GAP_COST = 4`,
  `FLANK_CAP = 4` (gedeckelte Zählung angrenzender freier Tage).

Weitere Stellschrauben: `autoVac`/`autoOt` (Budget der Automatik, `""` = Minimum
aus `minimalBridgeBudget`), `spendFirst` (`"vac"`/`"ot"` – Reihenfolge des
Aufbrauchens), `autoFromMonth` (Automatik plant erst ab diesem Monat; betrifft
**nur** die Automatik, nicht Wunschblöcke/manuelle Klicks). Alle Regler sind auf
die eingegebenen Urlaubs-/Überstundentage gedeckelt; nicht eingesetztes Budget
bleibt übrig.

## Schulferien: Berücksichtigung/Vermeidung

- Schulferien sind ein **reiner Planungshinweis** und fließen **nicht** in die
  Kosten-/Budgetrechnung ein.
- Ausnahme: die Präferenz `schoolHolidayPreference` (`prefer` | `avoid` |
  `neutral`) beeinflusst **nur die Sortierung**, welche gleich teuren Lücken die
  Automatik zuerst kauft (über den Ferienanteil `vacShare`). Bei `neutral` gibt
  es keinen Einfluss.
- Die Präferenz ist **eine gemeinsame Variable für beide Modi**.

## APIs, Bundesland- und Jahresauswahl

- **Feiertage:** `https://feiertage-api.de/api/?jahr={jahr}&nur_land={kürzel}`.
  Bei Fehler/Offline greift die integrierte Berechnung (`holidayMap`,
  Gauß'sche Osterformel) als Fallback. Der Status wird angezeigt
  (`api` | `laedt` | `lokal`). Der nur in der Stadt Augsburg gültige Feiertag
  wird herausgefiltert.
- **Schulferien:** `https://schulferien-api.de/api/v1/{jahr}/{kürzel}/`.
  Ergebnisse werden pro **Jahr+Bundesland** in einem Ref zwischengespeichert
  (`vacCache`). Schlägt der Abruf fehl, erscheint nur ein dezenter Hinweis.
- **Bundesland** (`st`, Standard `"BY"`) und **Jahr** (`year`, Standard: aktuelles
  Jahr) steuern beide API-Aufrufe. Kürzel = die Schlüssel aus `STATES`
  (`BW`, `BY`, `BE`, …).

## Kalender & farbliche Darstellung

- Woche beginnt **Montag**. Kosten pro Tag: Wochenende/Feiertag = 0; 24./31.12.
  je nach `xmasRule` (`"0"`=0, `"50"`=0.5, `"100"`=1); sonst 1.
- Farben (`dayClass` + Legende):
  - Urlaub → Grün (`emerald-600`)
  - Überstundenabbau → Blau (`sky-600`)
  - Feiertag (Werktag) → Rot (`rose-600`); am Wochenende gedämpft bzw. ausgegraut, je nach „Feiertage an Sa/So einbeziehen“
  - 24./31.12. frei → Amber (`amber-300`); halber Tag → helles Amber
  - Wochenende → Grau (`slate`)
  - manuell gesetzt → Ring um die Zelle
  - **Schulferien → oranger Streifen** am unteren Zellenrand (`orange-400`); eigene Ebene, überschreibt die Grundfarbe nicht
- **Dark-Mode ist Standard**, im Kopfbereich umschaltbar.

## Mobile Anforderungen & einklappbare Bereiche

- Responsives Layout; auf Mobil (`window.innerWidth < 768`) ist standardmäßig
  nur die Karte „Allgemein“ geöffnet.
- Profi-Karten sind Accordions (`CollapsibleCard`, Höhen-/Fade-Animation über den
  CSS-Grid-Trick `0fr → 1fr`). Der Offen/Zu-Zustand wird in **localStorage** unter
  `"urlaubsplaner-panels"` gemerkt.
- **Zieh-Auswahl** (mehrere Tage) nur mit **Maus/Stift**; auf Touch-Geräten
  setzt Tippen einzelne Tage, Wischen scrollt.
- **iOS**: `.ics`-Export öffnet das native Teilen-Menü (`navigator.share`),
  sonst normaler Datei-Download.
- Zahlenfelder markieren beim Fokus ihren Inhalt; Einfach-Modus nutzt +/−-Stepper.

## Build-, Test- & Deployment-Befehle

- **Kein Build, keine Tests, kein Package-Manager.** `app.jsx` wird zur Laufzeit
  im Browser transpiliert.
- **Lokal testen:** `index.html` in einem Browser öffnen oder einen statischen
  Server im Repo-Wurzelverzeichnis starten, z. B. `python3 -m http.server`
  (nötig, damit `app.jsx` per HTTP geladen wird und die APIs erreichbar sind).
- Nach Änderungen an `app.jsx` ggf. den `?v=`-Query in `index.html` erhöhen, um
  den Browser-Cache zu umgehen.

## GitHub-Pages-Deployment

- Das Repo ist eine **GitHub-Pages-User-Site** (`jonariver.github.io`). Es wird
  direkt aus dem Wurzelverzeichnis des `main`-Branches ausgeliefert.
- Es gibt **keine GitHub-Actions/Workflows**: Ein Push auf `main` genügt, die
  Seite erscheint unter `https://jonariver.github.io`.

## Architekturentscheidungen & bekannte Einschränkungen

- Bewusst **eine einzige, buildfreie Datei** mit CDN-Abhängigkeiten und
  In-Browser-Transpilierung – maximal einfaches Deployment, keine Toolchain.
- **Zwei Modi, ein Zustand** (Single Source of Truth), damit beide Ansichten
  konsistent bleiben und ein Wechsel nichts neu berechnet.
- Schulferien nur als Hinweis (plus Sortier-Präferenz), nicht in der Budgetrechnung.
- Feiertags-Feinheiten sind bewusst nicht regionsgenau abgebildet: Mariä
  Himmelfahrt (Bayern) und Fronleichnam (Sachsen/Thüringen) gelten dort nur in
  bestimmten Gemeinden; der Augsburger Feiertag wird herausgefiltert.
- **Keine lokale Persistenz der Planung:** Nur der Offen/Zu-Zustand der Karten
  wird lokal (localStorage) gespeichert. Manuelle Overrides, Blöcke und übrige
  Eingaben liegen nur im Speicher und gehen beim Neuladen verloren – sie lassen
  sich aber über „Planung teilen“ als Link weitergeben (siehe unten).
- Externe Laufzeitabhängigkeiten (React-, Babel-, Tailwind-CDN sowie beide APIs):
  Bei fehlenden Feiertagsdaten gibt es einen lokalen Fallback, bei fehlenden
  Schulferien nur einen Hinweis.


## Planung teilen (Share-Link)

### Zweck
Aktuellen Planungsstand über einen teilbaren Link weitergeben – ohne Backend,
lauffähig auf GitHub Pages. Öffnet jemand den Link, wird der Stand automatisch
wiederhergestellt.

### Modell
Der Plan ist eine **reine Ableitung** von `plan(days, cfg)`. Es gibt keine
separaten Listen manueller/automatischer Tage:

- **Manuelle Tage** = `overrides` (`"JAHR:m-d" → "vac" | "ot" | "none"`;
  `none` = entfernt/gesperrt, bleibt Arbeitstag).
- **Automatische Tage** = aus `plan()` (`result.sel[]` + `origin[]`), nicht
  persistiert, sondern deterministisch neu berechnet.
- **Halbe Tage** ergeben sich aus `xmasRule` (24./31.12.), nicht aus einer
  beliebigen Dauer. Ein Datum kann nicht gleichzeitig Urlaub und Überstunden
  sein (ein Map-Key → ein Wert).

Deshalb speichert der Link **nur Eingaben**; alles Übrige (Feiertage,
Schulferien, Plan, Farben, Legende, Tooltips, Kontingente) wird beim Laden neu
erzeugt.

### Speicherort der Logik (in `app.jsx`)
- Reine Helfer (vor der Komponente, Abschnitt „Teilen: versionierter
  Share-Link"): `bytesToB64url`/`b64urlToBytes`, `isValidMd`,
  `buildSharePayload`, `encodeShare`, `decodeShare`, `readSharedPlan` sowie die
  Konstanten `SHARE_VERSION`, `SHARE_MAX_URL`, `SHARE_MAX_DECODED`,
  `SHARE_MAX_OVERRIDES`, `SHARE_MAX_BLOCKS`.
- In `Urlaubsplaner`: `buildShareUrl`, `handleShare`, `copyFromModal`,
  `showToast`, ein Mount-`useEffect` (Lade-Hinweis + Fragment-Bereinigung),
  Header-Button „Planung teilen", Fallback-Kopier-Dialog (`copyUrl`) und Toast
  (`toast`).

### Datenformat (Version 1)
Kodierung: `base64url(UTF-8(JSON))` im **URL-Fragment**: `…/#plan=<code>`
(Fragment, weil es auf GitHub Pages ohne Backend funktioniert und nicht an den
Server gesendet wird). Kodiert ≠ verschlüsselt.

```jsonc
{
  "version": 1,
  "state": {
    "y": 2027, "st": "BY", "vac": 30, "ot": 5, "x": "50",   // Jahr, Land, Kontingente, 24./31.12.-Regel
    "m": "profi", "g": "free", "ss": 0,                       // uiMode, simpleGoal, simpleStarted
    "sh": "avoid",                                            // Schulferien-Präferenz
    "av": "", "ao": "0", "sf": "vac", "af": 0, "wh": 1,       // Auto-Budget/-Optionen, showWeekendHolidays
    "b": [["16","",""],["9","",""]],                          // Wunschblöcke [len, month, ot]
    "ov": { "v": ["4-14"], "o": ["5-4"], "n": ["6-1"] }       // manuelle Tage: vac / ot / none (Keys "m-d")
  }
}
```

Bewusst **nicht** gespeichert (ableitbar bzw. UI-lokal): Feiertage, Schulferien,
`days`, das Planungsergebnis, sowie `dark`, `panels`, `clickMode`, `drag`,
`dialogDay`, `vacTip`, `showSimpleCal`. Keine personenbezogenen Daten.

### Urlaub/Überstunden, manuell/automatisch
- **Urlaub vs. Überstunden**: über den Override-Wert (`vac`/`ot`), abgelegt in
  `ov.v` bzw. `ov.o`; Datum effektiv `YYYY-MM-DD` (im Link kompakt als `"m-d"`,
  Jahr in `y`).
- **Manuell** = alles in `ov` (wird gespeichert und beim Laden 1:1 gesetzt).
  **Automatisch** = deterministisch neu berechnet.
- Entfernt/gesperrt = `ov.n` (Typ „none", gilt für Urlaub und Überstunden;
  Tag bleibt Arbeitstag).

### Konfliktregeln
- Gleiches Datum in mehreren Kategorien (`v`/`o`/`n`) → **beide verworfen**, kein
  stilles Überschreiben, `warning=true` → Toast „…teilweise geladen".
- Doppelte Datumswerte innerhalb einer Kategorie → dedupliziert.
- Manuell hat Vorrang: ein Override belegt den Tag in Phase 0 von `plan()`; die
  Automatik kann ihn nicht überschreiben.

### Kontingent-Validierung
Urlaubs- und Überstundenkontingent bleiben getrennt (`budget.vac`/`budget.ot`)
und werden nicht verrechnet. `plan()` setzt manuelle Tage nur, solange das
jeweilige Budget reicht; überzählige erhöhen `failedManual` und lösen den
bestehenden roten Hinweis aus. Beim Dekodieren werden Werte auf `0…366` begrenzt.

### Verhalten beim Laden
`readSharedPlan(location.hash)` wird **einmal synchron als erster Hook** gelesen;
die betroffenen `useState` werden direkt daraus initialisiert → **kein Flash,
keine Race Condition**, keine Standardwerte/Effekte überschreiben den Zustand.
Feiertage/Schulferien laden über die bestehenden `[year, st]`-Effekte nach; der
Plan wird deterministisch neu berechnet. Danach Toast („Geteilte Planung wurde
geladen." / „…teilweise geladen." / bei kaputtem `#plan=`: „…konnte nicht
vollständig geladen werden.") und Entfernen des Fragments via
`history.replaceState`. Validiert werden Version, Jahr (1970–2100),
Bundesland, Enums, `autoFrom` 0–11, echte Kalenderprüfung jedes `"m-d"`,
Deckelung (Blöcke ≤20, Overrides ≤400, Payload ≤100 000 Zeichen). Teilweise
gültige Links laden das Gültige + Hinweis; vollständig ungültige/veraltete
werden ignoriert (App startet normal). Links ohne `#plan=` funktionieren
unverändert.

### Teilen (Button)
`handleShare`: URL bauen → `navigator.share()` (falls verfügbar, `AbortError`
still) → sonst Clipboard-API („Link wurde kopiert.") → sonst Fallback-Dialog mit
markierbarem Feld + Kopier-Button (`execCommand`). Datenschutzhinweis im Dialog:
„Der Link enthält deine Planungseinstellungen. Jeder mit diesem Link kann die
Planung öffnen." Button im Header, in beiden Modi, mit `aria-label`, Fokusring
und Teilen-Icon.

### Einschränkungen
- **Linklänge**: praktische Obergrenze `SHARE_MAX_URL = 8000`; darüber Hinweis
  „Planung zu umfangreich für einen Link." (typische Pläne bleiben deutlich
  darunter).
- **Determinismus**: automatische Tage werden neu berechnet und stimmen exakt
  überein, solange Feiertage/Schulferien für (Jahr, Bundesland) identisch geladen
  werden; fällt eine API aus, greift die integrierte Feiertagsberechnung.
  Manuelle Tage sind nie betroffen (explizit gespeichert).
- **Datenschutz**: keine Übertragung an zusätzliche Server; kein externer
  Shortener/Speicherdienst.
- Ein geteiltes Jahr außerhalb der Dropdown-Spanne wird korrekt geladen/gerechnet;
  nur das Jahr-Auswahlfeld zeigt es evtl. nicht an.
