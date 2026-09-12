# PrepRole — Claude Context Document

> AI-powered career coaching mobile app (React Native). CV analysis, ATS scoring, and role-matching via Gemini AI.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native | 0.87.1 |
| Language | TypeScript | ^6.0.3 |
| React | React | 19.2.3 |
| Navigation | React Navigation (native-stack + bottom-tabs) | ^7.x |
| Backend | Supabase (Auth + Postgres + Storage) | ^2.115.0 |
| AI | Google Gemini API (`gemini-3.6-flash`) | REST |
| Styling | React Native StyleSheet (no CSS-in-JS, no Tailwind) | — |
| Font | Montserrat (all weights, linked natively) | — |
| Icons | react-native-vector-icons (Ionicons) | ^10.3.0 |
| Node | >= 22.11.0 | — |

---

## Architecture

```
App.tsx (session + onboarding state, ThemeProvider, SafeAreaProvider)
└── RootNavigator (conditional rendering: Splash → Onboarding → Auth → BottomTabs)
    └── BottomTabNavigator (4 tabs, each with nested NativeStack)
        ├── HomeTab → DashboardScreen → CVScoreResultScreen
        ├── AnalyzeTab → CVUploadScreen → CVScoreResultScreen
        ├── HistoryTab → ScoreHistoryScreen → CVScoreResultScreen
        └── ProfileTab → ProfileScreen
```

**State management:** No Redux/Zustand. State lives in:
- `App.tsx`: global session + onboarding flag
- `ThemeContext`: theme preference (persisted to AsyncStorage)
- `BottomTabNavigator`: session passed via internal `SessionContext` (React Context)
- Screens: local `useState`/`useEffect`

---

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Entry point, session listener, ThemeProvider |
| `src/navigation/RootNavigator.tsx` | Top-level routing logic |
| `src/navigation/BottomTabNavigator.tsx` | Tab structure + stack definitions + `SessionContext` |
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/lib/theme.ts` | All design tokens (colors, fonts, spacing, radius, shadows, TAB_BAR) |
| `src/context/ThemeContext.tsx` | Theme provider + `useTheme()` hook |
| `src/config/env.ts` | Gemini API key loader (env.local → process.env fallback) |
| `src/config/env.local.ts` | **GITIGNORED** — local API key (create manually) |
| `src/types/resume.ts` | All shared TS types: `CVAnalysisResult`, `ResumeAnalysisRecord`, `ScoreTier`, etc. |
| `src/services/aiService.ts` | Invokes Supabase Edge Function `analyze-cv` (with local direct fallback) |
| `src/services/resumeService.ts` | Supabase CRUD for `resume_analyses` + Storage upload/signed URLs |
| `src/services/pdfService.ts` | Native PDF rendering + base64 extraction (Android `PdfPreviewModule`) |
| `supabase/functions/analyze-cv/index.ts` | Serverless Edge Function executing Gemini AI analysis with Supabase Secrets |
| `supabase/migrations/20260905_create_resume_analyses.sql` | Full DB schema + RLS policies + storage bucket |

---

## Navigation Flow

```
showSplash → SplashScreen
  → !hasCompletedOnboarding && !session → OnboardingScreen
  → !session → AuthScreen
  → session → BottomTabNavigator
```

- Onboarding completed flag stored in AsyncStorage: `@has_completed_onboarding`
- Session managed by Supabase `onAuthStateChange` listener in `App.tsx`
- All headers are hidden (`headerShown: false`); custom headers are in-screen
- Screen transitions: `slide_from_right` (NativeStack default)

---

## Authentication

- **Provider:** Google Sign-In only (`@react-native-google-signin/google-signin`)
- **Flow:** Google OAuth → `idToken` → `supabase.auth.signInWithIdToken({ provider: 'google', token })`
- **Google Web Client ID:** `879098542160-7374vk24bv0i9llla0ie3lr0b2o6ge4s.apps.googleusercontent.com` (in `AuthScreen.tsx`)
- **Session storage:** AsyncStorage via Supabase client config (`persistSession: true`)
- **No email/password auth** — do not add without discussion

---

## Backend (Supabase)

- **URL:** `https://drjlrhrvpyhpkzuewrmy.supabase.co` (hardcoded in `src/lib/supabase.ts`)
- **Anon key:** Also hardcoded (public-safe anon key, RLS enforced)
- **Table:** `public.resume_analyses`
  - Key columns: `id`, `user_id`, `target_role`, `job_description`, `file_name`, `file_url`, `overall_score`, `score_tier`, `breakdown` (JSONB), `summary`, `strengths` (JSONB), `improvements` (JSONB), `skills_matched` (JSONB), `skills_missing` (JSONB), `created_at`
- **RLS:** All 4 CRUD policies scoped to `auth.uid() = user_id`
- **Storage bucket:** `resumes` (private) — path format: `{userId}/{timestamp}_{cleanFileName}`
- **Signed URLs:** 1-hour expiry for resume previews

---

## AI Integration (Gemini)

- **Execution:** Server-side via Supabase Edge Function `analyze-cv` (`supabase.functions.invoke('analyze-cv')`)
- **Model:** `gemini-3.6-flash`
- **Key Storage:** **Supabase Secrets** (`npx supabase secrets set GEMINI_API_KEY=...` or Supabase Dashboard)
- **Key Rotation:** Change key in Supabase Secrets anytime — **no app rebuild or .env edit needed**
- **Input modes:** PDF inline data (base64) OR plain CV text + target role + optional job description
- **Output:** Strict JSON — `CVAnalysisResult` shape (validated and sanitized)
- **Temperature:** 0.2 (deterministic scoring)
- **Local Fallback:** Direct client Gemini call if Edge Function is unavailable and `GEMINI_API_KEY` is set in `env.local.ts`
- **MUST NOT** expose Gemini API key to client logs or bundle snapshots

---

## Storage (Local)

| Key | Value | Set by |
|-----|-------|--------|
| `@has_completed_onboarding` | `'true'` / null | `App.tsx` |
| `@preprole_theme_mode` | `'dark'` / `'light'` / `'system'` | `ThemeContext` |
| Supabase session | auto-managed | Supabase client |

---

## Theme System

- `src/lib/theme.ts` exports: `DARK_COLORS`, `LIGHT_COLORS`, `FONTS`, `SPACING`, `RADIUS`, `ICON_SIZES`, `SHADOWS`, `TAB_BAR`
- `useTheme()` from `src/context/ThemeContext.tsx` — returns `{ colors, isDark, mode, themeSetting, setThemeSetting }`
- **Always** use `colors.*` from `useTheme()` for colors; never hardcode hex values (except brand-critical white `#FFFFFF` in Google button)
- Font family: always use `FONTS.*` constants — never raw font string names
- Spacing/radius: always use `SPACING.*` / `RADIUS.*` tokens

---

## Native Modules

- `PdfPreviewModule` (Android-only custom native module):
  - `renderPdfPages(uri, maxPages)` → renders PDF to PNG URIs
  - `getPdfBase64(uri)` → base64 string for AI upload
  - `openSystemViewer(uri)` → opens device PDF viewer
  - Falls back gracefully on iOS (limited support)

---

## Components

| Component | Description |
|-----------|-------------|
| `src/components/Icon.tsx` | Wrapper around Ionicons from react-native-vector-icons |
| `src/components/PdfPreviewModal.tsx` | In-app PDF preview modal |
| `src/components/RecommendationCard.tsx` | CV improvement item card |
| `src/components/ScoreGauge.tsx` | Circular score display |

---

## Configuration Requirements

- **Primary (Production):** `GEMINI_API_KEY` is managed remotely in **Supabase Secrets**:
  ```bash
  npx supabase secrets set GEMINI_API_KEY="your-key-here"
  ```
- **Local Development / Fallback (Optional):** `src/config/env.local.ts` (gitignored):
  ```ts
  export const GEMINI_API_KEY = 'your-key-here';
  ```
- `.env` file is also gitignored for reference

---

## Build & Run

```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android

# Metro bundler
npx react-native start

# Lint
npm run lint

# Test
npm test
```

- iOS: CocoaPods (`Gemfile` present), run `bundle exec pod install` in `/ios`
- Android: Gradle-based, custom native module `PdfPreviewModule` in Android source

---

## Testing

- Framework: Jest + `@react-native/jest-preset`
- Test directory: `__tests__/`
- Config: `jest.config.js`
- Coverage: Not identified (no threshold configured)
- Current test scope: Not identified (minimal tests observed)

---

## Security Rules

- **MUST:** RLS is enabled on all Supabase tables — never bypass with service role key in app
- **MUST NOT:** Expose `GEMINI_API_KEY` in logs, error messages, or bundle snapshots
- **MUST NOT:** Store `env.local.ts` or `.env` in git (already gitignored)
- **MUST NOT:** Make the `resumes` storage bucket public — signed URLs only

---

## Coding Conventions

- **MUST:** Use `useTheme()` for all colors — no hardcoded color values
- **MUST:** Use `FONTS.*`, `SPACING.*`, `RADIUS.*` tokens from `src/lib/theme.ts`
- **MUST:** Types for all CV/analysis data go in `src/types/resume.ts`
- **MUST:** New Supabase operations go in `src/services/resumeService.ts`
- **MUST:** New AI/Gemini operations go in `src/services/aiService.ts`
- **SHOULD:** Use `useNativeDriver: true` on all Animated values
- **SHOULD:** Wrap screens with `useSafeAreaInsets()` for proper safe area handling
- **SHOULD:** Keep `StyleSheet.create()` at bottom of each screen file
- **SHOULD:** Screen props include `session: Session` passed from navigator wrappers
- Icons: always via `<Icon name="..." />` (Ionicons names)
- No external CSS, no Tailwind, no styled-components

---

## Known Limitations / Important Details

- **iOS PDF support:** `PdfPreviewModule` (native PDF renderer) is Android-only; iOS falls back to fetch-blob
- **Auth:** Google Sign-In only — no magic link, no email/password, no Apple Sign-In
- **`SAMPLE_RESUME_TEXT`** in `resumeService.ts` uses "Alex Chen" as placeholder — the AI prompt explicitly guards against using this name in real analyses
- **`theme.ts` file quirk:** Contains orphaned React imports at the top (lines 1-11) — these are unused but harmless; do not remove without checking if file was partially merged
- **`useSession()`** hook exported from `BottomTabNavigator.tsx` (not a separate context file) — session flows: `App.tsx` → `BottomTabNavigator` → `SessionContext` → screen wrappers
- No push notifications configured
- No offline mode / local caching of analyses

---

## Before Making Changes

- [ ] Read the relevant screen or service file fully before editing
- [ ] Check `src/types/resume.ts` for existing types before defining new ones
- [ ] Check `src/lib/theme.ts` for existing tokens before adding new values
- [ ] Confirm any new dependency doesn't duplicate an existing one (`package.json`)
- [ ] For DB changes: update `supabase/migrations/` with a new `.sql` file
- [ ] For new screens: register in the correct stack in `BottomTabNavigator.tsx` and add param type
- [ ] Verify `useNativeDriver` compatibility before adding new Animated properties
- [ ] Test both light and dark mode for any UI changes

---

## Do Not

- Do NOT rewrite working screens or services without explicit request
- Do NOT modify `src/lib/supabase.ts` URL/key without confirming backend change
- Do NOT add email/password auth or other OAuth providers without approval
- Do NOT make the `resumes` bucket public
- Do NOT add new top-level context providers without discussing state architecture
- Do NOT introduce new navigation patterns (modals, drawers) without approval
- Do NOT commit `env.local.ts` or `.env`
- Do NOT bypass RLS with a service role key in app code
- Do NOT modify unrelated files when fixing a specific bug

---

## Excluded Information

The following were intentionally omitted to save tokens:
- Screen-level UI implementation details (discoverable by reading each screen)
- Exact animation values and StyleSheet properties (in source)
- Full Gemini system prompt text (in `aiService.ts`)
- Android/iOS native build configs (standard RN setup)
- CocoaPods/Gradle dependency versions

*Approximate token count: ~1,650 tokens*

---

## Suggested `/docs` Structure

Read these only when working on the specific feature:

```
/docs
  auth.md           — Google Sign-In setup, OAuth config, Supabase provider config
  database.md       — Full schema, RLS policies, JSONB field shapes with examples
  ai-integration.md — Gemini prompt engineering, scoring criteria, response parsing
  pdf-native.md     — PdfPreviewModule Android native module API + iOS limitations
  theme-system.md   — Full color palette reference, token usage guide
  navigation.md     — Stack param lists, type-safe navigation patterns
```
