## Bill Split — Memorize This Answer

### If they ask: "Design a bill splitting feature for the Wise card"

**Opening (10 seconds):**
> "Bill split lets a customer share the cost of a card transaction with friends. The core challenge isn't the UI — it's the financial precision. You can never create or lose money through rounding. And you need two completely different payment flows depending on whether the friend has Wise or not."

**User Journey (30 seconds):**
> "Customer just paid S$100 at a restaurant. They open the transaction in the Wise app and tap 'Split this bill'. They add 3 friends — two are Wise users found by phone number, one isn't. They choose equal split. The app shows: S$25.00 each for all four people including themselves. They confirm with Face ID. The two Wise friends get push notifications: 'Pay S$25 for dinner at Restaurant XYZ' — they tap and pay instantly, free. The non-Wise friend gets an SMS with a payment link — they pay by card on a web page. The original customer sees a progress tracker: '1 of 3 friends have paid'. Push notification each time someone pays. When all three pay, the split is marked complete."

**Clarifying Questions (pick 3):**
> "Can users split with non-Wise users too, or only Wise-to-Wise?"
> "Equal split only, or also custom amounts and percentages?"
> "What about rounding — S$100 split 3 ways gives 33.333 repeating?"
> "Can the split be modified after sending — what if someone declines?"
> "Is there a time limit for friends to pay their share?"
> "Can users split any transaction, or only certain categories like restaurants?"

**High-Level Flow (30 seconds):**
> "Backend has three APIs. POST splits to create a split — takes the transaction ID, list of participants with amounts, and split type. GET splits/{id} to check status — who's paid, who's pending. POST splits/{id}/pay for a participant to pay their share.
>
> When a split is created, the backend handles the notification routing. For Wise users — push notification with a deep link to the payment approval screen, free instant balance transfer. For non-Wise users — SMS or WhatsApp with a payment link leading to a web page where they pay by card. The web payment has a processing fee — the Presenter should show this upfront so the original payer knows.
>
> Push notification service sends updates when each participant pays: 'John paid S$25 — 2 of 3 friends have paid.'"

**Mobile Architecture — VIPER with Coordinator (90 seconds):**
> "Multi-step flow, so Coordinator with 5 VIPER modules.
>
> The **Coordinator** holds shared state: the original transaction, selected participants, split type, and calculated amounts. It manages the flow: some users might enter from the transaction detail screen — skip transaction selection. It also handles re-entry — if the user comes back to check the tracking, the Coordinator routes directly to the tracking module.
>
> **Step 1 — SelectTransactionModule.** Only needed if the user didn't tap from a specific transaction. The View shows recent transactions that are eligible for splitting — completed status, recent date, typical split categories like restaurants, bars, entertainment. The Interactor filters eligible transactions. Skip this step entirely if launched from a transaction detail — the Coordinator already has the transaction.
>
> **Step 2 — AddParticipantsModule.** The View shows a contact picker — search by name, phone, or email. The Interactor resolves each contact: is this a Wise user? It calls the Wise user lookup API with the phone number or email. The Presenter displays the result differently: 'John (Wise) — Free & instant' with a green checkmark versus 'Alice (SMS) — Via payment link' with a link icon. This is important because the user should know upfront which friends will pay for free and which might have a processing fee.
>
> **Step 3 — SetAmountsModule.** This is where the financial precision matters. The View shows three split types: equal, custom amounts, and percentage. For equal split, the Interactor calculates shares using my rounding-safe algorithm. For custom, the user enters each person's amount manually — the Interactor validates the total matches the original amount exactly. For percentage, the user assigns percentages that must sum to 100%. The Presenter always shows a total validation line at the bottom: 'Total: S$100.00 ✓' — confirming no money is lost or created.
>
> **Step 4 — ReviewAndSendModule.** The View shows the complete summary: transaction details, each participant with their amount and payment method. The Interactor handles submission: biometric auth first, then POST to the splits API. Idempotency key prevents duplicate split requests on network retry.
>
> **Step 5 — TrackingModule.** The View shows a progress bar — '2 of 3 friends have paid' — with each participant's status: paid with timestamp, pending, or declined. The Interactor polls for updates and handles push notifications. The Router deep-links from push notifications — 'John just paid' → open tracking for this specific split."

**The Rounding Problem — The Hard Part (40 seconds):**
> "This is the critical fintech detail that separates a good answer from a great one. The rule: never create or lose money through rounding.
>
> S$100 split 3 ways. Naive division gives 33.333 repeating. If I round each to 33.33, the total is 99.99 — I've lost a cent. If I round up to 33.34, the total is 100.02 — I've created 2 cents out of thin air. Both are unacceptable in fintech.
>
> My algorithm: N minus 1 people pay the rounded amount. The last person pays the remainder. So S$100 split 3 ways: first person pays 33.33, second person pays 33.33, third person pays 33.34. Total is exactly 100.00. No money created, no money lost.
>
> For the rounding itself, I use banker's rounding — NSDecimalRound with the .bankers mode. This rounds 0.5 to the nearest even number, which eliminates systematic rounding bias over many transactions. It's the standard in financial software.
>
> A harder example: S$100 split 7 ways. Raw share is 14.285714... Rounded: 14.29. Six people pay 14.29 = 85.74. Last person pays 100 - 85.74 = 14.26. Total: exactly 100.00. The last person pays slightly less — that's the trade-off, and it's the standard approach across all fintech bill-splitting products."

```swift
class BillSplitCalculator {
    
    func splitEqually(amount: Decimal, participantCount: Int) -> [Decimal] {
        guard participantCount > 0 else { return [] }
        
        let rawShare = amount / Decimal(participantCount)
        let roundedShare = roundToTwo(rawShare)
        
        // N-1 people pay rounded amount
        let othersTotal = roundedShare * Decimal(participantCount - 1)
        
        // Last person pays remainder — absorbs rounding
        let lastShare = amount - othersTotal
        
        var shares = Array(repeating: roundedShare, count: participantCount - 1)
        shares.append(lastShare)
        return shares
        // S$100 ÷ 3 = [33.33, 33.33, 33.34] → total = 100.00 ✅
        // S$100 ÷ 7 = [14.29, 14.29, 14.29, 14.29, 14.29, 14.29, 14.26] → total = 100.00 ✅
    }
    
    func splitByPercentage(amount: Decimal, percentages: [Decimal]) -> [Decimal] {
        var shares = percentages.map { roundToTwo(amount * $0) }
        // Adjust last share for rounding
        let sharesTotal = shares.dropLast().reduce(Decimal.zero, +)
        shares[shares.count - 1] = amount - sharesTotal
        return shares
    }
    
    func validateCustomSplit(amount: Decimal, shares: [Decimal]) -> Bool {
        shares.reduce(Decimal.zero, +) == amount  // Must match exactly
    }
    
    private func roundToTwo(_ value: Decimal) -> Decimal {
        var result = value
        var rounded = Decimal()
        NSDecimalRound(&rounded, &result, 2, .bankers)
        return rounded
    }
}
```

**Wise-to-Wise vs Non-Wise Users (30 seconds):**
> "Two completely different payment flows, and the user should know the difference upfront.
>
> Wise-to-Wise: the friend gets a push notification — 'Pay S$25 for dinner at XYZ'. They tap it, the app opens to a confirmation screen showing the split details, they tap Pay, and it's an instant balance transfer. Free, no fees. The original payer sees the status update within seconds.
>
> Non-Wise: the friend gets an SMS or WhatsApp message with a payment link — 'You owe S$25 for dinner at XYZ. Pay here: wise.com/pay/abc123'. They tap the link, enter their card details on a web page, and pay. This goes through card processing, so there may be a fee. The original payer sees the status update after the card payment clears — could take seconds or minutes depending on the payment method.
>
> The Presenter formats the participant list to show this difference clearly: 'John (Wise) — Free & instant' versus 'Alice (SMS) — Via payment link'. The user shouldn't be surprised when one friend pays instantly and another takes longer."

**Tracking and Notifications (20 seconds):**
> "The tracking module shows a progress bar and per-participant status. I'd design it as a real-time updating list:
>
> '2 of 3 friends have paid' — progress bar at 66%.
>
> John — S$25.00 — Paid ✅ (2 min ago)
> Alice — S$25.00 — Paid ✅ (just now)
> Bob — S$25.00 — Pending ⏳
>
> Push notification when each person pays: 'Alice paid S$25 — 2 of 3 friends have paid for dinner at XYZ.' The notification deep-links to this specific split's tracking screen.
>
> When all friends pay, the split status changes to Complete. Celebration animation — confetti or a checkmark. The tracking screen becomes a receipt: 'Bill split complete — S$75 collected from 3 friends.'"

**Trade-offs (20 seconds):**
> "Equal split as default versus requiring the user to choose — I'd default to equal split with the option to customize. Most restaurant splits are equal. Forcing the user to choose a split type every time adds friction to the most common case.
>
> Rounding assignment — last person pays the remainder versus distributing the difference randomly. Last person is simpler and deterministic. Random distribution is 'fairer' but harder to debug and explain. I'd go with last person — the difference is at most 1 cent, and predictability matters more than perfect fairness in this context.
>
> Include the original payer in the split or not — I'd include them by default. If 4 people eat dinner and the bill is S$100, each person owes S$25 — including the one who paid. The split sends requests for S$25 to 3 friends. The payer's share is implicit — they already paid the full amount and are getting S$75 back. The UI should make this clear: 'Your share: S$25 (already paid)'."

**Production Concerns (15 seconds):**
> "Monitoring: split completion rate — what percentage of splits get fully paid? Average time to full payment. Drop-off in the add-participants step — if users frequently abandon, the UX needs work. Wise-to-Wise versus external payment ratio — tells us how many users have friends on Wise.
>
> Feature flags: roll out bill split behind a flag. Start with Wise-to-Wise only — simpler, free, instant. Add non-Wise support in phase 2 once the core flow is validated. Country-by-country because payment links may need different payment methods per region.
>
> Security: biometric auth before sending split requests — you're initiating payment requests on behalf of the user. Idempotency key on split creation. Rate limiting — can't create 100 splits per minute."

**Wise Connection (10 seconds):**
> "This combines patterns from my PayPal work. The multi-step Coordinator is how I structured Express Checkout. The Wise-to-Wise versus external split maps to how PayPal handles PayPal-to-PayPal versus card payments — different processing paths, different fees, different timelines. And the rounding precision is the same discipline I apply at BFX — every Decimal calculation at PayPal follows the same 'never lose a cent' rule."

**When They Add Requirements:**

| They Say | Your Answer |
|----------|------------|
| "What if someone declines?" | "Show declined status on that participant. Original payer gets 3 options: resend the request, remove them and redistribute their share among remaining participants, or absorb their share personally. If redistributing, the Interactor recalculates using the same rounding-safe algorithm. Push notification to remaining participants if their amount changes." |
| "Add recurring splits" | "New feature: 'Split like last time'. After completing a split, offer to save it as a template — same friends, same percentages. Next time at the same merchant, suggest: 'Split with John, Alice, and Bob again?' One tap to recreate. Store templates locally with the merchant ID as key." |
| "What about different currencies?" | "If a friend's balance is EUR and the split is in SGD, we need FX conversion. Show both amounts: 'Alice owes S$25.00 (€16.50)'. Lock the rate at split creation time, not payment time — otherwise amounts keep changing as rates fluctuate. The friend sees their amount in their own currency. This is exactly the multi-currency display pattern from BFX." |
| "What if the original payer wants to change amounts after sending?" | "Allow modification only for participants who haven't paid yet. Show paid participants as locked. Recalculate remaining amounts. Send updated notification to pending participants: 'Your share changed from S$25 to S$30'. This is why I use a Coordinator — it manages the state transitions for partial modifications." |
| "Add expense history" | "New VIPER module — SplitHistoryModule. List all past splits grouped by month. Total collected, total outstanding. Filter by: complete, pending, has declined. Tap a split → open its tracking view. 'You've collected S$450 from 12 splits this month.' Good for users who regularly dine out with friends." |

---

### The 6 Key Phrases to Memorize:

```
1. "Never create or lose money through rounding. N-1 people pay 
    rounded share, last person pays the remainder. Total is always exact."

2. "Two payment flows — Wise-to-Wise is free and instant via push. 
    Non-Wise gets an SMS payment link with possible processing fee."

3. "Banker's rounding — NSDecimalRound with .bankers mode. 
    Standard in financial software. Eliminates systematic rounding bias."

4. "Show the difference upfront — 'John (Wise) — Free & instant' 
    versus 'Alice (SMS) — Via payment link'. No surprises."

5. "Progress tracker: '2 of 3 friends have paid' with push 
    notification each time someone pays."

6. "Default to equal split — most common case. Custom and 
    percentage as options. Always show total validation line."
```

### Quick Drawing to Practice (draw in 3 min):

```
BillSplitCoordinator
│
├── Step 1: SelectTransaction (skip if from detail screen)
│
├── Step 2: AddParticipants
│   Search by phone/email → Wise user lookup API
│   Show: "John (Wise) — Free" vs "Alice (SMS) — Link"
│
├── Step 3: SetAmounts
│   Equal / Custom / Percentage
│   ROUNDING: [33.33, 33.33, 33.34] = 100.00 ✅
│   Always show "Total: S$100.00 ✓"
│
├── Step 4: ReviewAndSend
│   Biometric auth → POST /splits with idempotency key
│
└── Step 5: Tracking
    "2 of 3 friends have paid" [████████░░░] 66%
    Push notification per payment
    
    Wise user flow:     Push → Tap → Instant payment ✅
    Non-Wise user flow: SMS → Link → Card payment → Delayed ✅
```

### Edge Cases to Mention (if they probe):

```
"S$1 split 3 ways?"
→ [0.33, 0.33, 0.34]. Total = 1.00.
  Last person pays 1 cent more. Still correct.

"What if the transaction amount changes after splitting?"
→ Pending authorization (like restaurant tip added later).
  Don't allow splitting pending transactions — only completed.
  Eligibility check catches this.

"What if ALL friends decline?"
→ Split status → Cancelled. Original payer keeps full amount.
  Show: "All friends declined. Bill split cancelled."

"What if a friend pays MORE than their share?"
→ Backend validates: payment amount must match the assigned share.
  Reject overpayment. The friend can only pay the exact amount.

"What if the original payer leaves the app during split creation?"
→ No API call made until Step 4 (ReviewAndSend).
  Coordinator state is in memory — lost if app is killed.
  For long forms, I'd save draft to local storage.
  But bill split is fast enough that drafts aren't needed.

"What about group payments where everyone pays their own item?"
→ That's itemized splitting — more complex.
  I'd start with equal/custom/percentage for MVP.
  Itemized requires receipt scanning (OCR) — Phase 2 feature.
  Mention it as a future enhancement to show product thinking.
```

**Practice saying the full answer out loud 3 times. Target: under 4 minutes for the core answer. The rounding explanation should take exactly 40 seconds — practice this section separately because interviewers WILL ask about it.** 🚀
