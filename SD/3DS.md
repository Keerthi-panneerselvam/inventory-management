## 3DS Authentication — Memorize This Answer

### If they ask: "Design the mobile 3DS authentication flow"

**Opening (10 seconds):**
> "3DS is the authentication layer for online card payments. When a Wise customer uses their card online and the transaction is flagged as high-risk, Wise sends a push notification to their phone. The customer approves with Face ID, and the app sends the result back to Wise within a 5-minute window."

**User Journey (20 seconds):**
> "The customer uses their Wise card on Amazon. Amazon triggers 3DS verification through Visa. Wise's backend receives the challenge and sends a push notification: 'Approve S$150 at Amazon?' The customer taps the notification — the app opens directly to the approval screen. They see the merchant name, amount, and a countdown timer. They authenticate with Face ID and tap Approve. The app sends the result to Wise's API. Wise tells Visa, Amazon's checkout completes. The whole thing must happen within 5 minutes or the challenge expires and the payment fails."

**Clarifying Questions (pick 3):**
> "What's the expiry window — 5 minutes from Wise's API docs?"
> "Should the approval require biometric authentication — Face ID or Touch ID?"
> "What if the phone is offline when the push arrives — do we fall back to SMS OTP?"
> "Should the push deep-link directly to the approval screen even if the app was killed?"
> "Is this one approval screen, or a multi-step flow?"

**High-Level Flow (30 seconds):**
> "The flow involves three domains. First, the card network domain — customer uses card online, merchant asks Visa for 3DS authentication, Visa forwards to Wise. Second, the backend domain — Wise receives the challenge, creates a push notification payload with the transaction reference, merchant, amount, and expiry time, sends it via APNs. Third, the mobile domain — receives the push, deep-links to the approval screen, customer authenticates with biometric, app POSTs the result to Wise's 3DS challenge-result API. Wise tells Visa, Visa tells the merchant. Done.
>
> Critically, the notification service and the 3DS challenge service are decoupled. The notification is just the delivery mechanism. The actual challenge state lives on the backend. The mobile app is a thin client that displays the challenge and submits the result."

**Mobile Architecture — VIPER (60 seconds):**
> "Single VIPER module presented modally over whatever screen the user is currently on.
>
> The **View** shows: merchant name, amount with currency symbol, a countdown timer that turns red under 60 seconds, Approve and Decline buttons, and a loading state while submitting. When expired, buttons are hidden and it shows 'Challenge expired — the merchant will need to retry.' Completely dumb — no logic, just renders what the Presenter says.
>
> The **Presenter** manages the countdown timer. It fires every second, calculates seconds remaining from the expiry timestamp, tells the View to update. At 60 seconds, it tells the View to switch to urgent mode — red color, larger font. At zero, it tells the View to show expired state and invalidates the timer. It also formats the amount: Decimal to 'S$150.00' with the correct currency symbol.
>
> The **Interactor** handles three critical steps in sequence. Step one — validate the challenge hasn't expired client-side. No point making an API call for an expired challenge. Step two — biometric authentication. Call LAContext to authenticate with Face ID. The prompt shows: 'Approve S$150 at Amazon.' If the user cancels biometric, stay on the screen — let them try again or decline. Step three — submit the result. POST to `/v3/spend/profiles/{id}/3dsecure/challenge-result` with the transaction reference and status APPROVED or DECLINED. Wise's API is idempotent — first call processed, duplicates ignored. So double-taps and network retries are safe.
>
> The **Router** handles two things. Entry: the push notification deep-links here — the Router presents this module modally. Exit: after successful submission, dismiss after a 2-second success animation, then optionally navigate to the transaction detail."

**The 5 Key Concerns (40 seconds):**

> "Five critical concerns for this flow.
>
> **First — Timing.** The 5-minute window is non-negotiable. Wise's API returns 400 after expiry. The countdown must be prominent — not a small label in the corner. I'd put it center screen, large font, and turn it red with a pulse animation under 60 seconds. If the timer expires while the user is looking at the screen, immediately hide the buttons — don't let them tap Approve on an expired challenge.
>
> **Second — Deep linking.** The push notification must open the approval screen directly — even if the app was killed. I'd encode the challenge data in the push payload's userInfo and handle it in the AppDelegate's notification response handler. The Router presents the 3DS module modally over whatever screen is currently visible. Universal Links for the deep link, not custom URL schemes — security matters here.
>
> **Third — Biometric auth.** Before submitting approval, require Face ID or Touch ID. A stolen phone sitting on a desk shouldn't be able to approve a €5,000 transaction. The biometric prompt shows the merchant and amount so the user knows exactly what they're approving. If biometric fails — user stays on the screen, can try again or tap Decline.
>
> **Fourth — Idempotency.** Wise's API processes only the first call. Duplicates return success but don't process again. This means if the user taps Approve twice rapidly, or the network retries the request, we won't get a double approval or an error. I still disable the button after first tap to prevent UI confusion.
>
> **Fifth — Offline and fallback.** If the phone is offline when the push arrives, APNs queues it. But if the user doesn't come online within 5 minutes, the challenge expires. The app must check expiry on launch — if they tap a stale notification, show 'Challenge expired' immediately, don't attempt the API call. And Wise has a fallback: if push doesn't arrive at all — notifications disabled, phone off — Wise falls back to SMS OTP. The mobile should handle both paths."

**Trade-offs (20 seconds):**

> "Modal presentation versus full-screen navigation — I'd use a modal sheet. The user might be in the middle of something else in the app. A modal says 'this is urgent, handle it now' without losing their place. After they approve, the modal dismisses and they're right back where they were.
>
> Client-side expiry check versus server-only — I check both. Client-side first as a fast filter — if expired, don't even make the API call. But the server also validates, because the client's clock might be wrong. Belt and suspenders for a financial operation.
>
> Timer granularity — I update every second because the user needs to see the countdown progressing. Updating every 10 seconds would feel broken. The 1-second timer has negligible battery impact since it runs for at most 5 minutes."

**Wise Connection (10 seconds):**
> "At PayPal, I work on checkout authentication flows — similar push-based approval patterns for Express Checkout. The RUNE experiment bug I debugged was in exactly this domain — asynchronous state that hadn't loaded before the UI rendered. The two-phase pattern I applied there — cached state first, refresh in background — applies to 3DS challenge state too."

**When They Add: "What about supporting in-app purchase verification without a push?" (20 seconds):**
> "That's the frictionless 3DS flow — risk-based authentication that happens silently. The mobile collects device signals — device ID, IP, screen size, battery level, typical usage patterns — and sends them to the backend during the card payment. The backend's risk engine evaluates these signals. Low risk — transaction approves silently, no customer interaction. High risk — triggers the push notification challenge flow I just described. About 90% of transactions should go through frictionless. Only 10% should need the actual challenge. I'd instrument the frictionless-to-challenge ratio as a key metric — if more than 15% of transactions trigger challenges, either the risk model needs tuning or there's a fraud spike."

---

### The 6 Key Phrases to Memorize:

```
1. "5-minute expiry — non-negotiable. Wise's API returns 400 after expiry."

2. "Biometric BEFORE submit — stolen phone can't approve transactions."

3. "Deep link from push directly to approval screen — 
    even if app was killed."

4. "Idempotent API — first call processed, duplicates ignored. 
    Double-taps and retries are safe."

5. "Countdown timer — red under 60 seconds, 
    hide buttons when expired."

6. "Fallback to SMS OTP if push doesn't arrive — 
    phone offline or notifications disabled."
```

### Quick Drawing to Practice (draw in 2 min):

```
Customer uses card at Amazon
    → Visa: "3DS required"
    → Wise backend receives challenge
    → Push notification via APNs
    → Mobile app
        ↓
┌─────────────────────────────────────┐
│  3DS VIPER Module (Modal)           │
│                                     │
│  VIEW: merchant + amount + countdown│
│    ↕                                │
│  PRESENTER: timer, formatting       │
│    ↕                                │
│  INTERACTOR:                        │
│    1. Check not expired             │
│    2. Biometric auth (Face ID)      │
│    3. POST challenge-result         │
│    ↕                                │
│  ROUTER: deep link in, dismiss out  │
└─────────────────────────────────────┘
    → Wise backend
    → Visa → Amazon → Payment approved ✅

Timeline: Must complete within 5 minutes
Fallback: SMS OTP if push fails
```

### Edge Cases to Mention (if they probe):

```
"What if user taps notification 6 minutes later?"
→ Check expiry on launch. Show "Challenge expired" immediately. 
  Don't call API.

"What if user has multiple devices?"
→ Push goes to all devices. First approval wins (idempotent). 
  Other devices show "Already handled."

"What if user taps Decline?"
→ Submit DECLINED status. Payment fails at Amazon. 
  User sees "Payment declined by you." No biometric needed for decline.

"What if the app crashes mid-submission?"
→ Challenge still valid until 5-min expiry. 
  User reopens → notification still available → try again.
  Idempotency handles any partial submissions.

"What if two 3DS challenges arrive simultaneously?"
→ Queue them. Show one at a time. 
  After first is handled, present the second. 
  Each has its own 5-min timer running independently.
```

**Practice saying the full answer out loud 3 times. Target: under 4 minutes.** 🚀
