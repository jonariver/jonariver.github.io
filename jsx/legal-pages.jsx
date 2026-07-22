/* ------------------------------------------------------------------ */
/* jsx/legal-pages.jsx – Impressum und Datenschutzerklärung. Diese      */
/* rechtlichen Texte sind bewusst als String-Literale gehalten (nicht   */
/* über t(...)), weil sie eingebettete Links (ExternalLegalLink)        */
/* benötigen, die locales/de.js als reine Datendatei nicht abbilden     */
/* kann – siehe CLAUDE.md, Abschnitt „Internationalisierung und         */
/* UI-Texte". Wird über Babel-Standalone im Browser verarbeitet (kein   */
/* Bundler, kein Modulsystem). Muss NACH jsx/kofi-components.jsx        */
/* geladen werden (nutzt SiteLink/SiteFooter). In einer IIFE gekapselt; */
/* öffentliche Oberfläche: window.FREILOTSE.ui.                        */
/* ------------------------------------------------------------------ */
(function () {
  "use strict";
  const { useEffect } = React;
  const { SiteLink, SiteFooter } = window.FREILOTSE.ui;

  function LegalLayout({ title, children }) {
    useEffect(() => {
      let robots = document.querySelector('meta[name="robots"]');
      const created = !robots;
      const previousContent = robots?.getAttribute("content");

      if (!robots) {
        robots = document.createElement("meta");
        robots.setAttribute("name", "robots");
        document.head.appendChild(robots);
      }
      robots.setAttribute("content", "noindex, follow, noarchive");

      return () => {
        if (created) robots.remove();
        else if (previousContent === null) robots.removeAttribute("content");
        else robots.setAttribute("content", previousContent);
      };
    }, []);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
            <SiteLink to="/" className="font-bold tracking-tight text-white hover:text-emerald-400">FREILOTSE</SiteLink>
            <SiteLink to="/" className="text-sm text-slate-300 hover:text-white">Zum Urlaubsplaner</SiteLink>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm sm:p-8">
            <h1 className="mb-8 text-3xl font-bold tracking-tight">{title}</h1>
            <div className="space-y-7 text-sm leading-7 text-slate-300">{children}</div>
          </article>
        </main>
        <SiteFooter dark />
      </div>
    );
  }

  const LegalSection = ({ title, children }) => (
    <section>
      <h2 className="mb-2 text-lg font-bold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );

  const ExternalLegalLink = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300">
      {children}
    </a>
  );

  const ProviderDetailsImage = () => (
    <figure className="max-w-md">
      <img
        src="/assets/anbieterangaben.png"
        alt="Name und ladungsfähige Anschrift des Anbieters als Grafik"
        width="1000"
        height="320"
        className="h-auto w-full rounded-lg border border-slate-700"
      />
      <figcaption className="mt-2 text-xs leading-5 text-slate-400">
        Die Anbieterangaben werden zum Schutz vor einfachem automatisiertem Auslesen als Grafik dargestellt.
      </figcaption>
    </figure>
  );

  function ImpressumPage() {
    return (
      <LegalLayout title="Impressum">
        <LegalSection title="Angaben gemäß § 5 DDG">
          <p><strong className="text-white">FREILOTSE</strong></p>
          <ProviderDetailsImage />
        </LegalSection>
        <LegalSection title="Kontakt">
          <p>E-Mail: <a className="text-emerald-400 hover:text-emerald-300" href="mailto:freilotse@outlook.de">freilotse@outlook.de</a></p>
        </LegalSection>
        <LegalSection title="Verbraucherstreitbeilegung">
          <p>Ich bin nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
        </LegalSection>
      </LegalLayout>
    );
  }

  function DatenschutzPage() {
    return (
      <LegalLayout title="Datenschutzerklärung">
        <p>Stand: 22. Juli 2026</p>

        <LegalSection title="1. Verantwortlicher">
          <ProviderDetailsImage />
          <p>E-Mail: <a className="text-emerald-400 hover:text-emerald-300" href="mailto:freilotse@outlook.de">freilotse@outlook.de</a></p>
        </LegalSection>

        <LegalSection title="2. Hosting über Netlify">
          <p>Diese Website wird über Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, USA, bereitgestellt. Beim Aufruf der Website verarbeitet Netlify technisch erforderliche Verbindungsdaten. Dazu können insbesondere IP-Adresse, Datum und Uhrzeit des Abrufs, aufgerufene Seite beziehungsweise Datei, übertragene Datenmenge, Referrer-URL, Browsertyp, Betriebssystem und Zugriffsstatus gehören.</p>
          <p>Die Verarbeitung erfolgt, um die Website sicher, stabil und fehlerfrei auszuliefern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse liegt in der sicheren und zuverlässigen Bereitstellung dieses Angebots.</p>
          <p>Eine Verarbeitung in den USA ist möglich. Netlify gibt an, für Übermittlungen aus der EU das EU-US Data Privacy Framework und ergänzend geeignete Garantien wie Standardvertragsklauseln zu verwenden. Weitere Informationen enthält die <ExternalLegalLink href="https://www.netlify.com/privacy/">Datenschutzerklärung von Netlify</ExternalLegalLink>.</p>
        </LegalSection>

        <LegalSection title="3. Feiertags- und Schulferiendaten">
          <p>Der Urlaubsplaner ruft Feiertagsdaten von <ExternalLegalLink href="https://feiertage-api.de/">feiertage-api.de</ExternalLegalLink> ab. Schulferiendaten werden vorrangig von <ExternalLegalLink href="https://openholidaysapi.org/">OpenHolidays API</ExternalLegalLink> und bei einem technischen Fehler oder fehlenden Daten ersatzweise von <ExternalLegalLink href="https://schulferien-api.de/">schulferien-api.de</ExternalLegalLink> direkt aus deinem Browser ab. Dabei werden technisch bedingt insbesondere deine IP-Adresse sowie das ausgewählte Jahr und das Kürzel des ausgewählten Bundeslands an den jeweiligen Anbieter übertragen.</p>
          <p>Die Abfragen sind erforderlich, um die ausgewählten Kalenderdaten anzuzeigen und passende Planungsvorschläge zu berechnen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse liegt in der korrekten und aktuellen Bereitstellung der Planungsfunktion.</p>
        </LegalSection>

        <LegalSection title="4. Technische Bibliotheken und Content Delivery Networks">
          <p>Für die Darstellung und Ausführung der Website werden React, ReactDOM und Babel über unpkg sowie Tailwind CSS über cdn.tailwindcss.com geladen. Beim Abruf dieser Dateien wird technisch bedingt insbesondere deine IP-Adresse an die jeweiligen Anbieter übermittelt.</p>
          <p>Die Verarbeitung dient der funktionsfähigen und einheitlichen Darstellung der Website. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse liegt in der technisch zuverlässigen Bereitstellung des Urlaubsplaners. Die Anbieter können Daten auch außerhalb der EU beziehungsweise des EWR verarbeiten.</p>
        </LegalSection>

        <LegalSection title="5. Planung, Freigabelinks und Kalenderexport">
          <p>Deine Eingaben und berechneten Urlaubsdaten werden nicht an mich übermittelt und nicht dauerhaft in deinem Browser gespeichert. Die Berechnung erfolgt lokal in deinem Browser.</p>
          <p>Wenn du die Teilen-Funktion nutzt, werden die Planungseinstellungen in einem URL-Fragment gespeichert. Dieses Fragment wird beim normalen Seitenaufruf nicht an den Webserver übertragen. Der Inhalt ist kodiert, aber nicht verschlüsselt. Jede Person mit dem Link kann die darin enthaltene Planung öffnen. Teile einen solchen Link deshalb nur mit Personen, für die diese Informationen bestimmt sind.</p>
          <p>Beim Herunterladen einer ICS-Datei wird die Kalenderdatei lokal in deinem Browser erzeugt. Erst wenn du ausdrücklich „Google“ auswählst, wird Google Kalender geöffnet und die für den Termin erforderliche Information an Google übergeben. Dann gelten die Datenschutzbestimmungen von <ExternalLegalLink href="https://policies.google.com/privacy?hl=de">Google</ExternalLegalLink>.</p>
        </LegalSection>

        <LegalSection title="6. Kontaktaufnahme per E-Mail">
          <p>Wenn du mich per E-Mail kontaktierst, verarbeite ich die von dir mitgeteilten Daten zur Bearbeitung deiner Anfrage und für mögliche Anschlussfragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit deine Anfrage auf einen Vertrag oder vorvertragliche Maßnahmen gerichtet ist; im Übrigen Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse liegt in der Beantwortung von Anfragen.</p>
          <p>Mein E-Mail-Postfach wird über Outlook.com von Microsoft bereitgestellt. Dabei kann Microsoft die für die Übermittlung und Speicherung der Nachricht erforderlichen Daten verarbeiten. Für Nutzer im Europäischen Wirtschaftsraum ist Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irland, zuständig. Weitere Informationen enthält die <ExternalLegalLink href="https://privacy.microsoft.com/de-de/privacystatement">Datenschutzerklärung von Microsoft</ExternalLegalLink>.</p>
          <p>Die Daten werden gelöscht, sobald sie für die Bearbeitung nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>
        </LegalSection>

        <LegalSection title="7. Externer Link zu Ko-fi">
          <p>Auf dieser Website befindet sich ein normaler externer Link zu meinem Profil bei Ko-fi. Beim bloßen Besuch von FREILOTSE werden dadurch keine Daten an Ko-fi übertragen. Erst wenn du den Link anklickst, verlässt du diese Website und dein Browser stellt eine Verbindung zu Ko-fi her. Dabei können personenbezogene Daten, insbesondere deine IP-Adresse und technische Verbindungsdaten, durch Ko-fi verarbeitet werden. Für die weitere Datenverarbeitung auf der Ko-fi-Website ist Ko-fi verantwortlich. Weitere Informationen findest du in der <ExternalLegalLink href="https://ko-fi.com/home/privacy">Datenschutzerklärung von Ko-fi</ExternalLegalLink>.</p>
        </LegalSection>

        <LegalSection title="8. Eingebettete YouTube-Videos">
          <p>Auf dieser Website werden Videos der Plattform YouTube eingebunden. Anbieter ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.</p>
          <p>Die Website verwendet eine Zwei-Klick-Lösung. Beim bloßen Aufruf der Seite wird noch keine Verbindung zu YouTube hergestellt. Zunächst wird lediglich ein lokal gespeichertes Vorschaubild angezeigt. Erst wenn du das Video durch Anklicken aktivierst, wird der YouTube-Player über die datenschutzfreundlichere Domain youtube-nocookie.com geladen.</p>
          <p>Dabei wird eine Verbindung zu Servern von Google hergestellt. Google erhält insbesondere deine IP-Adresse, technische Informationen zu deinem Browser und Gerät sowie die Information, welche Seite du aufgerufen hast. Wenn du gleichzeitig bei einem Google- beziehungsweise YouTube-Konto angemeldet bist, kann Google den Aufruf deinem Konto zuordnen. Beim Abspielen können außerdem Cookies oder vergleichbare Speichertechniken eingesetzt werden.</p>
          <p>Mit dem Anklicken des Videos willigst du in die Übertragung deiner Daten an Google und eine mögliche Verarbeitung in den USA ein. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. a DSGVO und, soweit Informationen auf deinem Endgerät gespeichert oder ausgelesen werden, § 25 Abs. 1 TDDDG. Die Einwilligung ist freiwillig. Ohne Aktivierung des Videos findet keine Übertragung durch den eingebetteten YouTube-Player statt.</p>
          <p>Die Einbindung erfolgt im erweiterten Datenschutzmodus von YouTube. Nach Angaben von Google werden Aufrufe solcher Videos nicht zur Personalisierung der Nutzungserfahrung auf YouTube verwendet. Weitere Informationen findest du in der <ExternalLegalLink href="https://policies.google.com/privacy?hl=de">Datenschutzerklärung von Google</ExternalLegalLink>.</p>
        </LegalSection>

        <LegalSection title="9. Cookies, lokale Speicherung und Netlify Web Analytics">
          <p>Der eigene Anwendungscode von FREILOTSE setzt keine Cookies ein und verwendet weder Local Storage noch Session Storage. Es findet keine personalisierte Werbung oder Bildung individueller Nutzerprofile durch FREILOTSE statt.</p>
          <p>Diese Website verwendet Netlify Web Analytics zur statistischen Auswertung der Nutzung. Die Auswertung erfolgt serverseitig anhand der Protokolldaten des Netlify Content Delivery Networks. Ausgewertet werden insbesondere Seitenaufrufe, aufgerufene Seiten, ungefähre Herkunftsorte und die Anzahl unterschiedlicher Besucher. Zur Bestimmung unterschiedlicher Besucher vergleicht Netlify IP-Adressen innerhalb begrenzter Zeiträume.</p>
          <p>Nach Angaben von Netlify erfolgt die Auswertung anonym, ohne Cookies, ohne clientseitiges Tracking-Skript und ohne personenbezogene Nutzerprofile. Die Verarbeitung dient der statistischen Auswertung und Verbesserung des Angebots. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse liegt darin, die Nutzung von FREILOTSE nachvollziehen und das Angebot technisch und inhaltlich verbessern zu können.</p>
          <p>Da Netlify Web Analytics keine Cookies setzt und kein clientseitiges Tracking verwendet, wird hierfür derzeit kein Einwilligungsbanner eingesetzt. Weitere Informationen enthält die <ExternalLegalLink href="https://docs.netlify.com/monitor-sites/analytics/">Dokumentation zu Netlify Web Analytics</ExternalLegalLink>.</p>
        </LegalSection>

        <LegalSection title="10. Speicherdauer">
          <p>Soweit in dieser Datenschutzerklärung keine besondere Speicherdauer genannt ist, werden personenbezogene Daten nur so lange verarbeitet, wie dies für den jeweiligen Zweck erforderlich ist. Gesetzliche Aufbewahrungsfristen bleiben unberührt.</p>
        </LegalSection>

        <LegalSection title="11. Deine Rechte">
          <p>Du hast im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit.</p>
          <p>Beruht eine Verarbeitung auf Art. 6 Abs. 1 lit. f DSGVO, kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, Widerspruch gegen die Verarbeitung einlegen. Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt davon unberührt.</p>
          <p>Du hast außerdem das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren. Zuständig ist insbesondere das Bayerische Landesamt für Datenschutzaufsicht, Promenade 18, 91522 Ansbach. Weitere Informationen findest du unter <ExternalLegalLink href="https://www.lda.bayern.de/">www.lda.bayern.de</ExternalLegalLink>.</p>
        </LegalSection>

        <LegalSection title="12. Änderungen dieser Datenschutzerklärung">
          <p>Ich passe diese Datenschutzerklärung an, wenn sich Funktionen, eingesetzte Dienste oder rechtliche Anforderungen ändern.</p>
        </LegalSection>
      </LegalLayout>
    );
  }

  window.FREILOTSE = window.FREILOTSE || {};
  window.FREILOTSE.ui = window.FREILOTSE.ui || {};
  Object.assign(window.FREILOTSE.ui, {
    LegalLayout, LegalSection, ExternalLegalLink, ProviderDetailsImage, ImpressumPage, DatenschutzPage,
  });
})();
