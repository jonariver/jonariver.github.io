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
- **Keine Persistenz der Planung:** Nur der Offen/Zu-Zustand der Karten wird
  gespeichert. Manuelle Overrides, Blöcke und übrige Eingaben liegen nur im
  Speicher und gehen beim Neuladen verloren.
- Externe Laufzeitabhängigkeiten (React-, Babel-, Tailwind-CDN sowie beide APIs):
  Bei fehlenden Feiertagsdaten gibt es einen lokalen Fallback, bei fehlenden
  Schulferien nur einen Hinweis.
