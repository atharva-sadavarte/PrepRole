# PrepRole CI/CD Architecture & Release Guide

This document outlines the release pipeline, automatic versioning strategy, and multi-track deployment architecture for PrepRole (React Native Android).

---

## 🏗️ Architecture Overview

```
Developer pushes code
        │
        ▼
 GitHub: main branch
        │
        ▼
 GitHub Actions: Automatic Build
  ├── 1. Install dependencies (npm ci)
  ├── 2. Run automated tests (npm test)
  ├── 3. Auto-increment versionCode & versionName
  └── 4. Generate signed release AAB
        │
        ▼
 Stage 1: Internal Testing [AUTOMATIC]
  └── Every successful push to main goes here immediately
        │
        ▼ (QA testing & sign-off)
 Stage 2: Closed Testing [CONTROLLED RELEASE]
  └── Selected release candidates go here after QA approval
        │
        ▼ (Final validation & executive sign-off)
 Stage 3: Production [MANUAL APPROVAL]
  └── Publish validated releases to real users (10% staged rollout)
```

---

## 🔢 Automatic Versioning Strategy

Google Play strictly requires `versionCode` to be higher than any previously published release. In addition, user-facing releases increment `versionName`.

### How Auto-Increment Works:
- **Base configuration:** Set in `android/gradle.properties`:
  ```properties
  VERSION_CODE=4
  VERSION_NAME=1.1.0
  ```
- **In GitHub Actions CI:**
  The `scripts/calculate-version.js` script runs during every build:
  $$\text{versionCode} = \text{baseVersionCode} + \text{GITHUB\_RUN\_NUMBER}$$
  $$\text{versionName} = \text{major}.\text{minor}.(\text{basePatch} + \text{GITHUB\_RUN\_NUMBER})$$

### Increment Table Example:
| Build Run | Base Code | Base Name | New Version Code | New Version Name | Compared to Prev |
|---|---|---|---|---|---|
| Initial | 4 | 1.1.0 | 4 | 1.1.0 | Baseline |
| Push 1 (`run_number=1`) | 4 | 1.1.0 | **5** | **1.1.1** | Increased ⬆️ |
| Push 2 (`run_number=2`) | 4 | 1.1.0 | **6** | **1.1.2** | Increased ⬆️ |
| Push 3 (`run_number=3`) | 4 | 1.1.0 | **7** | **1.1.3** | Increased ⬆️ |

> [!TIP]
> When moving to a new feature milestone (e.g., `1.2.0`), simply update `VERSION_NAME=1.2.0` in `android/gradle.properties` or `package.json`. Subsequent CI runs will automatically produce `1.2.1`, `1.2.2`, etc.

---

## 🚀 Workflows

### 1. `PrepRole Android Release Pipeline` (`.github/workflows/android-production.yml`)
- **Trigger:** Automatic on every `push` to `main`, or manual `workflow_dispatch`.
- **Jobs:**
  1. **Build & Test:**
     - Runs `npm ci`
     - Runs `npm test` (Jest test suite)
     - Calculates new `versionCode` and `versionName`
     - Builds signed AAB with Gradle
     - Uploads artifact `PrepRole-Release-<versionName>-b<versionCode>`
  2. **Internal Testing (Automatic):**
     - Uploads to Google Play `track: internal` (`status: completed`).
     - Real testers receive it within minutes.
  3. **Closed Testing (Controlled Release):**
     - Target: `track: alpha` (Closed testing).
     - Guarded by `environment: closed-testing` (QA Approval).
  4. **Production (Manual Approval):**
     - Target: `track: production`.
     - Staged rollout (default 10%, `userFraction: 0.1`).
     - Guarded by `environment: production` (Final Approval).

### 2. `PrepRole Promote Release Candidate` (`.github/workflows/android-promote.yml`)
- **Trigger:** Manual (`workflow_dispatch`).
- **Purpose:** Promotes an *already validated* Release Candidate AAB (tested for days in Internal Testing) directly to Closed Testing or Production **without rebuilding or recompiling code**.
- **Inputs:**
  - `target_track`: `closed` or `production`
  - `run_id`: (optional) ID of the CI run that generated the AAB. Defaults to the latest build on `main`.
  - `production_rollout`: Percentage rollout (e.g. `0.1` for 10%, `1.0` for 100%).

---

## 🛡️ Setting Up GitHub Environments & Approval Gates

To enable manual approval buttons in GitHub for Stage 2 & Stage 3:

1. In your GitHub repository, navigate to **Settings** > **Environments**.
2. Click **New environment** and create:
   - `closed-testing`
   - `production`
3. Under **Environment protection rules**:
   - Check **Required reviewers**.
   - Add your QA team members to `closed-testing`.
   - Add your Release Managers / Product Leads to `production`.
4. When a workflow deploys to these environments, GitHub will pause and notify the approvers for review before publishing to Google Play.

---

## 🔑 Required GitHub Secrets Checklist

Ensure these secrets are configured in **Settings** > **Secrets and variables** > **Actions**:

| Secret Name | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore (`release.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias in the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play Console API service account key JSON |
