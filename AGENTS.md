# HealthSync Migration Prompt - Vanilla HTML/CSS/JS → Next.js 15 (App Router)

---

## Deine Aufgabe

Du migrierst **HealthSync** - eine bestehende, vollständig funktionsfähige Health-Tracking-Web-App - von einer klassischen Vanilla HTML/CSS/JS-Architektur in ein sauberes **Next.js 15 Projekt mit App Router und TypeScript**. Die Migration ist eine 1:1-Übertragung: keine neuen Features, kein neues Design, keine Umbenennungen. Was sich ändert ist ausschließlich die technische Grundlage.

Arbeite **systematisch und in Phasen**. Plane zuerst, erstelle dann die Ordnerstruktur, dann konvertiere Datei für Datei. Fange nie mit Code an bevor die Planung abgeschlossen ist.

> **Pflichtlektüre vor dem Start:** Im selben Verzeichnis liegt eine `README.md`. Lies sie vollständig bevor du mit irgendeiner Phase beginnst. Sie beschreibt das Projekt, seine Ziele, den genauen Funktionsumfang, alle technischen Entscheidungen und die Datenbankstruktur im Detail. Diese Prompt gibt dir die Migrationsregeln - die README gibt dir das vollständige Projektverständnis. Beide zusammen sind deine einzige Quelle der Wahrheit.

---

## Was ist HealthSync?

HealthSync ist eine mobile-first Single-Page-App (PWA) für persönliches Gesundheitstracking. Die App hat drei Hauptbereiche, die über eine fixierte Bottom-Navigation gewechselt werden:

### 1. Dashboard (Startseite)
Zeigt eine tagesaktuelle Übersicht aller Metriken:
- Gesamtkalorien und Wasseraufnahme mit Progress Bars
- Sofern das KI Feature aktiviert ist, KI Tipps über den Makronährstoffen
- Makronährstoffe (Protein, Kohlenhydrate, Fett) mit eigenen Progress Bars
- Einen Score-Ring (SVG-basiert, berechnet aus cal%, water%, macro%)
- Ein 7-Tage-Balkendiagramm (manuell in DOM gerendert, kein Chart-Framework)
- Eine "Recent Activity"-Liste der letzten Einträge (Food + Drinks kombiniert)
- Einen "Next Step"-Widget (regelbasierte Tipps je nach Tagesstand)
- Streak-Zähler, Entry Count, Last Entry Ago

Die Dashboard-Berechnungen lesen ausschließlich aus **localStorage** (`calsync_v1` für Food, `dropsync_v3` für Drinks) und aus Goal-Keys (`calsync_goal`, `dropsync_goal`, `calsync_goal_protein` etc.). Es werden keine direkten Supabase-Calls aus dem Dashboard gemacht.

### 2. CalSync (Food-Tracking Tab)
Logging von Mahlzeiten und Nahrungsmitteln:
- Modal mit Barcode-Scanner (ZXing), Freitext-Suche und manuellem Eintrag, zwischen jedem Schritt innerhalb des Modals, saubere Übergänge und wechsel der Modal Höhe
- Pro Eintrag: Name, Kalorien, Protein, Kohlenhydrate, Fett, Gewicht in Gramm, Emoji, Farbe, Timestamp
- Einträge werden in `localStorage` unter `calsync_v1` gespeichert
- Cloud-Sync über Supabase Tabelle `calsync_entries`
- Makro-Ringdiagramme (SVG), Tagesfortschritt
- Einträge können gelöscht werden (lokal + Cloud)

### 3. DropSync (Hydration-Tracking Tab)
Logging von Getränken:
- Bottom-Sheet-Modal mit zwei Steps: Schritt 1 = Getränk auswählen (Drink-Picker mit Optionen), Schritt 2 = Menge festlegen, zwischen jedem Schritt innerhalb des Modals, saubere Übergänge und wechsel der Modal Höhe
- Menge wird über einen **draggbaren Glascontainer** (SVG-basiert) eingestellt - Finger nach oben = mehr, nach unten = weniger. Es gibt Snap-Points bei definierten ml-Werten (100, 150, 200, 250, 330, 400, 500, 750, 1000 ml)
- Das Modal selbst ist ein **Drag-Sheet**: kann von "open" zu "expanded" (Vollbild) gezogen werden und per Swipe geschlossen werden
- Quick-Buttons für häufige Mengen
- Ein History-Modal (ebenfalls als Drag-Sheet) zeigt alle Einträge nach Datum gruppiert
- Ring-Progress-Indicator (SVG, `ringProgress` stroke-dashoffset) zeigt Tagesfortschritt
- Einträge in `localStorage` unter `dropsync_v3`, Cloud-Sync über `dropsync_entries`

### Weitere Features
- **Onboarding-Overlay** mit Slides und Tooltip-Tour (wird einmalig gezeigt, `localStorage` Flag)
- **Settings-Modal** (Sheet): Kaloriengoal, Wasser-Goal, Makro-Goals, Account-Bereich, Theme, Datenschutz
- **Navigation-Slider**: Bottom-Nav mit 3 Tabs, animierter Slider-Indikator
- **Toast-Notifications**: Queue-basiert, erscheinen unten
- **AI-Tips-Widget**: regelbasierte Motivationstexte (kein API-Call), erscheint auf dem Dashboard
- **AI-Detection**: erkennt Lebensmittel aus Textbeschreibungen (Gemini API oder regelbasiert)
- **Workout-Modul** (in Settings erreichbar): 4-Tage-Plan (Pull/Push/Legs/Arms), aktive Session mit Live-Timer, Set-Logging
- **Splash Screen**: wird beim Laden kurz angezeigt, dann versteckt

---

## Technischer Aufbau des Originals

### Dateistruktur (Vanilla)
Die zu migrierenden Quelldateien liegen im selben Verzeichnis unter `public/healthsync-static/`. Lies alle Dateien aus diesem Ordner und migriere sie vollständig in die neue Next.js-Struktur.

```
public/healthsync-static/
├── index.html          ← ~1987 Zeilen, enthält das gesamte HTML der App
├── styles.css          ← Alle Styles (CSS-Variablen, Komponenten, Animationen)
├── auth.js             ← Supabase-Init, currentUser global, alle Sync-Funktionen
├── dashboard.js        ← Dashboard-Berechnungen und DOM-Rendering
├── dropsync-integration.js  ← Komplett DropSync (IIFE, ~1076 Zeilen)
├── settings.js         ← Settings-Modal Logik
├── navigation.js       ← Bottom-Nav und View-Switching
├── onboarding.js       ← Onboarding-Slides und Tooltip-Tour
├── tooltip.js          ← Tooltip-System (showToolTip, closeToolTip global)
├── ai-tips.js          ← Regelbasierte AI-Tips
├── ai-detection.js     ← Lebensmittelerkennung
├── notes.js            ← Notizen-Feature
├── menu.js             ← Extra-Menu (Quick-Add Button)
└── script.js           ← CalSync Hauptlogik
```

### Globale Variablen (wichtig für die Migration)
Die JS-Dateien kommunizieren über globale Variablen und `window.*`:
- `window.currentUser` - eingeloggter Supabase User
- `window.syncEnabled` - Boolean, ob Cloud-Sync aktiv
- `window.showToast(msg)` - Toast anzeigen
- `window.refreshDropsyncUI()` - DropSync neu rendern
- `window.dropsyncSetGoal(ml)` - DropSync Goal setzen
- `window.pushMacroGoals()` - Makroziele zu Supabase pushen
- `window.openSettingsModal()` - Settings öffnen
- `window.showOnboarding()` - Onboarding starten
- `window.closeToolTip()` / `window.showToolTip(...)` - Tooltip-System

In Next.js werden diese durch **React Context, Props und exportierte Funktionen** ersetzt.

Zusätzliche globale Funktionen die ersetzt werden müssen:
- `window.refreshAITip` → `refreshAITip` aus AiTips-Kontext oder Callback-Prop
- `window.escapeHTML` → nicht nötig in JSX
- `window.entries` → CalSync-State
- `window.lastKcalResult` / `window.lastProteinResult` etc. → lokaler State im GoalModal
- `window.checkAndNotifyMissingMacros` → im AuthContext nach Settings-Pull
- `window.isAIReady` → aus Settings-Context oder direkt aus localStorage lesen
- `window.loadRoutinesFromStorage` / `window.currentRoutines` → Workout-State im WorkoutContext

### Supabase-Datenbank (Tabellen - unverändert übernehmen)
```
calsync_entries:
  id, user_id, entry_id (unique), food, kcal, prot, carb, fat,
  weight, emoji, color, ts (bigint), date (text), source

dropsync_entries:
  id, user_id, entry_id (unique), drink, emoji, color,
  amount (int), ts (bigint), date (text), source

user_settings:
  user_id (PK), calorie_goal, protein_goal, carbs_goal, fat_goal,
  goal_ml, workout_routines (jsonb), updated_at

workout_sessions:
  id (bigserial PK), user_id (uuid, FK → auth.users, ON DELETE CASCADE),
  session_id (text, UNIQUE), routine_id (text), routine_name (text),
  start_time (timestamptz), end_time (timestamptz nullable),
  duration_seconds (integer, default 0), exercises (jsonb, default []),
  created_at (timestamptz, default now())

Indexes:
  workout_sessions_user_id_idx ON workout_sessions(user_id)

RLS policies (enabled):
  "Users can read own sessions"   → SELECT where auth.uid() = user_id
  "Users can insert own sessions" → INSERT with check auth.uid() = user_id
  "Users can delete own sessions" → DELETE where auth.uid() = user_id
```

**Spalten- und Tabellennamen bleiben 1:1 gleich. Kein Schema-Change.**

---

## CSS-Strategie

**Die `styles.css` wird unverändert übernommen.** Du erstellst keine neue CSS-Datei und schreibst kein Tailwind für bestehende Komponenten.

Alle **CSS-Klassen und Element-IDs bleiben identisch** wie im Original. Wenn im Original ein Element `id="ringProgress"` hat, bleibt es `id="ringProgress"`. Wenn eine Klasse `dashboard-week-bar calories` heißt, bleibt sie so. Kein Umbenennen, kein Refactoring von Klassen.

Die `styles.css` wird in `src/app/styles.css` abgelegt und in `src/app/layout.tsx` importiert:
```tsx
import './styles.css'
```

Einzige Ausnahme: JSX-Attribute. `class` wird zu `className`, `for` zu `htmlFor`. Das sind Pflicht-Änderungen durch JSX, keine inhaltlichen Änderungen.

---

## Login-System

### Das Problem
Die bestehende Login-Seite (`/login`) ist eine eigene Vanilla HTML-Seite die nach erfolgreichem Login zu `/healthsync/?reload=true` weiterleitet. Das Problem: Die alte Login-Seite verwendet `@supabase/supabase-js` direkt mit `createClient`, das die Session in **localStorage** speichert. Das neue Next.js-Projekt verwendet `@supabase/ssr` mit `createBrowserClient`, das Sessions in **Cookies** erwartet. Diese sind inkompatibel - nach dem Login wäre man in Next.js trotzdem "nicht eingeloggt".

### Die Lösung
Du erstellst eine eigene `/login` Route innerhalb des Next.js-Projekts (`src/app/login/page.tsx`). Diese Login-Seite übernimmt das exakte UI der bestehenden Login-Seite (gleiche Klassen, gleiche Struktur, gleiche Styles) aber implementiert Auth über `@supabase/ssr`. Die bestehende Login-Seite für andere Projekte (calsync, dropsync) bleibt unverändert - du migrierst **nur den HealthSync-spezifischen Teil**.
Das zu migrierende Projekt findest du unter `public/login-static`.

Der Supabase-Client im Login und in der gesamten App verwendet:
```typescript
import { createBrowserClient } from '@supabase/ssr'
```

Kein `createClient` aus `@supabase/supabase-js` für Auth - nur für den Browser-Client über SSR.

### Login-Funktionalität (vollständig übernehmen)
- Sign In mit Email + Password
- Register mit Name, Email, Password, Confirm Password
- Password-Stärke-Indicator (3 Bars: weak/medium/strong)
- MFA-Verify (TOTP, 6-stelliger OTP-Input mit Auto-Focus)
- MFA Setup (QR-Code via QRCode.js CDN, Secret Key kopierbar)
- MFA Disable (mit Code-Verifikation)
- Forgot Password / Reset via Email
- Reset mit MFA-Verifikation falls 2FA aktiv
- Change Password Modal (mit 2FA-Verifikation Schritt 1, dann neues PW Schritt 2)
- "Remember this device" Checkbox (localStorage-basiert)
- Logged-In-View mit Redirect nach App (`/` statt `/healthsync`)
- `signinginto=healthsync` URL-Parameter wird ausgewertet für den Redirect-Ziel

---

## Ziel-Ordnerstruktur

Die App deployed auf `healthsync.itsmarian.dev` — das ist die Root-URL des Projekts. Es gibt keinen `/healthsync` Unterpfad. `src/app/page.tsx` ist die Hauptseite, kein Redirect.

```
app/
├── layout.tsx                    ← Root Layout (AuthProvider + CSS Import)
├── page.tsx                      ← Haupt-App-Shell (Navigation, Modals, Views)
├── styles.css                    ← 1:1 Original styles.css
├── login/
│   ├── page.tsx                  ← Login Page (vollständig als React)
│   └── styles.css                ← Login-spezifische Styles (aus original /login/styles.css)
├── _lib/
│   ├── supabase.ts               ← createBrowserClient Singleton
│   ├── types.ts                  ← Alle TypeScript Interfaces
│   └── sync.ts                   ← Alle Supabase CRUD Funktionen
├── _context/
│   └── AuthContext.tsx           ← useAuth Hook, User State, Settings
├── _hooks/
│   ├── useLocalStorage.ts        ← Generic localStorage Hook
│   ├── useDashboardData.ts       ← Dashboard Berechnungslogik
│   ├── useOnboarding.ts          ← Onboarding State
│   └── useDraggableSheet.ts      ← Wiederverwendbare Sheet-Drag-Logik (Settings, Notes, GoalModal)
└── _components/
    ├── shared/
    │   ├── Toast.tsx             ← Toast Queue System
    │   ├── Tooltip.tsx           ← Tooltip Overlay
    │   ├── SplashScreen.tsx      ← Splash Screen
    │   └── PullToRefresh.tsx     ← PTR-Indikator + Touch-Logik
    ├── navigation/
    │   └── BottomNav.tsx         ← Bottom Navigation + Slider Indicator
    ├── dashboard/
    │   ├── Dashboard.tsx         ← Dashboard View Container
    │   ├── ScoreRing.tsx         ← SVG Score Ring
    │   ├── MetricGrid.tsx        ← Kalorien + Wasser Progress Bars
    │   ├── MacroGrid.tsx         ← Protein/Carbs/Fat Progress Bars
    │   ├── WeekChart.tsx         ← 7-Tage Balkendiagramm
    │   ├── RecentList.tsx        ← Recent Activity Liste
    │   ├── NextWidget.tsx        ← Regelbasierter Tipp
    │   └── AiTips.tsx            ← AI Tips Widget
    ├── calsync/
    │   ├── CalSync.tsx           ← CalSync View Container
    │   ├── CalSyncModal.tsx      ← Food-Logging Modal
    │   ├── FoodList.tsx          ← Tages-Eintrags-Liste
    │   ├── MacroRings.tsx        ← Makro-Ringdiagramme (SVG)
    │   ├── BarcodeScanner.tsx    ← ZXing Integration
    │   └── ManualEntry.tsx       ← Manuelles Eintragen
    ├── dropsync/
    │   ├── DropSync.tsx          ← DropSync View Container + Ring
    │   ├── DropSyncModal.tsx     ← Sheet-Modal Wrapper + Drag Logic
    │   ├── DrinkPicker.tsx       ← Schritt 1: Drink Options Grid
    │   ├── GlassInput.tsx        ← Schritt 2: SVG Glas + Drag Menge
    │   ├── DrinkLog.tsx          ← Tages-Log-Liste
    │   └── HistoryModal.tsx      ← History Drag-Sheet
    ├── settings/
    │   ├── SettingsModal.tsx     ← Settings Sheet Wrapper
    │   ├── GoalsSection.tsx      ← Kalorie + Wasser + Makro Goals + GoalModal + Rechner
    │   ├── AccountSection.tsx    ← Auth UI (Avatar, Login/Logout)
    │   ├── AiSection.tsx         ← AI Toggle, Terms, API Key
    │   └── WorkoutSection.tsx    ← Workout-Pläne und Session
    ├── notes/
    │   └── NotesModal.tsx        ← Notes Drag-Sheet
    └── onboarding/
        ├── Onboarding.tsx        ← Slides Overlay
        └── TooltipTour.tsx       ← Step-by-Step Tooltip Tour
```

---

## Migrations-Phasen (in dieser Reihenfolge abarbeiten)

### Phase 0 - Projekt-Setup
1. `npx create-next-app@latest healthsync --typescript --app --tailwind --eslint  --import-alias "@/*"`
2. `npm install @supabase/supabase-js @supabase/ssr`
3. `.env.local` mit `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ordnerstruktur wie oben anlegen
5. `styles.css` in `app/styles.css` kopieren
6. `tsconfig.json` prüfen: `strict: true`, `paths: { "@/*": ["./*"] }`

### Phase 1 - Fundament
Reihenfolge: `types.ts` → `supabase.ts` → `sync.ts` → `AuthContext.tsx`

Diese vier Dateien müssen fertig sein bevor eine einzige Komponente geschrieben wird. Alle anderen Dateien importieren von hier.

### Phase 2 - Login
`src/app/login/page.tsx` - vollständige Login-Seite als React Client Component. Alle Views als State (`'login' | 'register' | 'mfa' | 'setup2fa' | 'reset' | 'resetMfa' | 'confirm' | 'loggedIn'`). OTP-Inputs als separate Komponente. QRCode über CDN-Script (in login/layout.tsx laden).

### Phase 3 - App Shell
`src/app/layout.tsx` mit AuthProvider und CSS-Import. `src/app/page.tsx` mit View-Switching Logic (Dashboard / CalSync / DropSync als State, nicht als Routes). BottomNav, Toast, SplashScreen.

### Phase 4 - Dashboard
Alle Dashboard-Unterkomponenten. `useDashboardData.ts` enthält alle Berechnungen aus `dashboard.js` (sum, clamp01, calculateStreak, getWeekData etc.) als reiner Hook ohne DOM-Zugriff.

### Phase 5 - DropSync
Beginne mit `DropSync.tsx` (Ring + Stats), dann `DrinkLog.tsx`, dann `DrinkPicker.tsx`, dann `GlassInput.tsx` (Drag-Logik mit useRef und Pointer Events), dann `DropSyncModal.tsx` (Sheet-Drag), dann `HistoryModal.tsx`.

### Phase 6 - CalSync
`CalSync.tsx` → `FoodList.tsx` → `MacroRings.tsx` → `ManualEntry.tsx` → `BarcodeScanner.tsx` → `CalSyncModal.tsx`

### Phase 7 - Settings + Onboarding + Notes
Settings-Modal als Sheet (`useDraggableSheet`). GoalModal + Kalorien-Rechner. AI-Section. Onboarding-Slides. Tooltip-Tour. Notes-Modal (öffnet über Settings, gleiches Sheet-System). PullToRefresh-Komponente.

---

## Technische Regeln

### State-Management
- Kein Redux, kein Zustand, kein externes State-Framework
- Auth-State über `AuthContext` (user, syncEnabled, settings, refreshSettings, logout)
- Lokaler Component-State über `useState` und `useReducer`
- Persistenz über localStorage (gleiche Keys wie Original: `calsync_v1`, `dropsync_v3`, `calsync_goal` etc.)
- Cloud-Sync über Funktionen in `sync.ts`, aufgerufen aus Komponenten

### Supabase-Initialisierung
```typescript
// src/app/_lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Dieser Client wird als Singleton exportiert und in allen Client Components importiert. Kein `createClient` aus `@supabase/supabase-js`.

### Client vs. Server Components
Alle Komponenten die DOM, localStorage, Event-Listener oder Supabase-Client verwenden sind `'use client'` Components. Das sind in dieser App fast alle. Server Components werden nur für statische Teile wie Metadata oder Root-Layout verwendet.

### DOM-Manipulation ersetzen
Überall wo das Original `document.getElementById('x').textContent = '...'` oder `.style.width = '...'` macht, wird in React State und JSX-Bindings übersetzt:
```tsx
// Original:
document.getElementById('dashboardScore').textContent = score

// React:
const [score, setScore] = useState(0)
<span id="dashboardScore">{score}</span>
```
Die `id` bleibt erhalten (für CSS-Selektoren im bestehenden CSS).

### Event-Listener
`window.addEventListener('storage', ...)` und `window.addEventListener('focus', ...)` aus `dashboard.js` werden als `useEffect` mit Cleanup implementiert.

### Pointer Events (Drag)
Die Drag-Logik in DropSync (Glass-Drag und Sheet-Drag) verwendet `onPointerDown`, `onPointerMove`, `onPointerUp` in JSX statt `addEventListener`. `setPointerCapture` wird über `ref.current.setPointerCapture(e.pointerId)` aufgerufen.

### Globale Funktionen ersetzen
Alle `window.showToast`, `window.refreshDropsyncUI` etc. werden durch Context-Methoden oder Callback-Props ersetzt. Kein `window.*` Patching in Next.js.

### localStorage Keys (unverändert)
```
calsync_v1          ← Food-Einträge Array
dropsync_v3         ← Drink-Einträge Array
calsync_goal        ← Kaloriengoal (number string)
calsync_goal_protein
calsync_goal_carbs
calsync_goal_fat
dropsync_goal       ← Wasserziel in ml
calsync_goal_ml     ← (alias für dropsync_goal in settings)
healthsync_workouts ← Workout-Pläne JSON
calsync_onboarding_done ← Onboarding-Flag
mfa_trusted_emails  ← Array vertrauenswürdiger E-Mails
```

---

## Wichtige Detail-Hinweise

### SVG Ring (DropSync)
Der Ring in DropSync wird über `strokeDashoffset` gesteuert. `id="ringProgress"` auf dem `<circle>` Element muss erhalten bleiben. Der Wert wird berechnet als `2 * Math.PI * 95 * (1 - percent)`.

### Score Ring (Dashboard)
`id="dashboardScoreRing"` auf dem SVG `<circle>`. Radius 48, Circumference = `2 * Math.PI * 48`.

### Week Chart (Dashboard)
Kein Chart-Framework. Das Chart wird als Flex-Container mit `div.dashboard-week-day` Elements aufgebaut. Jeder Tag hat zwei Bars (`dashboard-week-bar calories` und `dashboard-week-bar water`) deren `height` in % über inline Style gesetzt wird.

### DropSync Snap-Points
```typescript
const SNAP_POINTS = [100, 150, 200, 250, 330, 400, 500, 750, 1000]
const SNAP_THRESH = 28
```
Beim Drag wird zur nächsten Snap-Position gesprungen wenn der Abstand ≤ 28 ml ist. Ein haptisches Feedback (`navigator.vibrate(18)`) wird beim Snap ausgelöst.

### Sheet-Drag States
Das DropSync-Modal und das History-Modal haben drei Zustände: `'closed'`, `'open'` (natürliche Höhe), `'expanded'` (Vollbild minus 24px top margin). Der Übergang zwischen den Zuständen passiert über CSS `transition` auf `height` und `transform`. Beim Drag werden Transitions deaktiviert (`transition: 'none'`), nach dem Loslassen wieder aktiviert.

### Merge-Logik (Cloud + Local)
Beim Pull aus Supabase werden Cloud-Einträge mit lokalen zusammengeführt: Cloud-IDs werden als Set erfasst, nur local-only Einträge (die nicht in der Cloud sind) werden ergänzt. Das Ergebnis wird nach `ts` (Timestamp) sortiert.

### OTP Input
6 einzelne `<input type="number">` Felder. Bei Eingabe wird automatisch zum nächsten Feld gesprungen. Bei Backspace auf leerem Feld wird zum vorherigen gesprungen. Bei Paste eines 6-stelligen Codes werden alle Felder auf einmal befüllt. `autoComplete="one-time-code"` auf dem ersten Feld.

---

## Was du NICHT änderst

- Keine Datenbankstruktur, keine Spaltennamen
- Keine CSS-Klassen oder IDs (außer `class` → `className` in JSX)
- Keine UI-Layouts, keine Abstände, keine Farben
- Keine Berechnungslogik (Score-Formel, Streak-Berechnung, Merge-Logik)
- Keine Snap-Points oder Drag-Konstanten
- Keine localStorage-Keys
- Keine Supabase-Abfragen (gleiche `.from('table').select(...)` Aufrufe)
- Keine Feature-Entfernung - alles was im Original vorhanden ist bleibt vorhanden

---

## Abschluss-Checkliste

Bevor du eine Phase als fertig deklarierst:
- [ ] Alle IDs und Klassen aus dem Original vorhanden
- [ ] Keine `window.*` Zugriffe außer `navigator.vibrate` und `localStorage`
- [ ] Keine direkten `document.getElementById` Calls - alles über Refs oder State
- [ ] `'use client'` Directive auf allen interaktiven Komponenten
- [ ] Supabase-Client nur aus `_lib/supabase.ts` importiert
- [ ] localStorage-Keys identisch mit Original
- [ ] TypeScript-Fehler auf 0 (`strict: true`)
