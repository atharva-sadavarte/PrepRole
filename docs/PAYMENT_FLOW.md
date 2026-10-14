# PrepRole — Payment Flow & Monetization Architecture

This document explains the end-to-end payment lifecycle for **PrepRole**, tracing how a user purchases a plan in the app, how their account transitions from Free to Pro in real-time, and how revenue flows from Google Play directly into your bank account.

---

## 1. High-Level Flow Diagram

```
[ User App ] ──► [ Google Play / UPI ] ──► [ RevenueCat ] ──► [ Supabase Webhook ] ──► [ User Ban Gaya PRO ]
                       │
                       ▼
             [ Aapka Bank Account ]
```

---

## 2. Step-by-Step Breakdown

### Step 1: User Reaches Paywall
* **Trigger:** A free user runs out of their initial 3 free CV scans, or taps "Upgrade to Pro" from their profile or scan results.
* **Component:** [`src/components/PaywallModal.tsx`](file:///Volumes/CrucialX9/SelfDevelopment/PrepRole/src/components/PaywallModal.tsx)
* **Offerings:** Fetches active subscription & top-up packages dynamically via [`src/services/purchaseService.ts`](file:///Volumes/CrucialX9/SelfDevelopment/PrepRole/src/services/purchaseService.ts) using the RevenueCat SDK (`react-native-purchases`).

### Step 2: Payment Execution via Google Play Billing
* When the user taps **"Unlock Pro"** or **"Buy Scan Pack"**:
  1. The app invokes `purchasePackage(pkg)`.
  2. Google Play's native bottom-sheet modal opens on the user's phone.
  3. The user pays using their preferred payment method:
     * **UPI** (Google Pay, PhonePe, Paytm)
     * **Credit / Debit Card**
     * **Net Banking / Google Play Balance / Redeem Codes**

### Step 3: RevenueCat Ingestion & Validation
* Google Play securely validates the transaction and issues an encrypted digital purchase token.
* RevenueCat automatically listens to Google Play Store notifications via Cloud Pub/Sub.
* It verifies the receipt, tracks subscriptions (renewal, expiration, cancellations), and associates the purchase with the user's Supabase User ID (`app_user_id`).

### Step 4: Supabase Edge Webhook Execution
* RevenueCat dispatches a real-time `POST` webhook to:
  `https://<project-id>.supabase.co/functions/v1/revenuecat-webhook`
* **Implementation:** [`supabase/functions/revenuecat-webhook/index.ts`](file:///Volumes/CrucialX9/SelfDevelopment/PrepRole/supabase/functions/revenuecat-webhook/index.ts)
* **Webhook Authentication:** Secured via `REVENUECAT_WEBHOOK_AUTH` bearer token in Supabase Secrets.

### Step 5: Database State Transition (Free ➡️ PRO)
The webhook handles the event atomically in the `public.user_quotas` table:

1. **Initial Purchase / Renewal (`INITIAL_PURCHASE` / `RENEWAL`):**
   ```sql
   UPDATE public.user_quotas
   SET plan_type = 'pro',
       pro_until = '<expiration_timestamp>',
       updated_at = NOW()
   WHERE user_id = '<app_user_id>';
   ```
2. **One-Time Credit Pack (`NON_RENEWING_PURCHASE`):**
   * Atomically increments `credits_remaining` (e.g. +3 or +5 scans).
3. **Cancellation / Expiration (`EXPIRATION`):**
   * Automatically resets `plan_type = 'free'` and `pro_until = NULL`.

### Step 6: Money Transfer to Your Bank Account (Payout)
* Google Play collects payments in INR (or user local currency).
* **Google's Cut:** 15% platform service fee under Google Play's 15% tier (first $1M USD annual revenue).
* **Your Share (85%):**
  * Accumulated in your **Google Play Console / Google Payments Merchant Profile**.
  * Google transfers funds automatically on the **15th of each month** directly to your linked Indian Bank Account (via Wire Transfer / NEFT).

---

## 3. Zero Upfront Cost Architecture

| Question | Answer |
| :--- | :--- |
| **Do we need to pre-upgrade Supabase?** | **No.** Supabase Free Tier supports up to 50,000 Monthly Active Users. Pro vs Free is just a database column `plan_type`. |
| **Do we need to pre-pay Google AI Studio (Gemini)?** | **No.** Google AI Studio provides 1,500 free requests per day (~45,000 scans/month free). |
| **Does RevenueCat charge upfront?** | **No.** RevenueCat is completely free until you generate over $2,500 (~₹2,10,000) in monthly tracked revenue. |
| **Cashflow Summary:** | **User pays you first.** You only incur infrastructure scaling costs after thousands of paying users have already funded your project. |

---

## 4. Environment & Secret Checklist

For this payment flow to run in production, ensure these keys are configured:

| Key / Secret | Where to Configure | Purpose |
| :--- | :--- | :--- |
| `REVENUECAT_PUBLIC_KEY` | `src/config/purchases.ts` | Mobile app initialization for Android/iOS Google Play billing |
| `REVENUECAT_WEBHOOK_AUTH` | Supabase Secrets (`npx supabase secrets set`) | Secret token to authenticate webhooks sent by RevenueCat |
| Google Service Account JSON | RevenueCat Dashboard ➡️ Integrations | Allows RevenueCat to verify purchases with Google Play API |
| Webhook URL | RevenueCat Dashboard ➡️ Webhooks | Points to `https://<id>.supabase.co/functions/v1/revenuecat-webhook` |
