# HealthSync

**HealthSync** ist eine mobile-first Progressive Web App (PWA) für persönliches Gesundheitstracking. Die App kombiniert Kalorienzählung (CalSync), Hydration-Tracking (DropSync) und Workout-Logging unter einer einheitlichen Oberfläche und ist unter `healthsync.itsmarian.dev` erreichbar.

Das Projekt entstand als eigenständige Weiterentwicklung aus zwei separaten Projekten - CalSync und DropSync - die zu einer gemeinsamen Plattform zusammengeführt wurden. HealthSync ist ein persönliches Projekt von Marian und wird aktiv weiterentwickelt.

---

## Ziele

- Tägliche Kalorien- und Makronährstoff-Erfassung so reibungslos wie möglich machen
- Hydration-Tracking mit minimalem Aufwand ermöglichen (Drink auswählen, Menge per Drag einstellen, fertig)
- Workout-Sessions mit Live-Timer und Set-Logging festhalten
- Alle Daten sowohl lokal (offline-fähig via localStorage) als auch in der Cloud (Supabase) speichern
- Eine native App-ähnliche Erfahrung im Browser liefern: keine Seitenreloads, Sheet-Modals, Haptic Feedback, PWA-Manifest

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Sprache | TypeScript (strict) |
| Styling | Vanilla CSS (eigene CSS-Variablen, kein Tailwind für App-Styles) |
| Backend / Auth | Supabase (PostgreSQL, Row Level Security, MFA/TOTP) |
| Schriften | DM Sans (Google Fonts) |
| Icons | Font Awesome v7 |
| Barcode-Scanner | ZXing (`@zxing/browser`) |
| QR-Code (Login) | QRCode.js (CDN) |
| Deployment | Vercel, Domain `healthsync.itsmarian.dev` |

---

## Design-Sprache

HealthSync hat ein konsequentes Dark-Mode-Design mit einem warmen Orange-Akzent. Die App soll sich auf dem Smartphone wie eine native App anfühlen.

**CSS-Variablen (Root):**
```css
--bg: #0F0F10           /* Hintergrund */
--surface: #1A1A1C      /* Karten-Hintergrund */
--surface2: #232326     /* Inputs, sekundäre Flächen */
--surface3: #2E2E32     /* Hover-Zustände */
--border: rgba(255,255,255,0.08)
--text: #F5F5F7
--text2: #8E8E93        /* Sekundärtext */
--text3: #48484A        /* Placeholder, deaktiviert */
--accent: #E4840F       /* Primäre Akzentfarbe (Orange) */
--accent2: #FF9F0A
--error: #FF453A
--success: #30D158
--radius: 18px
--radius-sm: 12px
--ease: cubic-bezier(0.34, 1.15, 0.64, 1)
```

Schrift: **DM Sans** durchgängig. Kein Inter, kein Roboto, kein System-Font-Stack.

---

## Projektstruktur (Next.js)

```
healthsync/
├── public/
│   └── healthsync-static/     ← Original Vanilla-Quelldateien (Referenz für Migration)
├── src/
│   └── app/
│       ├── layout.tsx          ← Root Layout: AuthProvider, CSS-Import, Metadata
│       ├── page.tsx            ← Haupt-App-Shell: View-Switching, alle Modals
│       ├── styles.css          ← Globales CSS (1:1 aus healthsync-static übernommen)
│       ├── login/
│       │   ├── layout.tsx      ← Login-Layout: QRCode CDN Script
│       │   ├── page.tsx        ← Vollständige Login-Seite als React Client Component
│       │   └── styles.css      ← Login-spezifische Styles
│       ├── _lib/
│       │   ├── supabase.ts     ← createBrowserClient Singleton (@supabase/ssr)
│       │   ├── types.ts        ← Alle TypeScript Interfaces
│       │   └── sync.ts         ← Alle Supabase CRUD Funktionen
│       ├── _context/
│       │   └── AuthContext.tsx ← Auth State, User, Settings, syncEnabled
│       ├── _hooks/
│       │   ├── useLocalStorage.ts
│       │   ├── useDashboardData.ts
│       │   └── useOnboarding.ts
│       └── _components/
│           ├── shared/         ← Toast, Tooltip, SplashScreen
│           ├── navigation/     ← BottomNav
│           ├── dashboard/      ← Dashboard + alle Unter-Komponenten inkl. WeatherWidget und ActivityStatus
│           ├── calsync/        ← CalSync + Modal + FoodList + BarcodeScanner
│           ├── dropsync/       ← DropSync + Modal + DrinkPicker + GlassInput + History
│           ├── settings/       ← SettingsModal + Goals + Account + Workout
│           ├── onboarding/     ← Onboarding Slides + TooltipTour
│           └── update/         ← Update Center für In-App-Updates und Changelog
```

---

## App-Aufbau: Die drei Hauptbereiche

Die App ist eine Single-Page-Application. Es gibt keine Next.js-Routes für die drei Bereiche - das View-Switching passiert über React State in `page.tsx`. Die Bottom-Navigation wechselt zwischen `'dashboard'`, `'calsync'` und `'dropsync'`.

### Dashboard

Die Startseite der App. Zeigt eine tagesaktuelle Gesamtübersicht.

**Komponenten und ihre Funktion:**

- **ScoreRing** - SVG-Ring-Diagramm mit einem Gesamtscore von 0–100. Der Score wird gewichtet berechnet: Kalorien (40%), Wasser (35%), Makros (25%). Falls keine Makroziele gesetzt sind, wird nur Kalorien (50%) + Wasser (50%) gewertet. `id="dashboardScoreRing"` auf dem `<circle>`, Radius 48, `strokeDasharray = 2 * Math.PI * 48`.

- **MetricGrid** - Zwei Progress Bars für Kalorien und Wasser. Zeigt Gesamtmenge, Zielwert und Restmenge ("X kcal left" / "X ml over"). IDs: `dashboardCalProgress`, `dashboardWaterProgress`, `dashboardCalories`, `dashboardWater`, `dashboardCalGoal`, `dashboardWaterGoal`, `dashboardCalLeft`, `dashboardWaterLeft`.

- **MacroGrid** - Drei Progress Bars für Protein, Kohlenhydrate, Fett. Nur aktiv wenn Makroziele in den Settings gesetzt wurden. Zeigt "X / Y g". IDs folgen dem Schema `dashboardProtein`, `dashboardProteinGoal`, `dashboardProteinProgress` etc.

- **WeekChart** - 7-Tage Balkendiagramm ohne externe Chart-Library. Flex-Container mit je einem `div.dashboard-week-day` pro Tag. Jeder Tag hat zwei Bars (`.dashboard-week-bar.calories`, `.dashboard-week-bar.water`) deren `height` als Prozentwert inline gesetzt wird. Der heutige Tag bekommt die Klasse `.today`.

- **RecentList** - Liste der letzten 5 Einträge des Tages (Food + Drinks kombiniert, nach Timestamp sortiert). Leerer Zustand zeigt "Nothing logged yet."

- **NextWidget** - Regelbasierter Tipp-Widget. Zeigt je nach Tagesstand eine Empfehlung: Hydration fokussieren wenn Wasser < 55%, Protein nachbessern wenn Protein < 55%, Kalorien wenn < 65%, oder "Goals complete" wenn beides ≥ 100%.

- **AiTips** - Widget mit `id="AiBox"`, `id="aiTipTitle"`, `id="aiTipText"`. Wird nur angezeigt wenn `calsync_ai_enabled === 'true'`. Sonst Skeleton-Loader. Aktualisiert sich alle 5 Minuten (`REFRESH_INTERVAL`) oder wenn sich Stats-Hash ändert (`totalCal|totalWater|totalProtein|entryCount|calGoal|waterGoal|proteinGoal`). Hört auf `viewChanged`-Event: startet bei Dashboard, stoppt bei anderem Tab. Hört auf `requestAITipUpdate` Custom Event. Nachrichten sind vollständig regelbasiert (kein API-Call) mit zeitabhängigen Varianten (Morgen/Mittag/Abend/Nacht). `window.refreshAITip` für externen Refresh.

- **WeatherWidget** - Wetter-Widget das aktuelle Wetter für den Standort des Benutzers anzeigt. Nutzt die Open-Meteo API über einen Proxy-Endpoint. Shows temperature, weather conditions, and location. Can be enabled/disabled in Settings and uses cached location data.

- **ActivityStatus** - Aktivitätsstatus-Widget das aktuellen Trainingszustand des Benutzers anzeigt (aktiv, krank, verletzt, oder pause). Ermöglicht es Benutzern, ihren aktuellen Zustand zu setzen und eine Dauer festzulegen (bis geändert, bis morgen, 7 Tage, 14 Tage, oder benutzerdefiniertes Datum). Der Status wird im Dashboard angezeigt und kann in den Einstellungen verwaltet werden.

**Datenquelle:** Ausschließlich localStorage. Kein Supabase-Aufruf im Dashboard. Reaktiviert sich bei `storage`-Events, `focus`-Events, `viewChanged`-Events und alle 30 Sekunden via `setInterval`.

**Streak-Berechnung:** Zählt rückwärts von heute wie viele aufeinanderfolgende Tage Einträge existieren. Ein Tag gilt als "vorhanden" wenn mindestens ein Food- oder Drink-Eintrag dieses Datums im localStorage liegt.

---

### CalSync (Food-Tracking)

CalSync ist der Food-Logging-Bereich. Der Tab-Name im Original war "CalSync", die Section-ID ist `calsync-view`.

**CalSyncModal** - Das Hauptmodal zum Hinzufügen von Einträgen. Öffnet sich als Bottom-Sheet. Hat drei Eingabemodi:

1. **Suche** - Freitextsuche in einer lokalen Lebensmitteldatenbank
2. **Barcode-Scanner** - ZXing-basierter Kamera-Scanner. Scannt EAN-Barcodes und sucht das Produkt in Open Food Facts oder einer eigenen Datenbank. Button-ID: `cs-openModalBtn`
3. **Manuell** - Formular mit Feldern für Name, Kalorien, Protein, Kohlenhydrate, Fett, Gewicht. IDs: `manualKcal`, `manualProtein`, `manualCarbs`, `manualFat` (diese werden für die Kalorienvorschau-Berechnung benötigt - `updateCaloriePreview()` wird bei `input`-Events aufgerufen).

**Eintrag-Datenstruktur:**
```typescript
interface FoodEntry {
  id: string           // UUID
  food: string         // Lebensmittelname
  kcal: number
  prot: number         // Protein in g
  carb: number         // Kohlenhydrate in g
  fat: number          // Fett in g
  weight?: number      // Gewicht in g
  emoji?: string       // z.B. "🍎"
  color?: string       // CSS Farbe für Icon
  ts: number           // Unix Timestamp (ms)
  date: string         // new Date().toDateString()
  source?: string      // 'manual' | 'barcode' | 'search'
}
```

**Speicherung:** localStorage Key `calsync_v1` (Array). Cloud-Sync in Supabase Tabelle `food_entries`.

**MacroRings** - SVG-Ringdiagramme für Protein, Carbs, Fett. Zeigen Tagesfortschritt relativ zu den Goals. Wenn kein Goal gesetzt, wird der Ring in Neutralfarbe angezeigt.

**FoodList** - Liste aller heutigen Einträge. Jeder Eintrag hat einen Swipe-to-Delete oder Tap-to-Delete Button. Beim Löschen wird der Eintrag aus localStorage entfernt und via `deleteFoodFromCloud()` aus Supabase gelöscht.

---

### DropSync (Hydration-Tracking)

DropSync ist der komplexeste Bereich der App. Die Section-ID ist `dropsync-view`.

**Ring-Anzeige** - SVG-Kreis mit `id="ringProgress"`. Radius 95. Circumference = `2 * Math.PI * 95`. `strokeDashoffset = circumference * (1 - totalToday / GOAL_DS)`. Daneben: `ringAmount` (Textanzeige der Gesamtmenge, wechselt Einheit bei ≥ 1000ml auf "x,x L"), `statPct` (Prozentanzeige), `statCount` (Anzahl Einträge), `statLast` (letzter Eintrag "x min ago").

**DropSyncModal** - Bottom-Sheet-Modal mit zwei Steps und eigenem Drag-System.

*Sheet-States:*
- `'closed'` - Modal unsichtbar
- `'open'` - Modal in natürlicher Höhe (auto), von unten eingeblendet
- `'expanded'` - Modal füllt fast den gesamten Screen (`window.innerHeight - 24px`)

Übergänge via CSS-Transition auf `height` und `transform translateY`. Während Drag: `transition: none`. Nach Loslassen: Transition wieder aktiv, snap zur nächsten Position.

*Step 1 - DrinkPicker:*
Grid mit Drink-Optionen. Jede Option ist ein `div.drink-option` mit `data-drink`, `data-emoji`, `data-color`. Nach Auswahl wird zu Step 2 gewechselt.

*Step 2 - GlassInput:*
Ein SVG-Glas (`ds-glassContainer`) dessen Füllstand per Drag gesteuert wird. Pointer nach oben = mehr Wasser, nach unten = weniger. Delta in Pixeln wird in ml umgerechnet: `deltaMl = (dy / 300) * 1000`. Snap-Points bei `[100, 150, 200, 250, 330, 400, 500, 750, 1000]` ml mit Threshold 28 ml. Bei Snap: `navigator.vibrate(18)` für haptisches Feedback.

Quick-Buttons (`.quick-btn`) mit `data-ml` für häufige Mengen.

*Eintrag-Datenstruktur:*
```typescript
interface DrinkEntry {
  id: string           // UUID
  drink: string        // Getränkename z.B. "Water"
  emoji?: string       // z.B. "💧"
  color?: string       // CSS Farbe
  amount: number       // ml
  ts: number           // Unix Timestamp (ms)
  date: string         // new Date().toDateString()
  source?: string      // 'dropsync'
}
```

**Speicherung:** localStorage Key `dropsync_v3`. Cloud-Sync in Supabase Tabelle `dropsync_entries`.

**HistoryModal** - Zweites Drag-Sheet. Zeigt alle Einträge nach Datum gruppiert (mit `formatDateLabel`: "Today", "Yesterday", oder ausgeschriebenes Datum). Gleiches Drag-System wie das Haupt-Modal. Button-ID: `ds-openHistoryBtn`.

**DrinkLog** - Tages-Log innerhalb des Modals (`ds-logList`). Neue Einträge werden oben eingefügt ohne das gesamte List neu zu rendern (Set `renderedIds` verhindert Doppel-Rendering). Beim Löschen: optimistisches UI-Update, danach Cloud-Delete.

---

## Settings-Modal

Erreichbar über Button `db-openSettingsBtn` auf dem Dashboard und `ds-openSettingsBtn` in DropSync. Öffnet als Bottom-Sheet (gleiches Drag-System wie DropSync).

**GoalsSection:**
- Kaloriengoal (localStorage: `calsync_goal`, Default: 2000)
- Wassergoal in ml (localStorage: `dropsync_goal`, Default: 2500)
- Makroziele: Protein, Carbs, Fett in g (localStorage: `calsync_goal_protein`, `calsync_goal_carbs`, `calsync_goal_fat`, Default: 0 = kein Goal)
- Bei Änderung: localStorage aktualisieren + `syncUserSettingsToCloud()` aufrufen (Push zu Supabase)
- **GoalModal**: separates Sheet-Modal (`id="goalModal"`) für Kaloriengoal-Eingabe, hat zwei Modi: "set" (direkte Eingabe) und "calc" (Kalorien-Rechner). Eigenes `createDraggableSheet` Setup.
- **Kalorien-Rechner**: Mifflin-St.-Jeor-Formel. Inputs: Gewicht, Größe, Alter, Geschlecht (Option-Buttons), Aktivitätslevel (Option-Buttons), Ziel (lose/maintain/gain). Ergebnis: TDEE in kcal + Makrovorschläge (30% Protein, 40% Carbs, 30% Fett). Separate Hydrations-Berechnung: `weight * 24.33` als Basis + Zuschläge für Geschlecht, Aktivität und Klima. Ergebnisse werden in `window.lastKcalResult`, `window.lastProteinResult` etc. gespeichert für "Apply"-Buttons.

**AccountSection:**
- Wenn eingeloggt: Avatar (Initial oder Profilbild), Name, "Synced"-Badge, Logout-Button, "Manage Account"-Link → `/login?keep_login_page=true`
- Wenn ausgeloggt: Login-Button → `/login?signinginto=healthsync`
- Avatar-Initial: erster Buchstabe von `full_name` oder `name` aus `user_metadata`, Fallback `email.split('@')[0]`
- `removeHeaderBtn(id)` / `addHeaderBtn(id)` - Hilfsfunktionen die Settings-Buttons in den View-Headern beim Öffnen/Schließen verstecken/anzeigen

**AI Detection Section:**
- Toggle `calsync_ai_enabled` (localStorage)
- Erfordert akzeptierte Nutzungsbedingungen (`calsync_ai_terms_accepted`) und einen Gemini API Key (`calsync_ai_api_key`)
- Prüft Cookie-Zustimmung: `cookieSettings.thirdparty === true` muss gesetzt sein
- `isAIReady()` gibt `true` zurück wenn alle vier Bedingungen erfüllt sind
- Nach Speichern des API Keys: `location.reload()` nach 2222ms

**WorkoutSection:**
- 4-Tage-Plan: Pull (Rücken/Bizeps), Push (Brust/Trizeps), Legs (Beine), Arms (Arme/Schultern)
- Pläne werden in localStorage unter `healthsync_workouts` gespeichert und via `workout_routines` (jsonb) in `user_settings` mit Cloud synchronisiert
- Aktive Session: Live-Timer (Sekunden), Set-Logging (Gewicht + Reps pro Satz), "Finish Session" speichert in `workout_sessions`
- Exercise-GIF-Modal: Tap auf Exercise-Card-Header öffnet ein Video-Modal mit dem Übungs-GIF
- Sort-Exercises-Modal: Drag-to-Reorder für Übungen innerhalb einer Routine

---

## Onboarding

Beim ersten Besuch (kein `calsync_onboarding_done` in localStorage) wird ein Overlay mit Slides angezeigt. Slides werden horizontal via `translateX` verschoben. Dot-Indikatoren zeigen den Fortschritt.

Nach Abschluss optional: **Tooltip-Tour** (8 Steps). Jeder Step zeigt einen Tooltip an einem Element (`id`-basiert) mit einer Erklärung. Tooltip positioniert sich relativ zum Element. Next-Button führt zum nächsten Step, letzter Step schließt die Tour.

`window.showOnboarding = startOnboarding` ermöglicht das Neustarten aus den Settings.

---

## Notes-Modal

Erreichbar über Button `openNotes` in der App. Öffnet als Bottom-Sheet über dem Settings-Modal (Settings bekommt dabei die Klasse `.small`). Gleiches Drag-Sheet-System wie Settings und DropSync. `notes.js` ist kein IIFE - Variablen sind global, kein `DOMContentLoaded` Guard. Beim Schließen wird `.small` nach 100ms von Settings entfernt.

---
## Update Center

Zeigt verfügbare App-Updates und changelog-Einträge an. Benutzer werden über neue Versionen informiert und können diese direkt in der App installieren. Nutzt die Supabase-Changelog-Datenbank um Versionshinweise und neue Features anzuzeigen. Enthält eine "Was ist neu?"-Modal die aktualisierte Versionsinformationen und Änderungen anzeigt.

---

## Wiederverwendbares Sheet-System (`createDraggableSheet`)

Settings, Notes-Modal und GoalModal teilen sich dasselbe generische Drag-Sheet-System. Es wird über `createDraggableSheet(config)` initialisiert (definiert in `script.js`):

```javascript
createDraggableSheet({
  handleZone: settingsHandleZone,
  modal: settingsModal,
  overlay: settingsOverlay,
  onClose: closeSettingsModal,
  getNaturalHeight: () => settingsNaturalHeight,
  setNaturalHeight: (h) => { settingsNaturalHeight = h }
})
```

In Next.js wird das ein `useDraggableSheet(config)` Hook der per Ref auf die Modal-Elemente zugreift.

---

## Pull-to-Refresh

In `menu.js` als IIFE `initPullToRefresh()`. Touch-basiert: bei `touchstart` am Top des Dokuments (`scrollY === 0`, kein Modal-Element im Pfad) wird ein PTR-Indikator (`id="ptr-indicator"`) eingeblendet. Bei ausreichend Pull (`THRESHOLD = 50px`, `MAX_HEIGHT = 60px`) und Loslassen wird `refreshAllData()` aufgerufen.

`refreshAllData()` ruft auf: localStorage neu laden, `refreshDropsyncUI()`, `updateUI()`, `updateDateLabel()`, `updateCalorieWeekWidget()`, `updateSecondaryStats()`, `updateMacroRingsAndLeft()`, `renderLog()`. In Next.js: `useCallback`-basiertes Refresh das alle relevanten States und Context-Funktionen neu triggert. Der PTR-Indikator wird als eigene `PullToRefresh.tsx` Komponente umgesetzt.

---

## Toast-System

Queue-basiertes Toast-System. Toasts erscheinen unten über der Navigation. Bei mehreren Toasts in kurzer Folge werden sie nacheinander angezeigt (Queue wird abgearbeitet). Jeder Toast ist für ~2 Sekunden sichtbar, dann Fade-out.

---

## Auth & Supabase

### Session-Handling

Der Supabase-Client wird mit `createBrowserClient` aus `@supabase/ssr` initialisiert. Sessions werden in **Cookies** gespeichert (nicht localStorage). Das ist wichtig: Der `createClient` aus `@supabase/supabase-js` würde localStorage verwenden und ist mit dem Next.js-Setup inkompatibel.

### AuthContext

Globaler React Context der folgendes bereitstellt:
```typescript
interface AuthContextType {
  user: User | null
  syncEnabled: boolean       // true wenn user !== null
  loading: boolean
  settings: UserSettings | null
  refreshSettings: () => Promise<void>
  logout: () => Promise<void>
}
```

Beim Mount: `supabase.auth.getSession()` → User setzen → `user_settings` aus Supabase laden → Goals in localStorage spiegeln.

`onAuthStateChange` Listener läuft durchgehend und reagiert auf Login/Logout.

### Sync-Strategie

**Food & Drinks:** Beim Pull wird Cloud mit Local zusammengeführt. Cloud-IDs als Set → lokale Einträge die nicht in der Cloud sind werden ergänzt → nach `ts` sortiert → in localStorage gespeichert.

Beim Push (neuer Eintrag): Sofort lokal speichern (optimistisch), dann `upsert` zu Supabase mit `onConflict: 'entry_id'`.

**Settings:** `upsert` mit `onConflict: 'user_id'`. Beim Pull: Werte in localStorage spiegeln und UI-Refresh-Funktionen aufrufen.

**Workouts:** Timestamp-basierte Merge-Strategie. `_updated_at` wird verglichen - neuerer Stand gewinnt.

### MFA (TOTP)

Die App unterstützt Zwei-Faktor-Authentifizierung via TOTP (Time-based One-Time Password). Flow:
1. Login mit Email + Password
2. `mfa.getAuthenticatorAssuranceLevel()` prüfen
3. Falls `nextLevel === 'aal2'` und nicht bereits verifiziert → MFA-Challenge starten
4. TOTP-Code verifizieren via `mfa.verify()`

"Remember this device" speichert die E-Mail in `mfa_trusted_emails` (localStorage) und überspringt den MFA-Step beim nächsten Login.

Setup/Disable über die Login-Seite nach erfolgreichem Login (viewSetup2FA).

---

## Supabase Datenbank-Schema

### `calsync_entries`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid PK | Automatisch generiert |
| user_id | uuid | Supabase Auth User ID |
| entry_id | text UNIQUE | Vom Client generierte UUID |
| food | text | Lebensmittelname |
| brand | text | Marke (sofern über Open Food Facts angegeben) |
| kcal | numeric | Kalorien |
| amount | number | Das Gewicht (roh) |
| unit | text | Einheit für "amount" |
| prot | numeric | Protein in g |
| carb | numeric | Kohlenhydrate in g |
| fat | numeric | Fett in g |
| barcide | text | sofern barcode über OFF |
| ts | bigint | Unix Timestamp in ms |
| date | text | `new Date().toDateString()` Format |
| created_at | timestampz | Zeitstempel wann das Essen hinzugefügt wurde |
| is_drink | sofern Getränk (damit Getränk in DropSync angezeigt wird) |

RLS: User kann nur eigene Einträge lesen/schreiben (`user_id = auth.uid()`).

### `dropsync_entries`
| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid PK | Automatisch generiert |
| user_id | uuid | Supabase Auth User ID |
| entry_id | text UNIQUE | Vom Client generierte UUID |
| drink | text | Getränkename |
| emoji | text | Emoji-Symbol (optional) |
| color | text | CSS-Farbe (optional) |
| amount | integer | Menge in ml |
| ts | bigint | Unix Timestamp in ms |
| date | text | `new Date().toDateString()` Format |
| created_at | timestamptz | Roh Datum |
| source | text | 'dropsync' |

### `user_settings`
| Spalte | Typ | Beschreibung |
|---|---|---|
| user_id | uuid PK | Supabase Auth User ID |
| goal_ml | integer | Wassergoal in ml (Default: 2500) |
| updated_at | timestamptz | Letztes Update (für Workout-Sync) |
| calorie_goal | integer | Tägliches Kaloriengoal (Default: 2000) |
| protein_goal | integer | Proteingoal in g (Default: 0 = kein Goal) |
| carbs_goal | integer | Kohlenhydratgoal in g |
| fat_goal | integer | Fettgoal in g |
| workout_routines | jsonb | Workout-Pläne als JSON |

---

## localStorage-Schlüssel (vollständige Referenz)

| Key | Inhalt | Typ |
|---|---|---|
| `calsync_v1` | Array aller Food-Einträge | `FoodEntry[]` JSON |
| `dropsync_v3` | Array aller Drink-Einträge | `DrinkEntry[]` JSON |
| `calsync_goal` | Tägliches Kaloriengoal | Number als String |
| `calsync_goal_protein` | Proteingoal in g | Number als String |
| `calsync_goal_carbs` | Kohlenhydratgoal in g | Number als String |
| `calsync_goal_fat` | Fettgoal in g | Number als String |
| `dropsync_goal` | Wassergoal in ml | Number als String |
| `calsync_goal_ml` | Alias für Wassergoal (wird von `auth.js` pullWaterGoal genutzt, identisch mit `dropsync_goal`) | Number als String |
| `healthsync_workouts` | Workout-Pläne + `_updated_at` | JSON |
| `calsync_onboarding_done` | Onboarding bereits gesehen | `'1'` |
| `mfa_trusted_emails` | Vertrauenswürdige E-Mails für MFA-Skip | `string[]` JSON |
| `calsync_ai_enabled` | AI-Tips aktiviert | `'true'` / `'false'` |
| `calsync_ai_api_key` | Gemini API Key | String |
| `calsync_ai_terms_accepted` | AI-Nutzungsbedingungen akzeptiert | `'true'` |
| `calsync_theme` | Aktives Theme | Theme-String |
| `dropsync_theme` | Aktives Theme (Mirror) | Theme-String |
| `calsync_first_name` | Vorname für personalisierten Header-Greeting | String |
| `cookieSettings` | Cookie-Zustimmungseinstellungen (JSON mit `thirdparty` Boolean) | JSON |

---

## Login-Seite (`/login`)

Die Login-Seite ist eine eigenständige Route innerhalb des Next.js-Projekts. Sie wird auch für Account-Management genutzt (via `?keep_login_page=true`).

**Views (als React State):**
- `'login'` - Email + Password, Forgot Password Link
- `'register'` - Name, Email, Password (mit Stärke-Indicator), Confirm Password
- `'mfa'` - 6-stelliger OTP-Input, "Remember this device" Checkbox
- `'setup2fa'` - QR-Code (QRCode.js), Secret Key, OTP-Verifikation, optional Disable
- `'reset'` - Email-Eingabe für Reset-Link
- `'resetMfa'` - MFA-Verifikation vor Password-Reset
- `'confirm'` - Bestätigungshinweis nach Register
- `'loggedIn'` - Erfolgsansicht mit Redirect-Timer und optionalem 2FA-Setup

**Password-Stärke:** 3 Bars (`#bar1`, `#bar2`, `#bar3`). Klassen: `weak` (1 Bar), `medium` (2 Bars), `strong` (3 Bars). Regeln: min. 8 Zeichen, min. 1 Großbuchstabe, min. 1 Zahl.

**OTP-Input:** 6 einzelne `<input type="number">` Felder. Auto-Advance, Backspace-Rücksprung, Paste-Support.

**Nach Login:** Redirect zu `/?reload=true`. Der `reload`-Parameter triggert nach ~2.2 Sekunden ein `window.location.replace` ohne den Parameter, damit die App frisch initialisiert.

---

## Besonderheiten und Stolperstellen

### `date`-Format
Einträge verwenden `new Date().toDateString()` als `date`-Feld (z.B. `"Mon Jun 09 2025"`). Kein ISO-Format. Alle Datum-Vergleiche im Dashboard und DropSync laufen über dieses Format. Nicht ändern.

### `ts`-Feld
Unix-Timestamp in Millisekunden (`Date.now()`), als `bigint` in Supabase gespeichert. Wird für Sortierung und "X ago"-Anzeigen verwendet.

### `entry_id` vs `id`
In Supabase haben Einträge eine auto-generierte `id` (UUID). Die vom Client generierte ID wird in `entry_id` gespeichert. Im localStorage ist die Client-UUID der primäre Schlüssel (`entry.id`). Bei Sync-Operationen wird immer auf `entry_id` gejoined, nicht auf `id`.

### `updateCaloriePreview`
Diese Funktion wird in `onboarding.js` im DOMContentLoaded-Listener auf den manuellen Eingabefeldern registriert. Sie ist in `script.js` (CalSync) definiert. In der Next.js-Version muss sie aus CalSync exportiert und in der Onboarding-Komponente per Ref oder Context verfügbar gemacht werden.

### Doppelter `updateUI`
In `dropsync-integration.js` existiert eine lokale `updateUI`-Funktion. In `dashboard.js` existiert ebenfalls eine `updateUI`-Funktion. Diese sind komplett unabhängig voneinander und dürfen in React nicht auf denselben Namen verweisen.

### `window.reload`-Trick nach Login
Nach erfolgreichem Login wird zu `/?reload=true` weitergeleitet. `page.tsx` prüft diesen Parameter beim Mount und führt nach einem kurzen Delay (2200ms aus `auth.js`) `window.location.replace('/')` aus - das sorgt dafür dass Auth-State und localStorage sauber initialisiert werden ohne den Parameter in der URL zu behalten.

### `removeHeaderBtn` / `addHeaderBtn`
`settings.js` blendet beim Öffnen des Settings-Modals die Settings-Buttons in den View-Headern aus. In React: `settingsOpen` Boolean State der den Buttons conditional `display: none` gibt.

### `syncUserSettingsToCloud`
In `settings.js` definiert (nicht in `auth.js`). Wird nach jeder Goal-Änderung aufgerufen. Ruft intern `pushUserSettings` auf. In Next.js: `pushSettings` aus `sync.ts` direkt aus den Settings-Komponenten.

### `checkAndNotifyMissingMacros`
Wird in `initAuth` nach Auth-Erfolg und nach Login-Wechsel aufgerufen. Prüft ob Makroziele fehlen und zeigt ggf. einen Toast. In Next.js im `AuthContext` nach `fetchSettings` aufrufen.

### Doppelter `updateUI`
`ai-tips.js` hat eine interne `updateUI(title, text)`. `script.js` hat eine globale `updateUI()`. `dropsync-integration.js` ebenfalls eine eigene. In React kein Problem - alle leben in getrennten Komponenten.

### `escapeHTML`
In `menu.js` als `window.escapeHTML` für Workout-Routine-Namen in innerHTML. In React irrelevant (JSX escaped automatisch).

### `window.entries`
In `menu.js` wird bei Pull-to-Refresh `window.entries = JSON.parse(localStorage.getItem('calsync_v1') || '[]')` gesetzt. Globaler Cache den `script.js` als Datenquelle nutzt. In React: ein State im CalSync-Kontext.

### `calsync_goal_ml` vs `dropsync_goal`
`auth.js` nutzt `calsync_goal_ml` in `pullWaterGoal` und `ensureUserSettings`. `settings.js` nutzt `dropsync_goal`. Beide zeigen auf denselben Wert. In Next.js einheitlich auf `dropsync_goal` normalisieren und `calsync_goal_ml` als Alias beim Pull spiegeln.

