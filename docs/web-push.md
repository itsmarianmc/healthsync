# Web Push v1 – Einrichtung und Test

Stand: 24. Oktober 2026. Implementiert sind ein freiwilliger fünfter Onboarding-Schritt (vor dem Abschluss), Verwaltung in Settings und ein neutraler Test-Push. Es gibt keine Reminder, Zeitplanung, Cron-Jobs oder Kampagnen. Food-, Drink- und Supplement-Daten werden nicht übertragen. Push ist eine eigene Entscheidung und ändert keine Cookie-/Analytics-Einwilligung.

Automatische Erinnerungen sind separat [vorbereitet](./web-push-reminders.md):
ein isolierter Tagesplaner mit Tests und ein konkreter Vorschlag für begrenzte
Worker-Rechte. Der Planer ist nicht angeschlossen; globale Datenbankrechte,
Persistenz, Scheduler, Reminder-Einwilligung und Oberfläche warten auf die
ausdrücklich verlangte Sicherheitsfreigabe. Der folgende v1-Ablauf bleibt bestehen.

## Ablauf und Zustände

`Notifications.tsx` verwendet dieselbe Push-Verwaltung mit einer eigenen Onboarding-Darstellung: als Vorschau gekennzeichnete Beispielbenachrichtigung, kurzer Funktionshinweis und separate Karte für Gäste. Technische Statuszeilen sind im Onboarding für Gäste ausgeblendet; in Settings und für angemeldete Nutzer bleiben Browserberechtigung und gespeicherter Gerätestatus getrennt sichtbar. Ein aktives Abo in `push_subscriptions` ist die serverseitige Opt-in-Auswahl; es gibt keinen zusätzlichen globalen Local-Storage-Schalter. Gäste können überspringen und später nach der Anmeldung in Settings aktivieren. „Not now“ öffnet keinen Systemdialog und legt kein Abo an. Bereits vorhandene Abos werden dadurch nicht gelöscht.

Nur „Enable notifications“ ruft bei `default` direkt `Notification.requestPermission()` auf, vor allen asynchronen Vorarbeiten. Bei `granted` wird der Dialog übersprungen, bei `denied` auf die Browser-/Systemeinstellungen verwiesen. Aktivieren speichert das Geräteabo und versucht danach genau einen Test. Ein gescheiterter Test hebt das gespeicherte Opt-in nicht auf; die Oberfläche meldet den Fehler und bietet Wiederholung an. HTTP-Erfolg bedeutet Annahme durch den Push-Dienst, nicht bestätigte Anzeige am Gerät.

Settings lädt beim Öffnen, bei Fensterfokus und über „Refresh status“ den Serverstatus und gleicht ihn mit dem lokalen Browserabo ab. Ein Lese-/Authfehler bleibt „Not confirmed“ und wird nicht als ausgeschaltet ausgegeben. Ein anderer Account übernimmt kein bestehendes Browserabo: beim expliziten Aktivieren wird ein fremdes oder mit einem anderen VAPID-Schlüssel erstelltes Browserabo ersetzt. Offene Komponentenaktionen werden nach dem Verlassen verworfen. Deaktivieren entfernt zuerst das eigene Serverabo und anschließend das Browserabo; die Browserberechtigung bleibt erhalten. Fehlgeschlagene Löschungen sind wiederholbar.

Feature Detection prüft Secure Context, Notifications, PushManager und Service Worker. iOS/iPadOS außerhalb einer Standalone-App erhält zuerst die Home-Screen-Anleitung, auch wenn Push-APIs dort fehlen. Erforderlich sind HTTPS, eine unterstützte iOS-/iPadOS-Version und eine direkte Nutzeraktion. Siehe [WebKit](https://webkit.org/blog/13878/). Es wurde keine reale iPhone-/iPad-Zustellung nachgewiesen.

## API und Versand

Alle Routen verwenden die Node.js-Runtime, Bearer-Token aus der bestehenden Supabase-Sitzung, serverseitig verifizierten Nutzer und MFA-Prüfung über `authorizeProtectedRequest`. Kein Service-Role-Key. Jede Datenbankabfrage schränkt zusätzlich zu RLS auf `user_id` ein. Antworten sind `Cache-Control: no-store`; APIs protokollieren weder Endpoints noch Schlüssel oder Providerfehler.

| Route | Verhalten |
|---|---|
| `GET /api/push/subscriptions` | Eigene Endpoints und öffentlichen VAPID-Schlüssel laden; keine Verschlüsselungsschlüssel zurückgeben |
| `POST /api/push/subscriptions` | Browser-Subscription `{endpoint, keys: {p256dh, auth}}` idempotent speichern |
| `DELETE /api/push/subscriptions` | Eigenes Abo mit `{endpoint}` entfernen; idempotent |
| `POST /api/push/test-notification` | Genau das eigene Geräteabo mit `{endpoint}` testen |

Eigene Routen liefern `{ok, error?}`. Wichtige Fehler: 400 ungültige Eingabe, 403 Anmeldung/MFA/Origin, 404 fehlendes Abo, 410 abgelaufenes Abo (nach erfolgreicher Löschung), 429 Limit, 502 Versandfehler, 503 Konfiguration/Datenbank/Service nicht verfügbar. Providertexte werden nicht ausgegeben. Zulässige HTTPS-Push-Hosts sind in `pushValidation.ts` begrenzt (Google, Mozilla, Apple und Windows), um beliebige serverseitige URL-Aufrufe zu verhindern. Neue Push-Dienste erfordern eine bewusste Erweiterung und Prüfung dieser Liste.

`claim_push_test()` begrenzt dauerhaft und atomar auf einen Versuch je 60 Sekunden pro Nutzer, über Geräte und Vercel-Instanzen hinweg. Löschen/Neuanlegen eines Abos setzt das Limit nicht zurück. Die Funktion nimmt keinen frei wählbaren Nutzer entgegen. Der Sender verwendet `web-push`, TTL 60 Sekunden und Socket-Timeout 10 Sekunden. Push-Dienst-Antworten 404/410 entfernen das eigene veraltete Abo; andere Fehler behalten es. Das Payload enthält ausschließlich `{type: 'healthsync-test'}`. Der Service Worker zeigt feste neutrale Texte, fokussiert beim Klick ein vorhandenes HealthSync-Fenster oder öffnet `/dash`. Serwist-Caching und Offline-Fallback bleiben erhalten.

## Migration und Daten

Im tatsächlich geprüften Checkout fehlte `supabase/migrations/`; ältere Hinweise auf eine vorhandene Custom-Supplement-Migration waren nicht zutreffend. Neu vorbereitet ist ausschließlich [`20261024010000_web_push.sql`](../supabase/migrations/20261024010000_web_push.sql). `.gitignore` nimmt nur diese neue Datei vom bisherigen Supabase-Verzeichnisausschluss aus; lokale CLI-Daten/Backups bleiben ausgeschlossen.

- `push_subscriptions`: eindeutiger Endpoint, `user_id` mit Auth-Cascade, `p256dh`, `auth`, `created_at`; Owner-RLS für alle CRUD-Operationen und restriktive MFA-Policy.
- `push_test_limits`: `user_id` und `last_sent_at`; keine direkten Clientrechte, RLS aktiv. Ausschließlich die autorisierte Definer-Funktion schreibt das Limit.
- `push_access_allowed()`: gekapselte, auf die aktuelle UID eingeschränkte Prüfung der verifizierten MFA-Faktoren; AAL2 erforderlich, sobald ein verifizierter Faktor existiert. Fester leerer `search_path`, keine Ausführung für `public`/`anon`.

Die Migration setzt Supabase Auth voraus, ersetzt keine vorhandenen App-Policies und ändert keine Health-Tabellen oder Reset-RPCs. Vollständige Accountlöschung entfernt beide neuen Tabellenzeilen per Cascade. „Delete All Data“ hat weiterhin die bestehende Health-Reset-Semantik; Push lässt sich separat in Settings deaktivieren. Browserabos können nach Accountlöschung bestehen bleiben, werden aber ohne Datenbankzeile nicht mehr vom Backend adressiert.

**Nicht angewendet.** Vor einer Anwendung: tatsächliche Migrationshistorie, Namenskollisionen für die beiden Tabellen und Funktionen, Auth-Schema, Grants und Policies im Zielprojekt prüfen; siehe [Runbook](./security-migration.md). In einem isolierten Supabase-Projekt mit zwei Wegwerfkonten testen: Gast ohne Zugriff; AAL1 ohne verifizierten Faktor CRUD nur auf eigene Abos; mit verifiziertem Faktor AAL1 komplett abweisen; AAL2 eigenes CRUD erlauben; fremde Endpoints und fremde Testziele abweisen; parallele Limit-Claims genau einmal erlauben; Abo-Löschung darf Limit nicht zurücksetzen; Auth-Account-Cascade prüfen. Diese Datenbankfälle wurden nicht live ausgeführt.

## Vercel-Konfiguration

Unter **Project → Settings → Environment Variables** die folgenden Variablen für die gewünschten Umgebungen hinterlegen:

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Öffentlicher VAPID-Schlüssel; im Browser zulässig, hier über die Status-API geliefert |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Privater VAPID-Schlüssel, ausschließlich serverseitig |
| `WEB_PUSH_VAPID_SUBJECT` | VAPID-Kontakt, gültige `mailto:`-Adresse oder HTTPS-URL |

Das Schlüsselpaar einmal in einer sicheren lokalen Umgebung erzeugen und in Vercel eintragen. `.env.example` enthält nur leere Push-Platzhalter. Keine echten Werte in Chat, Logs, Tests, Beispiel-Exports oder Versionskontrolle kopieren. Die privaten Variablen niemals mit `NEXT_PUBLIC_` benennen. Für die Vorbereitung wurden keine Vercel-Werte geändert und kein Deployment ausgelöst. Nach geprüfter Migration und Konfiguration ist ein neuer Deploymentstand erforderlich. Bei Schlüsselrotation Geräte bewusst erneut einrichten.

## Prüfung

Automatisierte Tests verwenden gefälschte Browser-/Push-APIs, Authentifizierung und Sender; sie belegen keine externe Zustellung. Nach Bereitstellung manuell mit einem angemeldeten Testkonto auf HTTPS prüfen: im Onboarding überspringen ohne OS-Dialog, später aktivieren, neutralen Test empfangen, Klick fokussiert/öffnet HealthSync, deaktivieren und nach erneutem Öffnen ausgeschalteten Serverstatus sehen. Separat auf einem realen iPhone/iPad als Home-Screen-App prüfen. Fokus-Modi und OS-Einstellungen können die sichtbare Zustellung beeinflussen.

Lokaler Prüfstand vom 24.10.2026: `npm test` 78/78 bestanden; `npx playwright test e2e/push.spec.ts e2e/onboarding.spec.ts e2e/onboarding-steps.spec.ts --workers=2 --reporter=line` 22/22 in Edge bestanden, einschließlich mobiler Geometrie. `npx tsc --noEmit`, gezieltes ESLint für die neuen Push-Dateien und `src/app/sw.ts`, `git diff --check` und `npm run build` bestanden. Gesamtes `npm run lint` meldet weiterhin 124 Fehler und 50 Warnungen im übrigen Repository; neue Push-Dateien sind lintfrei. Die vollständige E2E-Suite, Live-RLS und echter Push-Versand wurden nicht ausgeführt. Next.js/Edge und Build benötigten Ausführung außerhalb der Sandbox, nachdem Next.js darin beim Start hängenblieb.
