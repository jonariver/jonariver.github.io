/* ------------------------------------------------------------------ */
/* locales/de.js – Deutsche Übersetzungen des Urlaubsplaners           */
/* ------------------------------------------------------------------ */
/* Muss VOR app.jsx geladen werden (siehe index.html). Definiert das   */
/* globale Objekt window.I18N mit der Funktion t(key, params).         */
/* Kein Modulsystem (kein import/export) – reines globales Script,     */
/* damit es unverändert per <script src="locales/de.js"> im Browser    */
/* und auf GitHub Pages ohne Build-Schritt funktioniert.                */
/* ------------------------------------------------------------------ */

(function () {
  "use strict";

  const DE = {
    /* ---- Bundesländer (Codes bleiben sprachunabhängig, nur Namen) ---- */
    states: {
      BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg",
      HB: "Bremen", HH: "Hamburg", HE: "Hessen", MV: "Mecklenburg-Vorpommern",
      NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz",
      SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt",
      SH: "Schleswig-Holstein", TH: "Thüringen",
    },

    /* ---- Monate (Index 0 = Januar) ---- */
    months: [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember",
    ],

    /* ---- Wochentags-Kürzel, wie von JS Date.getUTCDay() geliefert (0=So) ---- */
    weekdaysApiOrder: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    /* ---- Vollständige Wochentagsnamen, gleiche Reihenfolge/Index (0=So) ---- */
    weekdaysFullApiOrder: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],

    /* ---- Von der App selbst berechnete/definierte Feiertagsnamen ---- */
    holidays: {
      newYear: "Neujahr",
      epiphany: "Heilige Drei Könige",
      womensDay: "Internationaler Frauentag",
      goodFriday: "Karfreitag",
      easterSunday: "Ostersonntag",
      easterMonday: "Ostermontag",
      laborDay: "Tag der Arbeit",
      ascensionDay: "Christi Himmelfahrt",
      pentecostSunday: "Pfingstsonntag",
      pentecostMonday: "Pfingstmontag",
      corpusChristi: "Fronleichnam",
      assumptionDay: "Mariä Himmelfahrt",
      childrensDay: "Weltkindertag",
      germanUnityDay: "Tag der Deutschen Einheit",
      reformationDay: "Reformationstag",
      allSaintsDay: "Allerheiligen",
      christmasDay1: "1. Weihnachtstag",
      christmasDay2: "2. Weihnachtstag",
      dayOfRepentance: "Buß- und Bettag",
    },

    /* ---- Sondertage (24./31.12.) ---- */
    special: {
      christmasEve: "Heiligabend",
      newYearsEve: "Silvester",
    },

    /* ---- Hinweise zu Feiertagen mit rechtlichen Besonderheiten ---- */
    holidayCaveats: {
      // Mariä Himmelfahrt (15.8.) ist in Bayern gesetzlich nur in Gemeinden mit
      // überwiegend katholischer Bevölkerung ein Feiertag, nicht landesweit.
      // Weder die lokale Berechnung noch externe Feiertags-APIs bilden diese
      // Gemeinde-Granularität ab; der Hinweis macht die Vereinfachung sichtbar.
      assumptionDayInline: "(nicht landesweit)",
      assumptionDayNotice:
        "Hinweis: Mariä Himmelfahrt (15. August) gilt in Bayern gesetzlich nur in Gemeinden mit überwiegend katholischer Bevölkerung, nicht landesweit. Diese Planung berücksichtigt ihn dennoch einheitlich als Feiertag – das kann in nicht-katholisch geprägten Gemeinden abweichen.",
    },

    /* ---- Von der App selbst gesetzte Fallback-Texte ---- */
    fallback: {
      schoolHolidays: "Schulferien",
    },

    /* ---- Tagestyp (Kalender-Tooltip, Dialog) ---- */
    dayType: {
      vacation: "Urlaub",
      overtime: "Überstundenabbau",
    },

    common: {
      moreInfo: "Mehr erfahren",
      documentTitle: "Urlaubsplaner",
      loadingSharedPlan: "Geteilte Planung wird geladen …",
    },

    /* ---- Kopfbereich ---- */
    header: {
      tagline: (p) => `Feiertage · Brückentage · ${p.state}`,
      title: (p) => `Urlaubsplaner ${p.year}`,
      // total/usedVacRaw/usedOtRaw sind die ungeformatierten Zahlenwerte (für den
      // Singular-Vergleich), usedVac/usedOt die ggf. mit Komma formatierten
      // Anzeigewerte (siehe fmtNum) – beide werden getrennt benötigt, da ein
      // Vergleich nie gegen den bereits formatierten String erfolgen darf.
      freeDaysSuffix: (p) => {
        const daysWord = p.total === 1 ? "freier Tag" : "freie Tage";
        const periodsWord = p.periods === 1 ? "Zeitraum" : "Zeiträumen";
        const vacWord = p.usedVacRaw === 1 ? "Urlaubstag" : "Urlaubstagen";
        const otPart = p.usedOtRaw > 0
          ? ` und ${p.usedOt} ${p.usedOtRaw === 1 ? "Überstundentag" : "Überstundentagen"}`
          : "";
        return `${daysWord} in ${p.periods} ${periodsWord} mit ${p.usedVac} ${vacWord}${otPart}`;
      },
    },

    nav: {
      simpleMode: "Einfach",
      proMode: "Profi",
      backToStart: "← Zur Startseite",
      backToStartAriaLabel: "Zurück zur Startseite",
    },

    /* ---- Landing Page (Startansicht vor dem Planer) ---- */
    landing: {
      hero: {
        heading: "Mach mehr aus deinen Urlaubstagen",
        description: "Nutze Feiertage, Brückentage und Schulferien passend zu deinem Bundesland. Lass dir automatisch eine Planung erstellen und passe sie anschließend direkt im Kalender an.",
        example: "4 Urlaubstage können bis zu 10 freie Tage ergeben.",
      },
      modes: {
        heading: "Wähle deinen Einstieg",
        simple: {
          badge: "Empfohlen",
          title: "Einfach planen",
          text: "Beantworte wenige kurze Fragen und erhalte automatisch passende Urlaubsvorschläge.",
          benefits: [
            "Geführte Planung",
            "Schnelles Ergebnis",
            "Schulferien bevorzugen oder meiden",
            "Anschließend im Kalender anpassbar",
          ],
          button: "Einfach starten",
        },
        pro: {
          title: "Individuell planen",
          text: "Lege verfügbare Kontingente, Zeiträume und Regeln selbst fest.",
          benefits: [
            "Urlaubstage manuell setzen oder entfernen",
            "Überstundentage in die Planung einbeziehen",
            "Wunschblöcke und Sperrzeiten festlegen",
            "Reihenfolge für Urlaub und Überstunden bestimmen",
          ],
          button: "Profi-Modus öffnen",
        },
      },
      video: {
        heading: "FREILOTSE in 30 Sekunden",
        description: "Sieh dir an, wie FREILOTSE deine Urlaubstage clever mit Feiertagen und Brückentagen kombiniert.",
        playButtonLabel: "Video abspielen",
        thumbnailAlt: "Vorschaubild des Erklärvideos",
        mobileIframeTitle: "FREILOTSE Erklärvideo (Hochformat)",
        desktopIframeTitle: "FREILOTSE Erklärvideo (Querformat)",
      },
      features: {
        heading: "Automatisch planen, flexibel anpassen",
        items: [
          { icon: "🎯", title: "Passende Vorschläge", text: "Feiertage und Brückentage werden möglichst effizient genutzt." },
          { icon: "🖊️", title: "Kalender selbst bearbeiten", text: "Setze Urlaubstage direkt im Kalender oder entferne vorgeschlagene Tage wieder." },
          { icon: "🔀", title: "Urlaub und Überstunden kombinieren", text: "Nutze im Profi-Modus Urlaubstage und verfügbare Überstundentage gemeinsam." },
        ],
      },
      steps: {
        heading: "So funktioniert es",
        items: [
          { title: "Angaben machen", text: "Jahr, Bundesland und Urlaubstage festlegen." },
          { title: "Wünsche auswählen", text: "Ziel und Umgang mit Schulferien bestimmen." },
          { title: "Planung anpassen", text: "Vorschläge prüfen und direkt im Kalender verändern." },
        ],
      },
      trust: {
        items: [
          "Feiertage passend zum Bundesland",
          "Schulferien werden berücksichtigt",
          "Keine Anmeldung erforderlich",
          "Planung als Link teilbar",
        ],
      },
      // Dezenter Teaser unmittelbar vor den Vertrauenshinweisen, verlinkt auf /ueber-freilotse.
      aboutTeaser: {
        text: "FREILOTSE ist ein unabhängiges Projekt von Jonathan.",
        linkText: "Mehr über das Projekt",
      },
    },

    /* ---- Seite „Über FREILOTSE" (/ueber-freilotse) ---- */
    about: {
      documentTitle: "Über FREILOTSE – Urlaubsplaner",
      metaDescription: "Lerne die Person hinter FREILOTSE kennen und erfahre, wie du das unabhängige Projekt freiwillig unterstützen kannst.",
      footerLink: "Über FREILOTSE",
      backToPlanner: "Zum Urlaubsplaner",
      pageTitle: "Über FREILOTSE",
      portraitAlt: "Jonathan, Entwickler von FREILOTSE",
      intro: "Hallo, ich bin Jonathan.",
      body: "Ich entwickle FREILOTSE als persönliches, unabhängiges Projekt. Die Idee entstand aus dem Wunsch nach einem Urlaubsplaner, der nicht nur Feiertage anzeigt, sondern wirklich dabei hilft, freie Zeit sinnvoll zu planen – einfach, verständlich und auch für unterschiedliche Arbeitsmodelle.",
      values: {
        heading: "Was mir bei FREILOTSE wichtig ist",
        items: [
          "Kostenlos nutzbar",
          "Keine Registrierung erforderlich",
          "Datensparsame und möglichst lokale Verarbeitung",
          "Verständliche Planung statt unnötig komplizierter Bedienung",
          "Weiterentwicklung anhand praktischer Anforderungen und Rückmeldungen",
        ],
      },
      support: {
        heading: "Freiwillig unterstützen",
        text: "Ich entwickle und betreibe FREILOTSE selbst. Die Weiterentwicklung sowie Domain und Betrieb kosten Zeit und Geld. Wenn dir FREILOTSE bei deiner Planung geholfen hat, kannst du das Projekt freiwillig mit einem Kaffee unterstützen. Das ist selbstverständlich kein Muss – FREILOTSE bleibt auch ohne Unterstützung vollständig nutzbar.",
        button: "☕ FREILOTSE freiwillig unterstützen",
        buttonAriaLabel: "FREILOTSE freiwillig über Ko-fi unterstützen (öffnet in neuem Tab)",
      },
      // prefix/suffix umschließen den eingebetteten mailto-Link (siehe jsx/about-page.jsx) -
      // Grund identisch zu jsx/legal-pages.jsx: locales/de.js kann kein JSX abbilden.
      contact: {
        prefix: "Du hast Feedback oder eine Idee für FREILOTSE? Schreib mir gerne an ",
        suffix: ".",
      },
    },

    share: {
      button: "Planung teilen",
      ariaLabel: "Aktuelle Planung als Link teilen",
      title: "Aktuelle Planung als Link teilen",
      nativeTitle: (p) => `Urlaubsplanung ${p.year}`,
      nativeText: (p) => `Meine Urlaubsplanung ${p.year} (${p.state}) – im Urlaubsplaner öffnen:`,
      toast: {
        linkCopied: "Link wurde kopiert.",
        copyManually: "Bitte den Link manuell markieren und kopieren.",
        tooLong: "Planung zu umfangreich für einen Link.",
        createFailed: "Link konnte nicht erstellt werden.",
        loadFailed: "Die geteilte Planung konnte nicht geladen werden.",
        loadedPartially: "Geteilte Planung wurde teilweise geladen.",
        loadedFully: "Geteilte Planung wurde geladen.",
      },
      modal: {
        title: "Planung teilen",
        privacyNote: "Der Link enthält deine Planungseinstellungen. Jeder mit diesem Link kann die Planung öffnen.",
        linkLabel: "Teilbarer Link",
        copyButton: "Link kopieren",
        closeButton: "Schließen",
      },
    },

    theme: {
      toLight: "\u2600\ufe0f Heller Modus",
      toDark: "\ud83c\udf19 Dark-Mode",
      toggleTitle: "Zwischen Dark-Mode und hellem Modus umschalten",
    },

    /* ---- Schulferien-Präferenz (gemeinsam für Einfach- und Profi-Modus) ---- */
    schoolHolidays: {
      question: "Wie sollen Schulferien bei deiner Planung berücksichtigt werden?",
      preference: {
        prefer: "In den Schulferien planen",
        avoid: "Schulferien möglichst meiden",
        neutral: "Keine Präferenz",
      },
      hint: "Bestimmt, ob automatisch erzeugte Urlaubsvorschläge bevorzugt innerhalb oder außerhalb der Schulferien liegen.",
      notice: {
        // "Keine Daten": beide Quellen waren erreichbar, lieferten aber keine
        // verwertbaren Ferien für Jahr+Bundesland.
        noData: (p) =>
          `Für ${p.state} sind für ${p.year} derzeit keine Schulferiendaten verfügbar. Deine Ferienpräferenz wird bei dieser Planung nicht berücksichtigt.`,
        // "Nicht erreichbar": beide Quellen sind technisch fehlgeschlagen.
        unreachable:
          "Die Schulferiendaten konnten derzeit nicht geladen werden. Deine Ferienpräferenz wird bei dieser Planung nicht berücksichtigt.",
      },
      optionsDisabledTitle: "Ohne verfügbare Schulferiendaten wirkungslos, bis Daten vorliegen.",
    },

    /* ---- Regelmäßige Arbeitstage (gemeinsam für Einfach- und Profi-Modus) ----
       Nur für dauerhaft gleichbleibende Wochenmuster (z. B. Teilzeit Mo–Do,
       Di–Sa) gedacht – KEINE wechselnden Schichten/rollierenden Dienstpläne,
       keine Stunden- oder Teilzeitquoten. */
    workingDays: {
      question: "An welchen Tagen arbeitest du normalerweise?",
      defaultSummary: "Montag bis Freitag",
      changeButton: "Ändern",
      closeButton: "Auswahl schließen",
      // from/to bereits vollständige, übersetzte Wochentagsnamen (siehe weekdaysFullApiOrder)
      summaryRange: (p) => `${p.from} bis ${p.to}`,
      // days: Array bereits vollständiger, übersetzter Wochentagsnamen
      summaryList: (p) => p.days.join(", "),
      resetButton: "Mo–Fr wiederherstellen",
      minOneRequired: "Mindestens ein Arbeitstag muss ausgewählt bleiben.",
      proPanelTitle: "Regelmäßige Arbeitstage",
      proHint: "Nicht ausgewählte Tage behandelt FREILOTSE wie regelmäßig freie Tage.",
    },

    /* ---- Einfach-Modus ---- */
    simple: {
      stepperTitle: "Deine Planung – Schritt für Schritt",
      step1Question: "1 · Wie viele Urlaubstage hast du?",
      step2Question: "2 · Für welches Jahr möchtest du planen?",
      step3Question: "3 · In welchem Bundesland arbeitest du?",
      // Neuer Schritt 4 (Arbeitstage) zwischen Bundesland und 24./31.12.-Regel;
      // nachfolgende Schritte deshalb um eins verschoben (4->5, 5->6, 6->7).
      // Schlüsselnamen bewusst unverändert gelassen, nur die sichtbaren
      // Nummern in den Textwerten wurden angepasst.
      stepWorkdaysQuestion: "4 · An welchen Tagen arbeitest du normalerweise?",
      step4Question: "5 · Wie gelten der 24.12. und 31.12. bei dir?",
      step4Options: {
        full: "Ich muss jeweils einen ganzen Urlaubstag nehmen.",
        half: "Sie zählen jeweils als halber Urlaubstag.",
        none: "Ich habe an beiden Tagen frei und benötige keinen Urlaub.",
      },
      step4Hint: "Viele Arbeitgeber behandeln Heiligabend und Silvester unterschiedlich. Wähle einfach die Regel aus, die für dich gilt.",
      step5Question: "6 · Wie sollen Schulferien berücksichtigt werden?",
      step6Question: "7 · Was ist dir wichtig?",
      goal: {
        free: "Möglichst viele freie Tage",
        blocks: "Lange Urlaubsblöcke",
        short: "Viele Kurzurlaube",
        custom: "Eigene Planung (Profi-Modus)",
      },
      calcButton: "Beste Planung berechnen",
      notStartedHint: "Wähle links deine Angaben und klicke auf „Beste Planung berechnen\".",
      resultHeading: "Deine optimale Urlaubsplanung",
      freeDaysLabel: "freie Tage",
      // count/periods sind stets ganzzahlig (keine fmtNum-Formatierung nötig),
      // daher genügt hier ein einfacher === 1-Vergleich für Singular/Plural.
      // Nominativ/Label-Kontext (eigenständige Kennzahl, kein Satzobjekt) -> "1 freier Tag".
      statTotalFree: (p) =>
        `Insgesamt ${p.count} ${p.count === 1 ? "freier Tag" : "freie Tage"} in ${p.periods} ${p.periods === 1 ? "Zeitraum" : "Zeiträumen"}`,
      // usedVac kann durch die 24./31.12.-Regelung halbe Tage enthalten, daher
      // getrennt formatierter Anzeigewert (count) und Rohwert (countRaw) für den
      // Singular-Vergleich (z. B. 1 vs. 1,5 Urlaubstage).
      statVacationDaysUsed: (p) => `Davon ${p.count} Urlaubstag${p.countRaw === 1 ? "" : "e"} eingeplant`,
      statHolidaysUsed: (p) =>
        p.count === 1 ? "1 Feiertag liegt innerhalb deiner Vorschläge" : `${p.count} Feiertage liegen innerhalb deiner Vorschläge`,
      statLongestStreak: (p) => `Längster zusammenhängender Zeitraum: ${p.count} Tag${p.count === 1 ? "" : "e"}`,
      // Akkusativ-Kontext (Satzobjekt von "erhältst") -> "1 freien Tag" (nicht
      // "freier Tag" wie bei statTotalFree/periodFreeDaysLabel, dort Nominativ).
      summarySentence: (p) =>
        `Mit ${p.usedVac} von ${p.totalVac} Urlaubstagen erhältst du insgesamt ${p.totalFree} ${p.totalFree === 1 ? "freien Tag" : "freie Tage"} in ${p.periods} ${p.periods === 1 ? "Zeitraum" : "Zeiträumen"}.`,
      recommendedBlocksHeading: "Empfohlene Urlaubsblöcke",
      noSuggestions: "Keine Vorschläge gefunden – erhöhe die Anzahl deiner Urlaubstage.",
      jumpToMonthTitle: "Zum Monat im Kalender springen",
      periodFreeDaysLabel: (p) => `${p.len} ${p.len === 1 ? "freier Tag" : "freie Tage"} · ${p.vac} Urlaubstag${p.vacRaw === 1 ? "" : "e"}`,
      showCalendar: "Kalender anzeigen",
      hideCalendar: "Kalender ausblenden",
    },

    /* ---- Profi-Modus: Panel „Allgemein“ ---- */
    settings: {
      panelTitle: "Allgemein",
      year: "Jahr",
      federalState: "Bundesland",
      vacationDays: "Urlaubstage",
      overtimeDaysLabel: "Überstundenabbau (Tage)",
      holidaySource: "Feiertagsquelle:",
      holidaySourceApi: "feiertage-api.de (online)",
      holidaySourceLoading: "wird geladen …",
      holidaySourceLocal: "integrierte Berechnung (API nicht erreichbar)",
      schoolHolidaySourceLabel: "Schulferienquelle:",
      schoolHolidaySourceOpenHolidays: "OpenHolidays API (online)",
      schoolHolidaySourceErsatz: "schulferien-api.de (Ersatzquelle)",
      schoolHolidaySourceNone: "keine Daten verfügbar",
      schoolHolidaySourceUnreachable: "derzeit nicht erreichbar",
      otCalc: {
        toggleShow: "Überstunden aus Stunden berechnen",
        toggleHide: "Überstunden-Rechner ausblenden",
        hoursLabel: "Überstunden (Stunden)",
        hoursPerDayLabel: "Stunden pro Arbeitstag",
        result: (p) => `= ${p.value} ${p.valueRaw === 1 ? "Überstundentag" : "Überstundentage"}`,
        resultInvalid: "Bitte gültige Werte eingeben.",
        apply: "Überstundentage übernehmen",
        applyAriaLabel: "Berechnete Überstundentage in das Feld „Überstundenabbau (Tage)“ übernehmen",
      },
    },

    /* ---- Profi-Modus: Panel „Arbeitsregelung“ ---- */
    workRules: {
      panelTitle: "Arbeitsregelung",
      xmasLabel: "24.12. und 31.12. zählen als",
      xmasOptionFull: "voller Urlaubstag (100 %)",
      xmasOptionHalf: "halber Urlaubstag (50 %)",
      xmasOptionNone: "frei – kein Urlaubstag (0 %)",
    },

    /* ---- Profi-Modus: Panel „Automatische Planung“ ---- */
    auto: {
      panelTitle: "Automatische Planung",
      budgetLabel: "Budget der Automatik",
      toMinimum: "auf Minimum",
      useVacationDays: "Urlaubstage nutzen",
      useOvertimeDays: "Überstd.-Tage nutzen",
      fromMonth: "Ab Monat",
      spendFirst: "Zuerst aufbrauchen",
      spendFirstVac: "Urlaubstage",
      spendFirstOt: "Überstunden",
      minimumHintPrefix: (p) => `Start: Minimum von ${p.days} Tagen – nur 1-Tages-Brücken.`,
      minimumHintDetail:
        "Mit dem Minimum kauft die Automatik ausschließlich isolierte 1-Tages-Lücken – 1 eingesetzter Tag erzeugt 4 freie Tage am Stück. Mehr Budget schaltet schrittweise 2-, 3- und 4-Tages-Lücken frei. „Ab Monat“ begrenzt nur die Automatik; Wunschblöcke und manuelle Klicks sind davon unabhängig und nutzen das volle Budget. Die Regler sind auf deine Angaben begrenzt.",
    },

    /* ---- Profi-Modus: Panel „Wunschblöcke“ ---- */
    blocks: {
      panelTitle: "Wunschblöcke",
      prioritizedHint: "werden priorisiert",
      addButton: "+ Block",
      emptyHint: "Noch keine Blöcke – lege fest, wie viele Tage am Stück du frei haben willst.",
      freeDaysLabel: "Tage frei",
      monthLabel: "Monat",
      monthAny: "egal",
      overtimeDaysLabel: "Überstd.-Tage",
      placed: (p) => `${p.start} – ${p.end} · kostet ${p.cost} Tage`,
      notPlaced: "Keine Platzierung möglich (Budget oder Monat prüfen)",
      removeButton: "Entfernen",
    },

    /* ---- Kennzahlen-Kacheln ---- */
    metrics: {
      leverage: "freie Tage pro eingesetztem Tag",
      longestStreak: "Längster zusammenhängender Zeitraum (Tage)",
      // Bewusst ohne "Mo-Fr"/"Werktage"/"Wochenende": zählt ausschließlich nach
      // persönlichem Arbeitsstatus (day.isWorkingDay), unabhängig vom
      // kalendarischen Wochentag - gilt unverändert für individuelle
      // Arbeitswochen (siehe workingDays).
      holidaysWorkdaysOnly: "Feiertage an deinen Arbeitstagen in deinen Zeiträumen",
      remaining: "übrig: Urlaub / Überstunden",
    },

    /* ---- Freie Zeiträume (Profi-Modus) ---- */
    results: {
      periodsHeading: "Deine freien Zeiträume",
      periodsEmptyHint: "Gib Urlaubstage ein, um Vorschläge zu sehen.",
      jumpToMonthTitle: "Zum Monat im Kalender springen",
      badgeBlock: "Wunschblock",
      badgeManual: "manuell",
      badgeAuto: "automatisch",
      periodSummary: (p) => `${p.len} Tage frei · ${p.vac} Urlaub${p.otRaw > 0 ? ` · ${p.ot} Überstunden` : ""}`,
      icsButton: "ICS/iCal",
      icsTitle: "Als .ics-Datei herunterladen (Apple Kalender, Outlook, iCal)",
      googleButton: "Google",
      googleTitle: "In Google Kalender öffnen (vorausgefüllter Termin)",
      reason: {
        xmasBoth: "Die Weihnachtsfeiertage sowie Heiligabend und Silvester werden verbunden.",
        xmasEveOnly: "Die Weihnachtsfeiertage und Heiligabend werden verbunden.",
        xmasNyeOnly: "Die Weihnachtsfeiertage und Silvester werden verbunden.",
        namedTwoWeekends: (p) => `${p.subject} ${p.plural ? "werden" : "wird"} mit zwei Wochenenden verbunden.`,
        namedExtends: (p) => `${p.subject} verlängert${p.plural ? "n" : ""} den freien Zeitraum.`,
        vacTwoWeekends: "Urlaubstage verbinden zwei Wochenenden zu einem längeren freien Zeitraum.",
        vacOneWeekend: "Urlaubstage verlängern ein Wochenende zu einem längeren freien Zeitraum.",
        vacOnly: "Urlaubstage ergeben einen längeren freien Zeitraum.",
      },
      warning: {
        schoolHolidayOverlap: (p) =>
          `Überschneidet sich an ${p.count} ${p.count === 1 ? "Tag" : "Tagen"} mit den Schulferien. Deine Auswahl wird als Präferenz und nicht als Ausschluss behandelt.`,
      },
      note: {
        schoolHolidayMatch: "Liegt wie gewünscht teilweise in den Schulferien.",
      },
      andSeparator: " und ",
    },

    /* ---- Manuell planen + Legende ---- */
    manual: {
      clickSetsLabel: "Klick im Kalender setzt",
      vacationDay: "Urlaubstag",
      overtimeReduction: "Überstundenabbau",
      resetButton: (p) => `Manuelle Änderungen zurücksetzen (${p.count})`,
      failedOne: "1 manuell gesetzter Tag konnte mangels Budget nicht übernommen werden.",
      failedMany: (p) => `${p.count} manuell gesetzte Tage konnten mangels Budget nicht übernommen werden.`,
      helpText: "Klick setzt Tage, Ziehen wählt mehrere aus, Klick auf geplante Tage öffnet Entfernen/Tauschen.",
      helpDetail:
        "Klick auf einen leeren Arbeitstag setzt den oben gewählten Tagestyp – mit der Maus kannst du gedrückt halten und ziehen, um mehrere Tage auf einmal auszuwählen, auch über Wochen- und Monatsgrenzen hinweg; Wochenenden, Feiertage und bereits geplante Tage werden übersprungen. Auf Touch-Geräten setzt du Tage einzeln per Tippen; Wischen scrollt wie gewohnt. Entfernte Tage bleiben Arbeitstage und werden von der Automatik nicht erneut belegt.",
    },

    legend: {
      vacation: "Urlaub",
      overtime: "Überstundenabbau",
      holiday: "Feiertag",
      xmasFree: "24./31.12. frei",
      xmasHalf: "24./31.12. halber Tag",
      weekend: "Wochenende",
      manualSet: "manuell gesetzt",
      schoolHolidays: "Schulferien",
      regularlyOff: "Regelmäßig frei",
      freePeriod: "Freier Zeitraum",
    },

    footerHint: {
      text: "Wunschblöcke zuerst, dann Brückentage streng nach Rendite.",
      detail:
        "Mariä Himmelfahrt gilt in Bayern nur in Gemeinden mit überwiegend katholischer Bevölkerung; Fronleichnam gilt in Sachsen und Thüringen nur in einzelnen Regionen und ist hier nicht berücksichtigt. Die Optimierung setzt Wunschblöcke zuerst; der 24.12. und der 31.12. werden bei 100%- oder 50%-Regelung immer fest eingeplant, damit sie die Feiertagsserie nicht unterbrechen. Die automatische Verteilung kauft mit dem Minimalbudget nur isolierte 1-Tages-Brücken (1 Tag → 4 freie Tage); mehr Budget schaltet 2-, 3- und 4-Tages-Lücken frei – verteilt über das Jahr, höchstens eine Lücke je Monat pro Runde. Reine Urlaubswochen ohne Feiertag werden nie automatisch verplant; nicht eingesetzte Tage bleiben als Rest übrig.",
    },

    /* ---- Kalender ---- */
    calendar: {
      weekdaysMonFirst: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
      summary: {
        publicHolidays: "Feiertage:",
        schoolHolidays: "Schulferien:",
        oneMore: " + 1 weiterer",
        nMore: (p) => ` + ${p.count} weitere`,
        rangeUntil: (p) => `bis ${p.date}`,
        rangeFrom: (p) => `ab ${p.date}`,
        rangeBetween: (p) => `${p.from}–${p.to}`,
      },
      vacationTooltip: (p) => `${p.name} in ${p.state} · ${p.start} bis ${p.end}`,
      // Nur relevant, wenn ein tatsächliches Kalenderwochenende laut
      // workingDays trotzdem ein persönlicher regulärer Arbeitstag ist (z. B.
      // Dienstag–Samstag) – macht das im Tooltip explizit, weil die Zelle
      // selbst weiterhin das gewohnte Wochenend-Styling behält.
      personalWorkday: "regulärer Arbeitstag",
    },

    /* ---- Dialog: geplanten Tag entfernen/tauschen ---- */
    dayDialog: {
      vacationDayType: "Urlaubstag",
      currentLabel: (p) => `Aktuell: ${p.type}${p.half ? " (halber Tag)" : ""}`,
      swapButton: (p) => `In ${p.target} tauschen`,
      removeButton: "Tag entfernen (wieder Arbeitstag)",
      cancelButton: "Abbrechen",
    },

    /* ---- Export (ICS / Google Kalender) ---- */
    exportCal: {
      eventTitle: "Urlaub",
      icsDescription: (p) =>
        `${p.len} Tage frei – ${p.vac} Urlaubstage${p.otRaw > 0 ? `, ${p.ot} Überstundenabbau` : ""} (Urlaubsplaner)`,
    },
  };

  /* ------------------------------------------------------------------ */
  /* Übersetzungsfunktion                                                */
  /* ------------------------------------------------------------------ */

  // Strukturvorlage für spätere Sprachen. Aktuell nur "de" aktiv/registriert;
  // eine locales/en.js (falls später ergänzt) müsste sich hier zusätzlich
  // eintragen, z. B. über window.I18N.registerLocale("en", EN).
  const LOCALES = { de: DE };
  let currentLocale = "de"; // einzige aktuell aktive Sprache

  function getPath(obj, path) {
    return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  // Ersetzt {platzhalter} in einem String durch params[platzhalter].
  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (match, key) => (params[key] !== undefined ? params[key] : match));
  }

  // t(key, params): zentrale Übersetzungsfunktion.
  // - key:    verschachtelter Schlüssel, z. B. "results.reason.vacOnly"
  // - params: optionale Werte für Platzhalter bzw. Argumente für
  //           Textfunktionen (Singular/Plural, zusammengesetzte Sätze).
  // Fehlt ein Schlüssel in der aktiven Sprache, wird auf Deutsch
  // zurückgefallen; fehlt er auch dort, wird das im Dev-Fall deutlich
  // sichtbar gemacht (Konsole + "⚠ key" statt eines stillen Absturzes).
  function t(key, params) {
    const dict = LOCALES[currentLocale] || LOCALES.de;
    let val = getPath(dict, key);
    if (val === undefined && currentLocale !== "de") val = getPath(LOCALES.de, key);
    if (val === undefined) {
      console.warn(`[i18n] Fehlender Übersetzungsschlüssel: "${key}"`);
      return `⚠ ${key}`;
    }
    if (typeof val === "function") return val(params || {});
    if (typeof val === "string") return interpolate(val, params);
    return val; // Arrays/Objekte (z. B. Monatsliste, Bundesländer) unverändert
  }

  function setLocale(loc) {
    if (LOCALES[loc]) currentLocale = loc;
    else console.warn(`[i18n] Unbekannte Sprache "${loc}" – bleibe bei "${currentLocale}".`);
  }
  function getLocale() {
    return currentLocale;
  }
  // Für eine spätere en.js: registriert eine weitere Sprache, ohne dass
  // app.jsx oder diese Datei sonst angepasst werden müssen.
  function registerLocale(loc, dict) {
    LOCALES[loc] = dict;
  }

  window.I18N = { t, setLocale, getLocale, registerLocale, LOCALES };
})();
