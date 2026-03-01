## Card Transaction + Notification — Memorize This Answer

### If they ask: "Design the card transaction notification system"

**Opening (10 seconds):**
> "When a customer taps their Wise card anywhere in the world, they should get an instant notification within one second — showing the merchant name, amount, and if it's a foreign currency, both the charged amount and the deducted amount from their balance."

**User Journey (20 seconds):**
> "Customer taps their card at Starbucks in Paris. Within one second, their phone buzzes. If the app is in background, they see a rich notification with the Starbucks logo: '€4.50 at Starbucks Paris — S$6.53 from your SGD balance'. If the app is in foreground, they see an in-app banner with haptic feedback. They open the app and the transaction is already at the top of their list. Their balance is already updated."

**High-Level Flow (30 seconds):**
> "The flow starts at the point-of-sale terminal. The card tap goes to Visa or Mastercard, then to Wise's payment processor. The processor publishes a Kafka event — `card.transaction.created`. Two services consume this event in parallel: the Transaction Service stores it in PostgreSQL, and the Notification Service sends a push via APNs to the customer's device. They run in parallel so the push doesn't wait for the database write — that's why the notification arrives within one second."

**Mobile Architecture — VIPER (60 seconds):**
> "On the mobile side, I'd build this as a single VIPER module.
>
> The **View** renders the transaction list grouped by date — Today, Yesterday, This Week. Each row shows merchant icon, name, amount, and status. Pull-to-refresh. Completely dumb — no logic.
>
> The **Presenter** formats everything for display. Decimal to currency string — '€4.50'. Timestamp to relative time — '2 min ago'. Status to icon — checkmark for completed, clock for pending. For multi-currency transactions, it formats both amounts: primary is what the merchant charged, secondary is what left the balance.
>
> The **Interactor** handles the business logic. Cache-first strategy: show cached transactions immediately so the screen isn't empty, then refresh from the API in background. When a push notification arrives, it does an optimistic insert — adds the transaction to the top of the local list immediately from the push data, then confirms with an API refresh 2 seconds later. It also triggers a balance refresh.
>
> The **Router** handles navigation. Tap a transaction — push to detail screen. Tap dispute — present the dispute flow modally. Deep link from a push notification — navigate directly to that transaction.
>
> The **Repository** decides cache or network. Uses encrypted CoreData for offline access because this is financial data."

**Push Notification Handling (30 seconds):**
> "Two paths depending on app state.
>
> Background: I use a Notification Service Extension — `UNNotificationServiceExtension` — which runs BEFORE the notification is displayed. It downloads the merchant logo, formats the amount with the correct currency symbol, and creates a rich notification. The user sees the logo and formatted text without opening the app.
>
> Foreground: I catch the notification via `UNUserNotificationCenter` delegate, show a custom in-app banner with haptic feedback that auto-dismisses after 5 seconds, and tapping it navigates to the transaction detail.
>
> Both paths: optimistic insert into the local transaction list, and trigger a balance refresh in the background."

**Multi-Currency — The Hard Part (30 seconds):**
> "This is the most interesting mobile challenge. When a customer pays €4.50 in Paris but their balance is SGD, we need to show both amounts. The primary display shows what the merchant charged — €4.50 at Starbucks Paris. Below that, what was actually deducted — S$6.53 from your SGD balance. And on the detail screen, the rate: 1 EUR = 1.45 SGD.
>
> This is exactly what I work on at PayPal with BFX. The BFX system handles what happens when a Visa multi-currency card is used at point of sale — the authorization, the conversion decision, the rate, the fee. The mobile display logic is identical — show the charged amount, the converted amount, and the rate for transparency. Transparency is core to Wise's mission."

**Trade-offs (20 seconds):**
> "Push versus polling — push for real-time transaction alerts, absolutely. Polling every second would drain the battery. Push is event-driven — server sends only when something happens. But I add pull-to-refresh as a fallback in case a push is delayed or lost.
>
> Optimistic insert versus wait for API — I show the transaction from push data immediately because the user expects instant feedback when they tap their card. The trade-off: the push might have preliminary data. At a restaurant, the authorization doesn't include the tip. So I show 'Pending' status with the authorization amount, then update when settlement comes through. Standard two-phase pattern in card processing."

**Production Concerns (20 seconds):**
> "For production, I'd monitor: push notification delivery latency — must be under 1 second from card tap. Transaction list load time — under 300ms. API error rate per endpoint. Crash-free rate above 99.9%.
>
> Security: certificate pinning on all API calls. Transaction data encrypted at rest in CoreData. Screen protection — blur the transaction list when the app enters background so amounts aren't visible in the app switcher.
>
> Feature flags: roll out any changes to the notification format or transaction display behind a flag. 5% first, monitor, ramp up."

**When They Add: "Now add spending categories and monthly summary" (20 seconds):**
> "New VIPER module — SpendingSummaryModule — not added to the existing transaction list. Single Responsibility. The backend assigns categories using merchant category codes — the mobile just displays what the backend provides. I'd use Swift Charts for a donut chart showing spending by category. Tap a category segment and the Router navigates to a filtered transaction list. Month-over-month comparison: '15% more on Food & Drink than last month.' Wrap it behind a feature flag for gradual rollout."

---

**Total: ~4 minutes for the full answer. In the interview, they'll interrupt with questions — which is good. You won't need to say all of this in one go.**

### The 6 Key Phrases to Memorize:

```
1. "Kafka event consumed by two services in parallel — 
    notification doesn't wait for database write"

2. "Cache-first: show cached immediately, refresh in background"

3. "Optimistic insert from push data, confirm with API 2 seconds later"

4. "Rich notification via UNNotificationServiceExtension — 
    downloads merchant logo before display"

5. "Multi-currency: primary amount in merchant's currency, 
    secondary in balance currency, rate for transparency"

6. "This is exactly what I work on at PayPal with BFX — 
    multi-currency display for Visa card transactions"
```

### Quick Drawing to Practice (draw in 2 min):

```
Card tap → Visa → Wise Backend → Kafka
                                   ↓
                        ┌──────────┴──────────┐
                        ↓                     ↓
                  Notification           Transaction
                  Service                Service
                  (→ APNs)               (→ PostgreSQL)
                        ↓
                  Mobile App
                  ├── Background: Rich notification
                  ├── Foreground: In-app banner + haptic
                  ├── Optimistic insert into list
                  └── Balance refresh
```

**Practice saying this out loud 3 times. Time yourself — should be under 4 minutes.** 🚀

## Clarifying Questions — Card Transaction + Notification

### The 5 Questions to Ask (Pick 3):

**Question 1 — Latency:**
> "How quickly should the notification appear after the card tap — are we targeting sub-second delivery?"

**Why ask this:** Shows you think about performance requirements upfront. Their answer determines whether you design for push (sub-second) or polling (acceptable delay).

**Question 2 — Foreground vs Background:**
> "Should the notification behave differently when the app is open versus in the background?"

**Why ask this:** Shows you understand iOS notification architecture. Foreground = in-app banner with haptic. Background = rich system notification with merchant logo. Two completely different code paths.

**Question 3 — Multi-Currency:**
> "Should I handle multi-currency — card charged in EUR but balance is SGD? Should we show both amounts?"

**Why ask this:** Shows domain expertise — you know this is a real problem for Wise's global card product. Also lets you bring up your BFX experience naturally.

**Question 4 — Amount Finality:**
> "Is the transaction amount always final, or can it change — like restaurants with tips or hotels with incidentals?"

**Why ask this:** Shows you understand card processing. Authorization amount ≠ settlement amount. This affects whether you show "Pending" status and how you handle amount updates.

**Question 5 — Scope:**
> "Should I focus on the mobile architecture, or include the backend event flow as well? And should I start with the happy path first?"

**Why ask this:** Shows you manage scope. Gets their guidance on how deep to go. The answer is usually "start with happy path, we'll add complexity."

---

## Universal Clarifying Questions — ANY Scenario

### Memorize This Framework: **U.L.E.S.S**

```
U — USER JOURNEY
    "What does the customer see step by step?"
    "What triggers this flow?"

L — LATENCY / PERFORMANCE
    "What's the expected response time?"
    "Should this feel instant?"

E — EDGE CASES
    "What happens when [something fails]?"
    "What about [unusual case]?"

S — SCOPE
    "Mobile only or include backend?"
    "iOS only or both platforms?"
    "Happy path first?"

S — SECURITY / COMPLIANCE
    "Any regulatory constraints?"
    "Should this require biometric auth?"
```

### Applied to Each Scenario:

**Card Transaction + Notification:**
```
U → "Foreground vs background — different notification experience?"
L → "Sub-second delivery from card tap?"
E → "Amount can change? (tips, hotels)"
S → "Mobile architecture, or include Kafka event flow?"
S → "Multi-currency — show both amounts?"
```

**3DS Authentication:**
```
U → "Push notification → approve in app? Or also support SMS OTP fallback?"
L → "What's the expiry window — 5 minutes?"
E → "What if the phone is offline when push arrives?"
S → "Should I design the full flow or focus on the mobile approval screen?"
S → "Should approval require biometric auth?"
```

**Card Ordering:**
```
U → "Virtual and physical? Different flows after confirmation?"
L → "Virtual card — instantly available or activation delay?"
E → "What if delivery address is invalid? What if user cancels midway?"
S → "Should I include Apple Wallet integration?"
S → "Different address fields per country — Dynamic Forms?"
```

**Bill Split:**
```
U → "Split with Wise users only, or non-Wise users too?"
L → "Real-time tracking when friends pay?"
E → "What if someone declines? What about rounding?"
S → "Equal split only or also custom amounts?"
S → "Should non-Wise users pay via link? Any fees?"
```

**Recurring Payments:**
```
U → "Detect automatically or user tags them manually?"
L → "Notify before each charge?"
E → "What if amount varies slightly each month (usage-based)?"
S → "Just display, or also allow blocking merchants?"
S → "Spend controls integration?"
```

**Dispute / Chargeback:**
```
U → "What dispute reasons do we support?"
L → "How quickly should provisional credit appear?"
E → "What if the customer uploads evidence and goes offline?"
S → "Should I include the tracking flow or just the filing flow?"
S → "Any regulatory timeline requirements? (120 days?)"
```

---

## The 3 Questions That Work for ANY Scenario

If you blank on what to ask, these always work:

**1.** > "What does the customer see step by step — can you walk me through the user journey?"

Shows product thinking. Gets them talking so you understand the full flow.

**2.** > "What's the most critical non-functional requirement — speed, reliability, or consistency?"

Shows you think about trade-offs. Their answer guides your architecture.

**3.** > "Should I start with the happy path and handle edge cases after, or do you want me to cover error handling upfront?"

Shows you manage scope. Answer is always "happy path first" — but asking demonstrates maturity.

---

## What to SAY After They Answer:

> "Great, that helps me scope this. Let me start with the customer journey, then I'll design the VIPER architecture that makes it happen."

**Then go straight into your user journey → high-level flow → VIPER module.** Don't ask more than 3 questions — spending 5 minutes on questions without drawing anything is worse than starting with 2 good questions and adapting as you go. 🚀
