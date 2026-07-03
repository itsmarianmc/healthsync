# HealthSync

> **A mobile-first Progressive Web App for personal health tracking**

HealthSync combines calorie counting, hydration tracking, and workout logging in a single, unified interface that feels like a native app in the browser.

- Live at: [healthsync.itsmarian.dev](https://healthsync.itsmarian.dev)
- GitHub: [itsmarianmc/healthsync](https://github.com/itsmarianmc/healthsync)
- Tech: Next.js 16, TypeScript, Supabase, Tailwind CSS
- Personal project by [Marian](https://github.com/itsmarianmc)

## 📋 Table of Contents

1. [Features](#features)
2. [Quick Start](#quick-start)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Development](#development)
6. [Deployment](#deployment)
7. [Documentation](#documentation)

---

## 🎯 Features

### Dashboard
- **Weighted health score** based on calorie, water, and workout completion
- **Progress bars** for daily calorie and water goals
- **Macro tracking** with visual rings (protein, carbs, fat)
- **7-day activity chart** showing weekly trends
- **Recent activity feed** with quick access
- **Rule-based next-step suggestions**
- **Weather widget** and **activity status tracking**
- Fully reads from local storage - no loading states

### CalSync - Food Tracking
- Log meals via:
  - Free-text search
  - **Barcode scanning** using ZXing / Open Food Facts
  - Manual entry
- **Macro rings** showing daily protein, carbs, and fat progress
- Entries sync to cloud when logged in
- Manual entry includes macro calculator

### DropSync - Hydration Tracking
- Two-step bottom sheet workflow:
  1. Pick a drink
  2. Set amount by dragging a glass up or down
- **Snap points** at common volumes (100 to 1000 ml)
- Swipe to close, pull up to expand
- **History sheet** shows entries grouped by date

### Workouts
- Built-in **4-day split** (Pull / Push / Legs / Arms)
- Editable workout routines
- **Drag-to-reorder** exercises
- **GIF previews** for each exercise
- Live session timer
- Per-set weight and reps logging
- Session history view

### Settings
- Customizable goals for calories, water, and macros
- **Built-in calorie calculator** using Mifflin-St-Jeor formula
- Multiple themes: Dark, Light, Ocean, Forest, Sunset, Lavender
- Workout routines with live session timer
- **AI tip toggle** with optional Gemini API key
- User profiles and preferences

### AI Detection (Opt-in)
- Google Gemini integration inside CalSync
- Estimate nutrition from:
  - Photos
  - Camera captures
  - Text descriptions
- **Disabled by default**
- Uses the user's own API key
- Never proxies through the HealthSync backend

### Update Center
- In-app update notifications and changelog browser
- Shows what's new in each version
- Seamless one-tap updates (PWA)
- Powered by Supabase-backed changelog

### Authentication
- Email and password login
- **Optional TOTP two-factor authentication**
- "Remember this device" skips 2FA on trusted devices
- Session tokens stored in **secure cookies** (not localStorage)
- Password reset flows

### Offline & PWA
- **Installable** on mobile via browser's "Add to Home Screen" prompt
- Fully usable without an account
- Entries live in browser's local storage (offline)
- Cloud sync available via free user account

### UI/UX
- Pull-to-refresh from dashboard top
- **Haptic feedback** on important interactions
- **Sheet system** with drag-to-dismiss / drag-to-expand
- **No page reloads** - SPA experience
- Fully responsive, mobile-first design

---

## 🚀 Quick Start

### For Users
1. Visit [healthsync.itsmarian.dev](https://healthsync.itsmarian.dev)
2. Use the app without an account (data stays local)
3. For cloud sync: create a free account in settings
4. Optional: enable AI detection with your own Gemini API key

### For Developers
1. **Clone the repository:**
   ```bash
   git clone https://github.com/itsmarianmc/healthsync.git
   cd healthsync
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or pnpm install / yarn / bun
   ```

3. **Copy environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Run development server:**
   ```bash
   npm run dev
   # or pnpm dev / yarn dev / bun dev
   ```

5. **Open browser:**
   ```
   http://localhost:3000
   ```

6. **Run tests:**
   ```bash
   npm run test:watch
   ```

7. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🛠️ Tech Stack

| Area | Technology |
|------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Vanilla CSS with CSS custom properties (no Tailwind for app styles) |
| **Backend** | Supabase (PostgreSQL + Row Level Security) |
| **Authentication** | Supabase Auth with TOTP MFA, sessions via cookies |
| **State Management** | React Context API + localStorage hooks |
| **Font** | DM Sans (Google Fonts) |
| **Icons** | Font Awesome 7 |
| **Barcode Scanner** | ZXing (`@zxing/browser`) |
| **QR Code** | QRCode.js (CDN) |
| **Charts** | Custom built-in chart components |
| **Testing** | Playwright (E2E), Vitest |
| **Deployment** | Vercel (recommended), any Node.js host works |

---

## 📁 Project Structure

```
healthsync/
├── app/
│   ├── api/                    # API routes
│   │   ├── proxy/route.ts      # AI proxy endpoint
│   │   └── serwist/[path]/     # Service worker routes
│   ├── dash/                   # Dashboard page
│   ├── drinks/                 # Hydration page
│   ├── food/                   # CalSync page
│   ├── legal/                  # Legal pages (privacy, terms, etc.)
│   ├── login/                  # Authentication page
│   ├── layout.tsx              # Root layout with providers
│   ├── onboarding/             # Onboarding flow
│   ├── page.tsx                # App shell (navigation, views)
│   └── styles.css              # Global styles
│
├── _components/                # Feature-specific components
│   ├── calsync/                # CalSync components
│   │   ├── BarcodeScanModal.tsx
│   │   ├── CalSync.tsx
│   │   ├── CalSyncModal.tsx
│   │   ├── FoodList.tsx
│   │   └── ManualEntry.tsx
│   ├── dropsync/               # DropSync components
│   │   ├── DrinkLog.tsx
│   │   ├── DropSync.tsx
│   │   └── GlassInput.tsx
│   ├── dashboard/              # Dashboard components
│   │   ├── ActivityStatus.tsx
│   │   ├── Dashboard.tsx
│   │   ├── MetricGrid.tsx
│   │   └── WeekChart.tsx
│   ├── navigation/             # Navigation components
│   │   └── BottomNav.tsx
│   ├── onboarding/             # Onboarding components
│   │   └── Onboarding.tsx
│   ├── settings/               # Settings components
│   ├── shared/                 # Shared UI components
│   │   ├── BottomNav.tsx
│   │   ├── Footer.tsx
│   │   └── HeaderTitle.tsx
│   └── update/                 # Update center components
│
├── _context/                   # React Context providers
│   ├── AppShellContext.tsx
│   └── AuthContext.tsx
│
├── _hooks/                     # Custom React hooks
│   ├── useDashboardData.ts
│   ├── useDraggableSheet.ts
│   ├── useLocalStorage.ts
│   └── useOnboarding.ts
│
├── _lib/                       # Core utilities
│   ├── supabase.ts             # Supabase client
│   ├── supabase.ts             # Auth helpers
│   ├── types.ts                # Type definitions
│   ├── sync.ts                 # Data sync logic
│   ├── tour.ts                 # Onboarding tour
│   ├── headerBtns.ts           # Header button handlers
│   └── visitedRoutes.ts        # Route tracking
│
├── public/                     # Static assets
│   └── manifest.json           # PWA manifest
│
├── tests/                      # Test files
│
├── e2e/                        # E2E test suites (Playwright)
│
├── .env                        # Environment variables (local)
├── .env.example               # Template for .env
├── .next/                      # Next.js build output
├── node_modules/               # Dependencies
├── next.config.ts             # Next.js config
├── playwright.config.ts        # Playwright config
├── tsconfig.json              # TypeScript config
└── package.json               # Project metadata
```

---

## 💻 Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run E2E tests (Playwright)
```

### Key Development Notes

- **TypeScript strict mode** is enabled throughout
- **No page reloads** - uses React Router-like navigation within the SPA
- **Offline-first architecture** with localStorage fallback
- **Component-based structure** with clear separation of concerns
- **Supabase RLS policies** secure data access at the database level
- **TOTP MFA** for enhanced security
- **Service Worker** for PWA functionality (via Serwist)

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# (Optional) Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

---

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or push to deploy on every commit
vercel --prod
```

### Custom Node.js Host

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Configure server:**
   - Set `PORT` environment variable
   - Point to `.next` output directory
   - Enable Next.js output mode (recommended: `standalone`)

3. **Start server:**
   ```bash
   node .next/standalone/server.js
   ```

### Environment Variables for Production

The following environment variables are required in production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
- `NEXT_PUBLIC_GA_ID` (Google Analytics, optional)

See [HOSTING.md](./HOSTING.md) for detailed deployment instructions, including self-hosting options.

---

## 📚 Documentation

- [FEATURES.md](./FEATURES.md) - Detailed feature descriptions (German)
- [HOSTING.md](./HOSTING.md) - Comprehensive deployment guide (English)
- [README.md](./README.md) - User-facing feature overview (English)
- [checklist.md](./checklist.md) - Development and deployment checklist

### In-App Documentation

HealthSync includes comprehensive legal pages:
- **[Privacy Policy](https://healthsync.itsmarian.dev/legal/privacy)** - Includes GDPR health data notice
- **[Cookie Policy](https://healthsync.itsmarian.dev/legal/cookies)** - Cookie consent and Google Consent Mode v2
- **[Terms of Use](https://healthsync.itsmarian.dev/legal/terms)** - Acceptable use, liability, and disclaimers
- **[AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines)** - AI usage policies and responsibilities

---

## ⚠️ Legal & Compliance

HealthSync is **not** a medical device. It does not provide medical advice.

- **GDPR Compliant** - Health data handling with Art. 9 considerations
- **Cookie Consent** - Google Consent Mode v2 integration
- **Age Requirements** - Terms of use require users to be at least 13
- **Data Privacy** - Clear data collection and storage practices
- **AI Transparency** - Users must opt-in for AI features with full disclosure

Please review the in-app legal pages before deploying a public instance.

---

## 🤝 Contributing

HealthSync is a personal project maintained by [itsmarianmc](https://github.com/itsmarianmc).

Feel free to:
- Star the repository 🌟
- Report issues on GitHub 🐛
- Suggest features in Discussions 💡
- Fork and submit pull requests for improvements 🔧

---

## 📄 License

This project is part of itsmarian's personal project collection. Please refer to the repository for licensing information.

---

## 🔗 Links

- **Live App**: [healthsync.itsmarian.dev](https://healthsync.itsmarian.dev)
- **GitHub**: [itsmarianmc/healthsync](https://github.com/itsmarianmc/healthsync)
- **Supabase**: [docs.supabase.com](https://supabase.com/docs)
- **Next.js**: [nextjs.org](https://nextjs.org)
- **TypeScript**: [typescriptlang.org](https://typescriptlang.org)

---

## 💬 Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/itsmarianmc/healthsync/issues)
- Check the [in-app legal pages](https://healthsync.itsmarian.dev/legal)
- Review the [hosting documentation](./HOSTING.md)

---

**Made with ❤️ by Marian** | Part of [itsmarian](https://github.com/itsmarianmc)'s projects