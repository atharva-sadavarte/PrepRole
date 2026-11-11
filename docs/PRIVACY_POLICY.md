# Privacy Policy for PrepRole

**Effective Date:** November 10, 2026  
**Last Updated:** November 10, 2026  
**Application Name:** PrepRole ("we", "our", or "us")  
**Package Identifier:** `com.preprole`  
**Contact Email:** support@preprole.com  

---

## 1. Introduction

Welcome to **PrepRole** ("the App"). PrepRole is an AI-powered career coaching, ATS resume evaluation, and interview preparation mobile application. We are committed to protecting your privacy and ensuring transparency regarding how your data is collected, processed, and safeguarded.

This Privacy Policy explains what information we collect when you use PrepRole, how we use and protect that information, your privacy rights, and how the law protects you. By using the App, you agree to the collection and use of information in accordance with this policy.

---

## 2. Information We Collect

We collect only the information necessary to provide, improve, and secure our services.

### A. Information You Provide Directly
* **Account Information:** When you sign in using Google Sign-In, we receive your name, email address, profile picture URL, and Google user identifier. We do not collect or store your Google account password.
* **Resume & Career Content:** Resumes, CVs, text excerpts, target job roles, job descriptions, and skill profiles that you voluntarily upload or input into the App for scoring, ATS analysis, and feedback.
* **Audio & Voice Data:** When you practice with the AI Mock Interviewer or Pitch Trainer, you may grant microphone permission to record your responses. This audio is processed to evaluate speech clarity, pacing, and provide conversational answers. Audio is used solely for the live session and is not used for biometric identification.
* **Camera Access (Optional):** When using video-assisted interview simulations, the App may request camera permission to display a local preview to simulate a real video interview. **Camera feeds are processed locally in real-time on your device and are never recorded, streamed, or uploaded to our servers.**

### B. In-App Purchase & Financial Information
* PrepRole utilizes **Google Play Billing** and **RevenueCat** to process subscriptions (PrepRole Pro) and one-time scan packages.
* **We do not collect, view, or store your credit card details, debit card numbers, UPI PINs, or bank account credentials.**
* All monetary transactions are processed securely by Google Play. We only receive non-sensitive purchase tokens, product identifiers (e.g., `preprole_pro_monthly`), order timestamps, and expiration dates to grant and maintain your Pro benefits.

### C. Automatically Collected Technical Data
* **Device & Diagnostic Data:** Device model, operating system version, app version, network state, and crash/diagnostic logs to diagnose bugs and improve app stability.
* **Session & Quota Identifiers:** Your authenticated Supabase user ID and quota counters (remaining free scans and active subscription entitlements) stored securely in our cloud database.

---

## 3. How We Use Your Information

We process your data strictly for legitimate operational purposes:
1. **Resume Analysis & ATS Scoring:** To extract skills, analyze keyword relevance against target job descriptions, calculate ATS compatibility scores, and generate customized bullet-point recommendations.
2. **AI Career Coaching & Interview Simulations:** To generate tailored interview questions, evaluate your voice or text responses, and provide actionable feedback.
3. **Monetization & Quota Management:** To track remaining free scans, authenticate Pro membership status, and restore valid purchases across devices.
4. **Account Management & Security:** To authenticate your identity via Google OAuth and prevent fraud, abuse, or unauthorized access.
5. **App Performance & Support:** To respond to user inquiries, fix technical crashes, and improve overall app functionality.

---

## 4. Third-Party Services & AI Processing Disclosures

To deliver our features, we partner with industry-leading cloud and AI providers. Each third-party provider is governed by strict data protection agreements:

| Service Provider | Role & Purpose | Data Shared | Privacy Link |
| :--- | :--- | :--- | :--- |
| **Google Sign-In** (Google LLC) | User authentication | Name, Email, Google User ID | [Google Privacy Policy](https://policies.google.com/privacy) |
| **Supabase Inc.** | Backend database, Auth, & Encrypted Storage | User ID, email, uploaded CVs, quota records | [Supabase Privacy Policy](https://supabase.com/privacy) |
| **Google Gemini API** (Google AI) | Generative AI analysis & coaching | Resume text, target roles, interview prompts | [Google AI Data Terms](https://ai.google.dev/terms) |
| **RevenueCat Inc.** | In-App purchase & subscription management | Anonymous App User ID, transaction tokens | [RevenueCat Privacy Policy](https://www.revenuecat.com/privacy) |
| **Google Play In-App Billing** | Payment processing | Financial transaction details handled by Google | [Google Play Terms](https://play.google.com/about/play-terms/) |

### Artificial Intelligence (AI) Data Handling:
* Text excerpts from your CV and interview prompts are securely transmitted to the **Google Gemini API** (`gemini-3.6-flash`) via encrypted Supabase serverless Edge Functions.
* **Your personal data and uploaded resumes are NOT used to train public machine learning or foundation AI models.**
* Data sent to the AI model is processed transiently to return your personalized evaluation and is not retained by the AI model for unauthorized external purposes.

---

## 5. Data Storage, Security & Retention

* **Encryption in Transit & at Rest:** All data transmitted between the App, our servers, and third-party APIs uses industry-standard TLS/SSL (HTTPS) encryption. Uploaded resumes are stored in private cloud storage buckets protected by strict **Row-Level Security (RLS)** policies ensuring only you can access your documents.
* **Data Retention:** We retain your account data and analysis records for as long as your account remains active.
* **User Control & Deletion:** You can delete specific resume analyses directly from your History screen at any time. When deleted, the database record and associated storage file are permanently erased.

---

## 6. Permissions Required by the App

The App requests the following permissions on Android/iOS, and only after your explicit confirmation:

| Permission | Android Name | Justification |
| :--- | :--- | :--- |
| **Internet Access** | `android.permission.INTERNET` | Required to communicate with Supabase, Gemini AI, and RevenueCat. |
| **Microphone** | `android.permission.RECORD_AUDIO` | Required exclusively for speech-to-text analysis during mock interviews and pitch coaching. |
| **Camera** | `android.permission.CAMERA` | Optional. Used only for live visual preview during video interview simulations; never uploaded or recorded. |
| **Audio Settings** | `android.permission.MODIFY_AUDIO_SETTINGS` | Required to play back AI coach speech and text-to-speech audio feedback. |

You can revoke any permission at any time through your device's System Settings. Revoking a permission will only disable features directly dependent on it.

---

## 7. Your Rights and Data Deletion

Under applicable global privacy regulations (including GDPR, CCPA, and Google Play User Data policies), you have the right to:
* **Access:** Request a copy of the personal data we hold about you.
* **Rectification:** Request correction of inaccurate personal information.
* **Erasure ("Right to be Forgotten"):** Request full deletion of your account, profile, uploaded CVs, and score history.
* **Revoke Consent:** Revoke permission grants or sign out of your account at any time.

### How to Request Account or Data Deletion:
To request complete deletion of your account and all associated data, you can:
1. Tap **Sign Out** and delete individual files from the History screen inside the App, OR
2. Send an email to **support@preprole.com** with the subject line *"Account Deletion Request"* from the email address associated with your PrepRole account. We will permanently delete your user profile, stored resumes, and analysis records within 30 days.

---

## 8. Children’s Privacy

PrepRole is designed for university students, job seekers, and working professionals. The App is **not directed to children under the age of 13** (or 16 where required by local law). We do not knowingly collect personal data from children. If you become aware that a child has provided us with personal information, please notify us immediately at **support@preprole.com**, and we will promptly delete the data.

---

## 9. Updates to This Privacy Policy

We may periodically update this Privacy Policy to reflect changes in our services, technological advancements, or legal obligations. When updates occur, the "Last Updated" date at the top of this policy will be revised. We encourage you to review this policy periodically. Continued use of the App following any changes indicates your acceptance of the revised policy.

---

## 10. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or our data handling practices, please contact us at:

* **Email:** support@preprole.com
* **Developer Name:** Atharva Sadavarte
* **App:** PrepRole (Package: `com.preprole`)
* **Website:** https://preprole.com (or GitHub repository)

