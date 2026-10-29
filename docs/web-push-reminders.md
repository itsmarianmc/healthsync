# Automatische Web-Push-Erinnerungen – Vorbereitung und Sicherheitsfreigabe

Stand: 24.10.2026. **Teilimplementierung, kein aktiver Reminder-Versand.**
Der isolierte serverseitige Planer und seine Tests sind vorhanden. Persistenz,
Cron-/QStash-Routen, Einwilligungs-API, Reminder-Anzeige im Service Worker und
Oberfläche sind noch nicht implementiert. Es gibt keine zusätzliche Migration,
keine neue Datenbankrolle, keine neuen Secrets und keine externe Konfiguration.
Der bestehende Test-Push und sein Limit bleiben unverändert.

## Festgestellte Sicherheitsgrenze

[`pushServer.ts`](../src/app/_lib/pushServer.ts) erstellt einen Supabase-Client
mit Anon-Key und verifiziertem Bearer-Token des einzelnen Nutzers.
[`serverAuthorization.ts`](../src/app/_lib/serverAuthorization.ts) erzwingt MFA
bei verifiziertem Faktor. Alle vorhandenen Push-Abfragen filtern zusätzlich auf
die serverseitig bestätigte UID. Die vorbereitete
[`Push-Migration`](../supabase/migrations/20261024010000_web_push.sql) erlaubt
ausschließlich Owner-Zugriff mit restriktiver MFA-Policy. Ihre beiden
Definer-Funktionen prüfen die aktuelle Identität; sie bieten keinen globalen
Empfängerzugriff. `SUPABASE_SERVICE_ROLE_KEY` wird im aktuellen Code nur zur
Accountlöschung verwendet. Kein Ziel-Datenbankzustand wurde abgefragt.

Ein Cron-/Scheduler-Aufruf besitzt keine Nutzersitzung und kein AAL2-Token.
Damit gibt es nach den vorhandenen Verträgen keinen autorisierten globalen
Versandweg. Der Auftrag verlangt ausdrücklich, vor zusätzlichen privilegierten
Rechten anzuhalten. Die folgenden Rechte sind ein **Vorschlag zur Freigabe**,
keine erteilten oder implementierten Grants.

## Kleinste vorgeschlagene zusätzliche Berechtigung

Eigene serverseitige Login-Rolle `healthsync_reminder_worker`, ohne Superuser,
`BYPASSRLS`, Rollen-/Datenbankverwaltung oder Mitgliedschaft in anderen
privilegierten Rollen. Verbindung über einen separaten TLS-/Pooler-Zugang in
`REMINDER_DATABASE_URL`; kein Service-Role-Key und keine gespeicherten
Nutzer-/Refresh-Tokens. Auch ein umbenannter Service-Role-Key wäre keine
Rechtebegrenzung.

Die Login-Rolle erhält nur Schema-`USAGE` und `EXECUTE` auf eine abschließend
definierte Liste von Funktionen in einem nicht per Data API exponierten Schema:

| Vorgeschlagene Funktion | Ausschließlich erlaubte Wirkung |
|---|---|
| `ensure_day_plan` | Fünf Ereignisse atomar für ein Datum anlegen oder den bereits gespeicherten Plan zurückgeben |
| `claim_schedule_batch` / `finish_schedule` | Begrenzte ausstehende Veröffentlichungen sperren und Scheduler-Ergebnis festhalten |
| `claim_recipient_batch` | Für ein gespeichertes, fälliges Ereignis höchstens eine begrenzte Seite explizit zustimmender Nutzer und deren ausgewähltes Geräteabo reservieren |
| `begin_delivery` | Einwilligung, Kategorie und Abo erneut prüfen und einen einmaligen Versandversuch dauerhaft beanspruchen |
| `finish_delivery` | Ergebnis ausschließlich zum eigenen gültigen Claim speichern |
| `remove_expired_subscription` | Ausschließlich das im Claim adressierte, noch identische Abo nach 404/410 entfernen |

Die Rollen erhalten keine direkten Tabellenrechte auf `public`, keine Rechte
auf Auth-Verwaltung, Gesundheitsdaten oder `push_test_limits`. Die Funktionen
haben leeren `search_path`, feste qualifizierte SQL-Abfragen, validierte
Ereignis-/Claim-Parameter und feste Batch-Limits. Kein dynamisches SQL und kein
frei wählbarer Nutzer, Endpoint oder Tabellennamen als Versandziel. Ausführung
für `PUBLIC`, `anon`, `authenticated` und sonstige Rollen explizit entziehen.
Ein eigener NOLOGIN-Funktionseigentümer erhält nur die dafür nötigen Rechte und
rollenspezifischen RLS-Policies auf Push-Abos und den neuen Reminder-Tabellen.
Er darf bestehende Owner-/MFA-Policies nicht für App-Nutzer abschwächen.

Bewusst neue Befugnis: Diese Funktionen dürfen ohne einzelne Nutzersitzung
Push-Endpunkte und Verschlüsselungsschlüssel **mehrerer zustimmender Nutzer**
an den Server-Worker liefern. Das ist trotz begrenzter Funktionen eine
privilegierte Erweiterung. Die Freigabe umfasst diesen unbeaufsichtigten
Opt-in-Versand auch für MFA-Konten; Änderungen an Abo und Einwilligung bleiben
an die bestehende Owner-/MFA-Prüfung gebunden. Die konkrete Rollen-/Pooler- und
RLS-Ausgestaltung muss vor einer Anwendung im isolierten Supabase-Projekt
nachgewiesen werden; allgemeine Rollen-Dokumentation belegt keine vorhandenen
Grants im Zielprojekt.

## Vorbereiteter Tagesplan

[`pushReminderPlan.ts`](../src/app/_lib/pushReminderPlan.ts) erzeugt einen
Kandidaten für genau ein ISO-Kalenderdatum. Es gibt keine gespeicherte
Nutzerzeitzone im geprüften Code (`UserSettings`, lokale Daten und Sync).
`timezone: 'auto'` beim Wetter ist keine solche Einstellung. Deshalb gilt
vorläufig für alle Nutzer **IANA `Europe/Berlin`**, einschließlich Sommerzeit.
Food-/Drink-Datumsformate bleiben unverändert.

| Kategorie | Gemeinsames lokales Zeitfenster, einschließlich Grenzen |
|---|---|
| Morgen (`breakfast`) | 07:00–09:00 |
| Mittagessen (`lunch`) | 11:30–13:30 |
| Supplements (`supplements`) | 14:00–14:45 |
| Snack (`snack`) | 15:30–16:15 |
| Abendessen (`dinner`) | 17:00–20:00 |

Auswahl auf volle Minuten mit `node:crypto.randomInt`. Zwischen allen fünf
Terminen liegen mindestens 45 Minuten. Nach höchstens 32 kompletten
Neuauswahlen greift ein gültiger fester Ersatzplan: 08:00, 12:30, 14:15, 15:45,
18:30. Die Umrechnung ermittelt den IANA-Offset am jeweiligen Ereignis und
liefert eindeutige UTC-ISO-Zeitpunkte mit `Z`. Die Ereigniskennung ist stabil:
`healthsync-reminder:YYYY-MM-DD:<category>`.

**Noch keine Retry-Garantie:** Erneutes Aufrufen des Generators kann andere
Zeiten liefern. Erst `ensure_day_plan` muss in einer Transaktion den gesamten
Tag atomar persistieren; ein konkurrierender Aufruf liest den Gewinner. Bei
Retries immer diesen gespeicherten Plan verwenden. Kein Versand oder Publish
vor erfolgreichem Commit. Die aktuellen Tests belegen Kandidaten und stabile
Kennungen, keine Datenbankpersistenz oder Cron-Idempotenz.

## Vorgesehene Persistenz und Retry-Semantik nach Freigabe

- `push_reminder_preferences`: `user_id` eindeutig, globales `enabled=false`,
  fünf Kategorien ebenfalls `false`, expliziter Einwilligungszeitpunkt und
  Versionskennung. Fehlender Datensatz bedeutet aus. Owner-/MFA-RLS für
  Lesen/Ändern; bestehende Abos werden nicht automatisch eingeschaltet.
- `push_reminder_days`: eindeutiges gemeinsames Datum, IANA-Zone und
  Planversion. `push_reminder_events`: eindeutig `(date, category)` sowie
  `event_id`, UTC-`scheduled_at`, Publish-Status, Lease und QStash-Nachrichten-ID.
  Atomare Anlage aller fünf Ereignisse; keine individuellen Nutzerzeiten.
- `push_reminder_deliveries`: eindeutig `(user_id, date, category)`, reserviertes
  Geräteabo, Claim, Status und neutrale Fehlerklasse. Account-Cascade für
  personenbezogene Daten; keine Gesundheitsdaten in diesen Tabellen.
- Genau ein ausgewähltes registriertes Geräteabo pro Nutzer und Ereignis,
  damit mehrere Geräte nicht mehrere Pushes derselben Kategorie verursachen.
  Auswahl deterministisch aus vorhandenen Abos; neue Geräte erben keine
  zusätzliche Einwilligung. Vor dem Versand wird die aktuelle Zustimmung
  einschließlich Kategorie nochmals geprüft. Supplements erfordert ausdrücklich
  `enabled` **und** die aktivierte Supplement-Kategorie.
- Ein dauerhafter eindeutiger Claim verhindert konkurrierende Sendungen. Vor
  dem Netzwerkaufruf wird der Versandversuch irreversibel als begonnen markiert.
  Nach begonnenem Versuch erfolgt bei Timeout/Absturz keine automatische
  Wiederholung desselben Nutzerereignisses. Sonst könnte nach erfolgreicher
  Providerannahme und fehlendem Datenbank-Commit ein Duplikat entstehen.
  Das ist At-most-once mit möglichem Ausfall, keine garantierte Exactly-once-
  Zustellung. Nicht begonnene Claims dürfen mit Lease erneut verarbeitet werden.
- 404/410 entfernen nur das beanspruchte, unveränderte Abo. Andere Fehler
  bleiben als Versandfehler sichtbar und löschen keine Abos. Keine Verwendung
  oder Änderung von `claim_push_test()` und dessen 60-Sekunden-Limit.

## Vorgesehener Scheduler nach Freigabe

Im Checkout gibt es weder QStash noch einen anderen verzögerten Scheduler oder
eine `vercel.json`. Vorgeschlagen: ein Vercel-Cron `0 3 * * *` in UTC. Er läuft
auf Hobby irgendwann zwischen 03:00 und 03:59 UTC und damit vor dem frühesten
Berliner Morgenfenster, auch bei Sommerzeit. Der Handler prüft strikt
`Authorization: Bearer <CRON_SECRET>`, bestimmt das Berliner Tagesdatum und
lädt/erzeugt den dauerhaften Plan. Kein minütliches Prüfen von Zeitfenstern.
Siehe [Vercels Cron-Limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Die fünf initialen QStash-Aufträge verwenden `notBefore` als UTC-Unixsekunden
aus dem gespeicherten `scheduledAt`. Nachrichtenkörper ausschließlich
`{date, category, eventId}` über die vorhandene `reminderJob()`-Allowlist.
Keine Empfänger-IDs, Endpoints, Push-Schlüssel oder Gesundheitsdaten. Empfänger
werden erst im Worker aus dem gespeicherten Ereignis ermittelt.
QStash-Deduplizierung ist zeitlich begrenzt und ersetzt keine dauerhaften
Plan-/Versand-Schlüssel. Ein Publish-Timeout darf keinen neuen Plan erzeugen.
Doppelte veröffentlichte Nachrichten bleiben durch den Versand-Claim unschädlich.

Geplante Routen: `GET /api/push/reminders/cron` für Planung,
`POST /api/push/reminders/dispatch` für QStash. Der Dispatch verwendet den
offiziellen `Receiver` aus `@upstash/qstash` mit aktueller und nächster
Signaturprüfung und prüft den **unveränderten Rohbody und die fest konfigurierte
Ziel-URL** vor JSON-Verarbeitung oder Datenbankzugriff. Fehlende, abgelaufene,
manipulierte oder fremde Signaturen werden abgewiesen. Zusätzlich exaktes
Payload-Schema und Abgleich mit gespeichertem Datum/Kategorie/Ereignis,
Fälligkeit und Ablaufgrenze; eine gültige Signatur allein autorisiert keinen
beliebigen Versand. Siehe [QStash-Signaturprüfung](https://upstash.com/docs/qstash/howto/signature)
und [UTC-Verzögerung](https://upstash.com/docs/qstash/features/delay).

Empfänger per Keyset/Claim-Batches, kleine Parallelität und explizites
Zeitbudget unterhalb von `maxDuration`; keine unbegrenzte Empfängerschleife.
Bei Restarbeit vor Ablauf einen weiteren signierten QStash-Auftrag mit demselben
Dreifeld-Body einreihen. Fortschritt und Cursor ausschließlich in der Datenbank.
Bleibt Restarbeit nach Enqueue-Fehler, mit Fehlerstatus antworten, damit ein
Scheduler-Retry nur die übrigen Empfänger übernimmt. Gleich geplant bedeutet
gemeinsamer Auslösezeitpunkt, keine Garantie gleichzeitiger Geräteanzeige.
Nach Tagesende keine alten Nachrichten nachsenden.

Vorgesehene zusätzliche Variablen, **noch nicht implementiert oder gesetzt**:

| Variable | Zweck |
|---|---|
| `CRON_SECRET` | Täglichen Vercel-Cron authentifizieren |
| `QSTASH_TOKEN` | Serverseitiger Publish-Zugang |
| `QSTASH_CURRENT_SIGNING_KEY` | Eingehende Aufträge prüfen |
| `QSTASH_NEXT_SIGNING_KEY` | Signatur-Rotation |
| `REMINDER_DATABASE_URL` | Separater TLS-/Pooler-Zugang nur als Reminder-Worker |
| `REMINDER_ORIGIN` | Feste produktive HTTPS-Origin für Publish und Signatur-Zielbindung |

Alle sechs Variablen sind serverseitig. Keine Secrets in Logs, Browser oder
Scheduler-Bodies. Bestehende VAPID-Konfiguration bleibt bestehen; der öffentliche
VAPID-Schlüssel muss wie bisher zur Browserregistrierung verfügbar sein, der
private bleibt ausschließlich serverseitig. Keine Schlüssel neu erzeugen oder
bestehende VAPID-Namen umstellen. QStash-Konto, Quoten, veröffentlichbare
HTTPS-Zielroute und Produktions-Cron sind später manuell einzurichten. Keine
solche Konfiguration wurde hier durchgeführt.

## Vorgesehene Oberfläche nach Freigabe

Bestehenden Push-Onboarding-Schritt kompakt halten; Einwilligung separat und
standardmäßig aus. Kategorien in einem aufklappbaren Bereich, später jederzeit
unter Notifications in Settings änderbar. Gäste behalten den lokalen Ablauf.
Keine automatische OS-Abfrage, kein Reminder-Opt-in durch Browsererlaubnis oder
den Test-Push. Zustände unterscheiden: Push fehlt; Push aktiv/Reminder aus;
Reminder aktiv mit Kategorien; unbekannter Status; Scheduler-/Versandfehler.
Fehler bieten erneutes Laden/Speichern oder Wiederaufnahme noch nicht begonnener
Arbeit; unklare bereits begonnene Zustellungen werden nicht erneut gesendet.

Geplante feste englische Texte: „Ready to log your breakfast/lunch/snack/dinner
in HealthSync?“ und „Would you like to log supplements in HealthSync?“.
Keine Namen, Gesundheitsdaten, Vergessensbehauptungen oder Einnahmeempfehlungen.
Der bestehende Test-Payload und seine festen Texte bleiben separat erhalten.

## Prüfgrenze

Neue Tests in [`push-reminder-plan.test.mjs`](../tests/push-reminder-plan.test.mjs)
prüfen Fenster/Abstände über ein vollständiges Jahr, inklusive Grenzen und
Sommerzeitwechsel, begrenzte Kollisionen mit Ersatzplan, erfolgreiche Neuauswahl,
ungültige Eingaben und die Scheduler-Payload-Allowlist.

Lokaler Prüfstand dieses Vorbereitungsschritts:

| Prüfung | Ergebnis |
|---|---|
| `node --test tests/push-reminder-plan.test.mjs tests/push.test.mjs` | 16/16 bestanden, davon sieben neue Planer-Tests; bestehender Test-Push einschließlich 404/410 und Rate-Limit geprüft |
| `npm test` | 85/85 bestanden |
| `npx tsc --noEmit` | Bestanden |
| `npx eslint src/app/_lib/pushReminderPlan.ts tests/push-reminder-plan.test.mjs` | Bestanden |
| `npm run lint` | Fehlgeschlagen: 124 Fehler, 50 Warnungen außerhalb der neuen Dateien |
| `git diff --check` | Bestanden; zusätzlich Whitespace der neuen Dateien und lokale Links dieses Dokuments geprüft |

Build und Browser-/E2E-Prüfung wurden für den nicht angeschlossenen Planer ohne
UI-/Routenänderung nicht ausgeführt. Keine Live-Datenbankprüfung, externe
QStash-Aufrufe, Vercel-Konfiguration oder reale Geräte-/iOS-Zustellung.

Nach Freigabe zusätzlich erforderlich: echte atomare Plan-/Claim-Tests gegen
isoliertes PostgreSQL, konkurrierende Cron-/Webhook-Aufrufe, Einwilligungs- und
Supplement-Matrix, Account-/MFA-/RLS-Negativfälle, offizielle QStash-Signaturen
mit ungültigen Bodies/Ziel-URLs/Zeiten, Paginierung unter Zeitbudget,
Absturz-/Timeoutfälle und 404/410 gegen unveränderte/zwischenzeitlich erneuerte
Abos. Browserprüfung der Einstellungszustände und unveränderten Test-Pushes.
Keine dieser noch unimplementierten Garantien ist durch Planer-Tests belegt.
