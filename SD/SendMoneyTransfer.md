## Send Money Transfer — Memorize This Answer

### If they ask: "How would you architect the international money transfer feature?"

**Opening (10 seconds):**
> "Money transfer is Wise's core product. The mobile architecture needs to handle a multi-step flow with real-time rate quoting, a 30-second rate guarantee window, multiple payment methods, and idempotent transaction submission. The critical technical challenge is the rate — it's constantly changing, and the user needs to see an accurate quote that's guaranteed when they confirm."

**User Journey (20 seconds):**
> "Customer opens Wise, enters £1000 as the send amount. Within 500 milliseconds of them stopping typing, the app shows the live quote: 'They receive €1,155.23, fee £3.69, rate 1 GBP = 1.1590 EUR'. A 30-second countdown starts. They select a saved recipient — or add a new one with bank details that vary by country. They pick a payment method — bank transfer is cheapest, card is instant but has a higher fee. They review the summary, confirm with Face ID, and see a tracking screen: Created → Processing → Sent → Delivered. Push notification when the money arrives."

**Clarifying Questions (pick 3):**
> "What's the rate guarantee window — 30 seconds from Wise's actual product?"
> "Should the quote auto-refresh when it expires, or require a manual tap?"
> "Are recipient bank details different per country — UK sort code, EU IBAN, India IFSC?"
> "Should I design for offline draft saving — resume a transfer later?"
> "What payment methods are available — bank transfer, card, Apple Pay?"

**High-Level Flow (30 seconds):**
> "The backend has four main APIs. First, a quote API — takes source currency, target currency, and amount, returns the rate, fee, converted amount, and an expiry timestamp. The quote has its own UUID — when the user confirms, we send this quote ID, and the server validates that specific quote hasn't expired.
>
> Second, a recipients API — CRUD operations on saved recipients. The recipient form is country-specific — UK needs sort code and account number, Europe needs IBAN, India needs IFSC code. This is Dynamic Forms — the backend sends the field structure per country.
>
> Third, a transfers API — POST to create a transfer with the quote ID, recipient ID, payment method, and an idempotency key. The server validates the quote, checks the balance, runs compliance checks, and creates the transfer.
>
> Fourth, a transfer status API — GET to poll for updates, or push notifications for status transitions: created, payment received, converting, sending, delivered."

**Mobile Architecture — VIPER with Coordinator (90 seconds):**
> "Multi-step flow with 5 screens, so a Coordinator manages the navigation and shared state.
>
> The **Coordinator** holds: the current quote, selected recipient, selected payment method, and the idempotency key. It controls the flow direction and handles the rate expiry — if the quote expires at any step, the Coordinator shows an alert and refetches the quote without losing the user's other selections.
>
> **Step 1 — AmountInputModule.** This is where the debounce pattern lives. The Interactor watches the amount input with a 500ms debounce — when the user stops typing, it calls the quote API. The Repository checks the cache first — if there's a valid quote for the same amount and currency pair within the 30-second TTL, return it immediately without a network call. The Presenter formats the quote for display: 'They receive €1,155.23' with the fee breakdown and a countdown timer showing seconds until the quote expires. When the timer hits zero, the Interactor auto-fetches a new quote. The View shows the countdown and greying out the Continue button during refresh.
>
> **Step 2 — RecipientModule.** The Interactor loads saved recipients from local encrypted storage for instant display, then refreshes from the API in background. Search and filter by name. The 'Add new recipient' flow uses Dynamic Forms — the backend sends the field structure for the target country. UK shows sort code and account number. Europe shows IBAN. India shows IFSC and account number. The mobile renders whatever the backend defines — no app update needed when a country changes its banking format.
>
> **Step 3 — PaymentMethodModule.** The Interactor fetches available payment methods for this transfer. The Presenter shows each option with its fee and speed: 'Bank transfer — £0.00 fee, arrives in 1-2 days' versus 'Debit card — £1.50 fee, arrives instantly'. The user picks based on their priority — cost versus speed. If they choose card, the Interactor handles card tokenization via a secure SDK — the card number never touches our servers.
>
> **Step 4 — ReviewModule.** The View shows the complete summary — amount, recipient, payment method, fee, rate, delivery estimate. The Presenter shows a countdown timer for the rate guarantee. If the rate expires while the user is reviewing, the Interactor auto-refetches and the Presenter updates the amounts — the View shows a brief 'Rate updated' animation. On confirmation: biometric auth first, then POST to the transfers API with the quote ID and idempotency key. The idempotency key is a UUID generated and stored locally — if the network drops and the user retries, the server recognizes the duplicate and returns the same transfer.
>
> **Step 5 — TrackingModule.** The Interactor polls every 5 seconds while the user is on this screen. Status transitions: Created → Payment Received → Converting → Sending → Delivered. Push notifications at each transition with deep links back to this screen. When the status reaches Delivered, show a celebration animation and the final amount the recipient received."

**The Debounce Pattern — Deep Dive (30 seconds):**
> "The debounce is critical for the amount input. When the user types '1000', that's four keystrokes — 1, 10, 100, 1000. Without debouncing, we'd fire four API calls. Three are wasted — only the final one matters.
>
> I use a Task-based debounce: each keystroke cancels the previous Task, starts a new one with a 500ms sleep. If the user types another character within 500ms, the old Task is cancelled and a new one starts. Only when 500ms of silence passes does the API call fire.
>
> Combined with caching: if the user types 1000, gets a quote, then changes to 1001, the cache miss triggers a new API call. But if they delete back to 1000, the cached quote is still valid within the 30-second TTL — no API call needed. This reduces unnecessary network traffic significantly."

```swift
class AmountInputInteractor: AmountInputInteractorProtocol {
    weak var output: AmountInputInteractorOutput?
    private let rateRepository: RateRepositoryProtocol
    private var debounceTask: Task<Void, Never>?
    
    func onAmountChanged(_ text: String) {
        debounceTask?.cancel()
        
        guard let amount = Decimal(string: text), amount > 0 else {
            output?.didClearQuote()
            return
        }
        
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000) // 500ms
            guard !Task.isCancelled else { return }
            await fetchQuote(amount: amount)
        }
    }
    
    private func fetchQuote(amount: Decimal) async {
        output?.didStartLoading()
        do {
            let quote = try await rateRepository.getQuote(
                amount: amount, from: "GBP", to: "EUR"
            )
            await MainActor.run { output?.didFetchQuote(quote) }
        } catch {
            await MainActor.run { output?.didFailQuote(error) }
        }
    }
}
```

**Rate Expiry Handling (20 seconds):**
> "The rate guarantee window is the most critical design decision for this feature. Wise guarantees the quoted rate for approximately 30 seconds. If the user takes longer than 30 seconds between getting the quote and confirming, the rate might have changed.
>
> I handle this at two levels. Client-side: the Presenter shows a countdown timer. When it hits zero, the Interactor auto-fetches a new quote and the UI updates smoothly — the user sees the new rate without losing their progress. Server-side: even if the client's clock is wrong, the server validates the quote ID at confirmation time. If the quote has expired server-side, it returns an error and the mobile shows 'Rate updated — please review the new amount' with the fresh quote.
>
> This is exactly what I work on at PayPal with BFX. The rate guarantee window is the most important business parameter — too short and users get frustrated re-confirming, too long and Wise absorbs the FX risk. I'd ask the product team what Wise's optimal window is."

**Idempotency — The Transfer Confirmation (20 seconds):**
> "Transfer confirmation must be idempotent. Here's the scenario: user taps Confirm, the request is sent, but the network drops before the response arrives. The user sees no confirmation. They tap Confirm again. Without idempotency, Wise creates two transfers — sending the money twice.
>
> My approach: generate a UUID as the idempotency key before the first attempt. Store it locally. Include it in the request header. If the user retries — same key, same request — the server recognizes the duplicate and returns the original transfer. The money moves once, not twice.
>
> In fintech, this is non-negotiable. The consequence of a missing idempotency key is sending someone's money twice — that's a customer support nightmare and a potential regulatory issue."

```swift
class TransferConfirmInteractor: TransferConfirmInteractorProtocol {
    weak var output: TransferConfirmInteractorOutput?
    private let apiClient: TransferAPIClientProtocol
    private let biometricAuth: BiometricAuthProtocol
    private let idempotencyStore: IdempotencyStoreProtocol
    
    func confirmTransfer(quote: TransferQuote, recipientId: String, 
                         paymentMethod: PaymentMethod) {
        Task {
            // Step 1: Client-side quote expiry check
            guard !quote.isExpired else {
                await MainActor.run { output?.didExpireQuote() }
                return
            }
            
            // Step 2: Biometric auth
            guard try await biometricAuth.authenticate(
                reason: "Confirm transfer of \(quote.sourceAmount) \(quote.sourceCurrency)"
            ) else {
                await MainActor.run { output?.didCancelAuth() }
                return
            }
            
            // Step 3: Get or create idempotency key
            let idempotencyKey = idempotencyStore.getOrCreate(
                for: "\(quote.id)-\(recipientId)"
            )
            
            // Step 4: Submit transfer
            do {
                let transfer = try await apiClient.createTransfer(
                    quoteId: quote.id,
                    recipientId: recipientId,
                    paymentMethod: paymentMethod,
                    idempotencyKey: idempotencyKey
                )
                await MainActor.run { output?.didCreateTransfer(transfer) }
            } catch {
                await MainActor.run { output?.didFailTransfer(error) }
            }
        }
    }
}
```

**Status Tracking — Poll vs WebSocket (20 seconds):**
> "I'd start with polling every 5 seconds for transfer status. WebSocket is more real-time but adds complexity — connection management, reconnection logic, and iOS background/foreground handling.
>
> Transfer status changes on a minutes-to-hours timescale — Created, then Payment Received after the user's bank processes the debit, then Converting which takes seconds, then Sending which depends on the destination country's banking system, then Delivered. The gaps between transitions are minutes to hours, not milliseconds. Polling every 5 seconds is more than sufficient and much simpler.
>
> I also handle push notifications for each transition. Push is complementary to polling — push for when the user isn't on the tracking screen, polling for real-time updates when they are. The push deep-links to the tracking screen for that specific transfer.
>
> Task-based polling with cancellation: when the user leaves the tracking screen, the polling Task is automatically cancelled. No orphaned background network calls."

```swift
class TransferTrackingInteractor: TransferTrackingInteractorProtocol {
    weak var output: TransferTrackingInteractorOutput?
    private let apiClient: TransferAPIClientProtocol
    private var pollingTask: Task<Void, Never>?
    
    func startTracking(transferId: String) {
        pollingTask = Task {
            while !Task.isCancelled {
                do {
                    let status = try await apiClient.getTransferStatus(transferId)
                    await MainActor.run { output?.didUpdateStatus(status) }
                    
                    if status.isTerminal { break } // Delivered or Failed — stop
                } catch {
                    // Silent retry — tracking is non-critical
                }
                try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
            }
        }
    }
    
    func stopTracking() { pollingTask?.cancel() }
}
```

**Trade-offs (30 seconds):**
> "Debounce timing — 500ms is the sweet spot. 200ms fires too many calls because users are still typing. 1000ms feels laggy — the user finishes typing and waits a full second before seeing the quote. 500ms balances responsiveness with efficiency.
>
> Cache TTL — 30 seconds to match Wise's rate guarantee window. If we cached longer, users might see a stale rate and get a different amount when they confirm. If we cached shorter, we'd make more API calls than necessary. The TTL should match the business guarantee.
>
> Poll vs WebSocket — polling for status tracking, as I explained. But if Wise later wants a live rate ticker on the home screen showing real-time rates, that's where WebSocket makes sense — the rate ticker needs sub-second updates, and polling every second would drain the battery.
>
> Server-side recipient storage vs local-only — I use both. Local encrypted storage for instant display on app launch, server as the source of truth. When the user adds a recipient on their phone, it syncs to the server so it's available on their tablet too. Classic cache-first pattern."

**Production Concerns (15 seconds):**
> "Monitoring: quote fetch latency p50/p95/p99 — must be under 500ms for the debounce to feel instant. Transfer confirmation success rate — any drop indicates a backend issue. Rate expiry rate — if more than 20% of users see 'rate expired', the TTL might be too short. Funnel drop-off per step — which step loses the most users?
>
> Security: certificate pinning on all API calls. Card tokenization through a certified SDK — card numbers never touch our servers. Idempotency key stored in Keychain, not UserDefaults. Biometric auth before any money moves.
>
> Feature flags: new payment methods behind flags. New recipient country support behind flags. Quote UI redesigns behind flags. Gradual rollout, monitor, ramp."

**Wise Connection (10 seconds):**
> "This is Wise's core product, and it maps directly to my work. BFX handles the exact same rate quoting and currency conversion logic. The 30-second TTL, the debounce pattern, the idempotency key — I've implemented all of these at PayPal. The difference is Wise shows the mid-market rate with a transparent fee, while banks hide the markup in the rate. The mobile architecture is the same, but Wise's is more honest to the customer."

**When They Add: "Now add scheduled/recurring transfers" (30 seconds):**
> "I'd add two new components without modifying the existing transfer flow.
>
> First, a SchedulePickerModule — new VIPER module inserted between Step 3 (payment method) and Step 4 (review). Shows: one-time future date, weekly, monthly frequency. Date picker for start date, optional end date for recurring. The Coordinator handles the conditional step — if the user wants to send now, skip the picker. If they want to schedule, show it.
>
> Second, the actual scheduling should be server-side, not client-side. iOS aggressively kills background tasks — BGTaskScheduler is unreliable for time-critical financial operations. If a user schedules a transfer for Monday 9 AM and their phone is dead, the server handles it regardless. The mobile sends the schedule to the backend: 'Create this transfer every Monday at 9 AM'. The backend owns execution. The mobile just displays upcoming scheduled transfers and allows cancel or edit.
>
> The rate question is critical: you can't guarantee today's rate for next week's transfer. Two options — lock the rate now and Wise absorbs the FX risk, or use the market rate at execution time and the user accepts variance. I'd ask product which approach Wise prefers. My instinct is market rate at execution because FX risk is expensive and Wise's margin is already thin.
>
> Discrete work items: SchedulePickerView UI — 2 days. Backend API for scheduled transfers — backend team. Local storage for viewing upcoming schedules — 1 day. Push notification 'Your scheduled transfer was sent' — half a day. Cancel and edit scheduled transfer flow — 1.5 days. Edge case handling — insufficient balance at execution time — 1 day. Tests — 2 days. Total mobile effort: roughly 8 days."

---

### The 6 Key Phrases to Memorize:

```
1. "500ms debounce on amount input — typing '1000' fires ONE API call, 
    not four. Task-based with cancellation."

2. "30-second TTL on rate cache — matches Wise's rate guarantee window. 
    Client-side countdown + server-side validation. Belt and suspenders."

3. "Idempotency key as UUID — stored locally before the API call. 
    Network retry sends same key. Server creates transfer ONCE, not twice."

4. "Dynamic Forms for recipient — UK needs sort code, EU needs IBAN, 
    India needs IFSC. Backend defines fields, mobile renders natively."

5. "Poll every 5 seconds for status — transitions happen on minutes-to-hours 
    timescale. WebSocket is overkill here. Push notifications as complement."

6. "Server-side scheduling for recurring — iOS kills background tasks. 
    Phone dead on Monday morning? Server still creates the transfer."
```

### Quick Drawing to Practice (draw in 3 min):

```
TransferFlowCoordinator
│
├── Step 1: AmountInputModule
│   User types → 500ms debounce → Quote API
│   Cache with 30s TTL → Countdown timer
│   "You send £1000, they get €1,155.23, fee £3.69"
│
├── Step 2: RecipientModule  
│   Saved recipients (local + API sync)
│   "Add new" → Dynamic Forms per country
│   UK: sort code | EU: IBAN | India: IFSC
│
├── Step 3: PaymentMethodModule
│   Bank transfer (free, 1-2 days)
│   Debit card (£1.50, instant)
│   Apple Pay (£1.50, instant)
│
├── Step 4: ReviewModule
│   Full summary + rate countdown
│   Rate expired? → auto-refetch, update amounts
│   Face ID → POST /transfers + idempotency key
│
└── Step 5: TrackingModule
    Poll every 5s + push notifications
    Created → Payment Received → Converting → Sending → Delivered
```

### Edge Cases to Mention (if they probe):

```
"What if the rate changes between Step 1 and Step 4?"
→ Quote has a UUID. Server validates THAT specific quote at confirmation.
  If expired, return error. Mobile shows "Rate updated" and 
  auto-fetches new quote. User reviews the new amount — 
  doesn't have to re-enter anything else.

"What if balance is insufficient?"
→ Server rejects with specific error code.
  Mobile shows: "Insufficient funds. You have £950, transfer needs £1003.69."
  Offer: "Edit amount" or "Add money to your balance."

"What if the user's internet drops after confirmation?"
→ Idempotency key already stored locally.
  App shows: "Confirming your transfer..."
  When internet returns, retry with same key.
  If transfer was already created server-side, server returns it.
  User sees confirmation — no duplicate.

"What if the user closes the app mid-transfer flow?"
→ Transfer not yet created (only created at Step 4 confirmation).
  Coordinator state is lost. Two options:
  a) Save draft locally — resume later. More complex.
  b) Start fresh. Recipient and amount are quick to re-enter.
  I'd ask product: do users actually want drafts? 
  If data says yes, implement. If not, keep it simple.

"What if two devices confirm the same transfer?"
→ Same idempotency key? Server returns same transfer. No duplicate.
  Different idempotency keys? Both create separate transfers.
  This is a backend concern — the balance check prevents overspend.
  Mobile should show: "Another transfer was just created from your account."

"What about compliance — KYC/AML checks?"
→ Server runs compliance checks at confirmation time.
  If KYC incomplete: mobile shows "Complete verification to continue"
  and routes to the KYC flow. If AML flagged: "Transfer under review" 
  status — not blocked, just delayed for manual review.
```

**Practice saying the full answer out loud 3 times. Target: under 4 minutes for the core answer (opening through VIPER). Save the debounce deep-dive, status tracking, and scheduled transfers for when they ask follow-ups.** 🚀
