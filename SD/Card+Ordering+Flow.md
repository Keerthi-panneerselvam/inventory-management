## Card Ordering Flow — Memorize This Answer

### If they ask: "Design the card ordering experience"

**Opening (10 seconds):**
> "Card ordering has two completely different paths that diverge after the user selects their card type. Virtual cards are instant — the user has a usable card within 30 seconds, ready for online purchases and Apple Pay. Physical cards take days — printing, shipping, delivery, activation. The mobile architecture needs to handle both flows cleanly."

**User Journey (30 seconds):**
> "Virtual path: Customer opens the Card tab, taps 'Get a card', selects Virtual, reviews the details — it's free, instantly available. Confirms with Face ID. Immediately sees their card number, expiry, and CVV on screen. Taps 'Add to Apple Wallet' — now they can tap-to-pay anywhere with Apple Pay. The whole thing takes 30 seconds.
>
> Physical path: Customer selects Physical, enters their delivery address — this is a Dynamic Form that varies by country because different countries need different address formats. Reviews the order — S$5 fee, estimated delivery 7-10 business days. Confirms with Face ID. Sees a tracking screen: Ordered → Printed → Shipped → Delivered. Gets push notifications at each stage. When the card arrives, they activate it by entering the last 4 digits."

**Clarifying Questions (pick 3):**
> "Can users have multiple cards — say a physical and a virtual simultaneously?"
> "Is virtual card instantly usable, or is there an activation step?"
> "Does the address form vary by country — are you using Dynamic Forms?"
> "Should I include Apple Wallet integration for virtual cards?"
> "Is there a fee for physical cards? Does it vary by country?"
> "What about card replacement — lost or stolen cards?"

**High-Level Flow (30 seconds):**
> "Backend has three APIs. POST cards/order to create the order — takes card type, variant, address, and an idempotency key. GET cards/{id}/status for tracking — returns current status in the pipeline. POST cards/{id}/activate for physical card activation.
>
> For the address form, a Dynamic Forms API — GET forms/card-order/{country} — returns the field definitions for that country. The mobile doesn't hardcode address fields. The backend says 'UK needs postcode, Germany needs PLZ, India needs PIN code, US needs ZIP + state' — and the mobile renders whatever it receives.
>
> Push notification service sends status updates at each stage — ordered, printed, shipped, delivered. Each triggers a push to the customer's device with a deep link to the tracking screen."

**Mobile Architecture — VIPER with Coordinator (90 seconds):**
> "This is a multi-step flow, so I use a Coordinator pattern on top of VIPER. Each step is an independent VIPER module. The Coordinator manages shared state across steps and controls the flow direction — including the critical branching point where virtual skips the address step.
>
> The **Coordinator** holds three pieces of shared state: selected card type, selected variant, and delivery address. It has the flow logic: if virtual, skip from card type selection directly to review. If physical, go through the address step. It also handles cancellation — if the user taps back at any point, the Coordinator can discard the partial order.
>
> **Step 1 — CardTypeModule.** The View shows card options — virtual or physical, debit or prepaid — with visual previews of each card design. The Interactor fetches available card types for the user's country — not all types are available everywhere. The Presenter formats pricing: 'Virtual — Free' or 'Physical — S$5'. The Router delegates the selection to the Coordinator, which decides the next step.
>
> **Step 2 — DeliveryAddressModule (physical only).** This is where Dynamic Forms shines. The Interactor fetches the form schema from the backend for the user's country. The View renders the fields dynamically — text inputs, dropdowns, postal code formatters — all defined by the backend. The Interactor validates the address via an address validation API before proceeding. The Presenter shows field-level errors inline: 'Invalid postcode format'. The Router delegates to the Coordinator on success.
>
> **Step 3 — ReviewOrderModule.** The View shows the complete summary — card type, card design preview, delivery address if physical, fee, estimated delivery date. The Presenter calculates everything for display. The Interactor handles the final submission: biometric auth with Face ID first, then POST to the cards/order API with an idempotency key — UUID stored locally so retries don't create duplicate cards.
>
> **Step 4 — ConfirmationModule.** This is where the two paths diverge most. For virtual: the Interactor receives the card details from the API response — card number, expiry, CVV. The Presenter formats them with spacing — '4532 •••• •••• 7890'. The View shows the card with a prominent 'Add to Apple Wallet' button. I use PassKit's In-App Provisioning API — Wise's backend provides encrypted card data, PassKit handles the rest. For physical: the View shows the tracking timeline. The Interactor starts polling for status updates every 60 seconds, and also handles push notifications for status changes."

**Dynamic Forms — Deep Dive (30 seconds):**
> "Dynamic Forms is one of Wise's smartest architectural decisions. Instead of hardcoding address fields per country in the app — which means an app update every time a country changes its requirements — the backend defines the form structure and the mobile renders it natively.
>
> The backend returns a JSON array of field definitions: field ID, label, type — text, dropdown, phone, postal code — whether it's required, a regex validation pattern, dropdown options if applicable, and placeholder text. The mobile iterates through the fields and renders the appropriate UI component for each type.
>
> This means adding a new country's address format is a backend config change, not an app release. For Wise operating in 40+ countries where regulatory requirements change frequently, this is essential. At PayPal, I worked with a similar pattern for BFX where server-driven config controls which countries get which features — the principle is identical."

**Apple Wallet Integration (20 seconds):**
> "For virtual cards, Apple Wallet integration is the magic moment. The user orders a card and 30 seconds later can tap-to-pay at any store with Apple Pay. I'd use PassKit's `PKAddPaymentPassViewController` for In-App Provisioning. The flow: user taps 'Add to Apple Wallet', the app requests encrypted card data from Wise's backend, PassKit handles the provisioning, and the card appears in the Wallet app. For physical cards, once activated, we can also add them to Apple Wallet for tap-to-pay via NFC."

**Card Tracking — Physical Cards (20 seconds):**
> "For physical cards, I poll the status API every 60 seconds while the user is on the tracking screen. I also handle push notifications for status transitions — ordered, printed, shipped, delivered. Each push deep-links to the tracking screen.
>
> The tracking timeline shows all steps with checkmarks for completed steps, a highlighted current step, and greyed-out future steps. Estimated delivery date updates as the card progresses — initially '7-10 business days', then 'Arriving by March 15', then 'Delivered today'.
>
> When status reaches 'delivered', I show the activation prompt: 'Card arrived? Enter the last 4 digits to activate.' After activation, the card is live — enable spend controls, offer Apple Wallet, show the card in the main tab."

**Card Activation (15 seconds):**
> "Two activation methods. Primary: the user enters the last 4 digits of the physical card number — simple, works always. Secondary: scan the card using the camera with Vision framework for OCR — reads the card number automatically. I'd default to manual entry because it's faster, but offer camera scan for users who prefer it. After activation, the Interactor calls the activate API, and the Presenter shows a celebration animation — confetti or a checkmark — before navigating to the main card screen."

**Trade-offs (30 seconds):**
> "Coordinator versus single ViewModel — I use a Coordinator because the flow has conditional steps and shared state across screens. A single ViewModel managing 4 screens would become a massive ViewModel. Each VIPER module stays focused on its one step, and the Coordinator handles orchestration.
>
> Dynamic Forms versus hardcoded forms — Dynamic Forms adds rendering complexity on the mobile side, but eliminates app updates for regulatory changes. For a fintech in 40+ countries, the trade-off is clearly worth it. I'd hardcode forms only if we had fewer than 5 countries with stable requirements.
>
> Polling versus push for tracking — I use both. Push for real-time status transitions. Polling every 60 seconds as a fallback when the user is actively watching the tracking screen. Card status changes happen over days, not seconds, so 60-second polling is more than sufficient. When the user leaves the tracking screen, polling stops — Task cancellation handles this automatically."

**Production Concerns (15 seconds):**
> "Idempotency on card ordering is critical — a duplicate order means a second card shipped, which is a real cost and a customer support issue. I generate a UUID as the idempotency key, store it locally before the API call, and include it in the request header.
>
> Monitoring: card order success rate, time from order to activation for physical cards, virtual card Apple Wallet adoption rate — how many users add to Wallet immediately, and card type distribution — if 90% choose virtual, maybe physical cards should be deprioritized.
>
> Feature flags: I'd wrap the entire card ordering flow behind a flag. Roll out virtual cards first since they're lower risk — instant, no shipping. Then enable physical cards once the fulfillment pipeline is validated. Country-by-country rollout — exactly how I manage BFX at PayPal."

**Wise Connection (10 seconds):**
> "This maps directly to my BFX experience — phased country-by-country rollouts with monitoring at each stage. The Dynamic Forms pattern is what BFX uses for enabling different card configurations per country. And the multi-step Coordinator pattern is how I structured the Express Checkout Native flow at PayPal — multiple VIPER screens with shared state and conditional navigation."

**When They Add Requirements:**

| They Say | Your Answer |
|----------|------------|
| "Add card replacement" | "New Coordinator entry point. User selects reason — lost, stolen, damaged. If stolen, freeze old card immediately. Reuse address module if same address, or let them enter new one. Skip type selection — replacement is same type. Ship replacement, deactivate old card automatically on activation of new one." |
| "Add card customization" | "New VIPER module between type selection and review. Backend provides available designs — colors, patterns, custom name. Preview shows the card with user's name overlaid in real-time. Store selection in Coordinator state. This is a great candidate for A/B testing — which designs do users pick most?" |
| "What about multiple cards?" | "Card list screen as the entry point — shows all active cards with status. 'Add new card' button at the bottom. Each card is independent — own spend controls, own freeze state, own tracking. The Router navigates to the appropriate card detail. The backend returns an array of cards, each with their own ID and status." |

---

### The 6 Key Phrases to Memorize:

```
1. "Two paths diverge — virtual is instant with Apple Wallet, 
    physical needs tracking and activation."

2. "Coordinator pattern — each step is independent VIPER module, 
    Coordinator holds shared state and controls flow branching."

3. "Dynamic Forms — backend defines address fields per country, 
    mobile renders natively. No app update for regulatory changes."

4. "Idempotency key on card order — UUID prevents duplicate cards 
    on network retry. A duplicate order = real cost."

5. "Apple Wallet via PassKit In-App Provisioning — 
    user has tap-to-pay within 30 seconds of ordering."

6. "Virtual cards first, physical second — lower risk rollout. 
    Country-by-country with monitoring. Same as BFX."
```

### Quick Drawing to Practice (draw in 3 min):

```
CardOrderCoordinator
│
├── Step 1: CardTypeModule
│   "Virtual or Physical?"
│   ├── Virtual → skip to Step 3
│   └── Physical → Step 2
│
├── Step 2: DeliveryAddressModule (physical only)
│   Dynamic Forms — backend sends fields per country
│   Address validation API
│
├── Step 3: ReviewOrderModule
│   Summary + fee + delivery estimate
│   Biometric auth → Submit with idempotency key
│
└── Step 4: ConfirmationModule
    ├── Virtual: Card details + "Add to Apple Wallet" (PassKit)
    └── Physical: Tracking timeline + push notifications
                  Ordered → Printed → Shipped → Delivered
                  Activate: enter last 4 digits
```

### Edge Cases to Mention (if they probe):

```
"What if address validation fails?"
→ Show inline field errors. Don't proceed until valid.
  Offer address suggestions from the validation API.

"What if card order API fails after biometric auth?"
→ Idempotency key is already generated and stored locally.
  Show error with retry button. Retry sends same idempotency key.
  Safe — backend won't create duplicate.

"What if user cancels midway?"
→ Coordinator discards shared state. No API calls made yet 
  (order only submitted at Step 3). Clean exit, no orphaned data.

"What if virtual card details fail to load?"
→ Card IS created on backend. Show: "Card created! Details loading..."
  Retry fetching details. They can always see details later 
  in the card detail screen.

"What if Apple Wallet provisioning fails?"
→ Card still works for online purchases (show card number in app).
  Show: "Couldn't add to Wallet. Try again in Settings."
  Not a blocking error — just a convenience feature that failed.

"What about card expiry and renewal?"
→ Push notification 30 days before expiry: "Your card expires soon."
  Auto-renewal: new card shipped to same address.
  Virtual: new card details generated automatically, 
  Apple Wallet updated via PassKit background refresh.
```

**Practice saying the full answer out loud 3 times. Target: under 4 minutes for the core answer (opening through VIPER). Add trade-offs and extras only if they ask.** 🚀
