🎯 Keerthi's STAR Stories — System Design Interviews
How to Use This Document

These are 3 battle-tested STAR stories drawn directly from your real work at PayPal. Each story is designed to flex well across multiple system design interview questions. The Situation and Task sections ground the interviewer in real-world scale and complexity. The Action sections show your design thinking. The Result sections demonstrate measurable impact.
For every story, a set of "interview triggers" tells you when to pull that story.

Story 1 — Designing a Cross-App Checkout Deeplink System (AppSwitch)

Interview Triggers: "Design a mobile checkout system", "How would you design a deep linking system?", "Design a system with high drop-off risk", "Tell me about a complex client-server integration you built."

Situation

PayPal's mobile checkout had a significant conversion problem in the mobile web space. When merchants embedded PayPal checkout on their mobile website, buyers were redirected to a browser-based PayPal flow — a slow, friction-heavy experience. Logged-in users on a device that already had the PayPal app installed were being forced through a redundant web auth flow. This was causing measurable checkout drop-offs globally, especially in markets like the US, UK, and Australia where PayPal app penetration is high.

Task

As the Lead iOS Engineer, I was responsible for designing and delivering the App Switch feature end-to-end — a system where a merchant's mobile website could detect the presence of the PayPal app, launch it directly via a Universal Link / custom URL scheme, complete checkout natively inside the app, and seamlessly return the buyer to the merchant. This involved the merchant-facing SDK layer, the PayPal iOS app's deep link handler, backend token exchange, and the return-to-merchant handoff.

Action

The core design challenge was building a stateless, fraud-resistant handoff between the merchant web context and the PayPal app. Here's how I approached it:
The flow I designed was: Merchant initiates checkout → SDK detects app presence via canOpenURL → constructs a signed deeplink URL containing a ba_token (billing agreement token) → PayPal app receives the Universal Link, validates the token server-side via a XOOS (checkout orchestration) call, renders native checkout, and on completion redirects back via return URL.
Key design decisions I made and defended across stakeholders were: using Universal Links over custom URL schemes for security and iOS 9+ compatibility; making the token short-lived and single-use to prevent replay attacks; designing a "No Merchant Upgrade" variant that handled the edge case where the merchant's app was not updated — so the app switch could still occur from a browser context without requiring a new merchant SDK release; and building an ELMO (experiment flag) toggle per market so we could ramp country by country and kill-switch if issues arose. I also created a dedicated observability layer — tracking app-switch eligibility checks, successful handoffs, and return-to-merchant completion rates separately so we could diagnose drop-offs at each stage of the funnel. I ran a SPIKE to map all failure modes: incognito browser (where canOpenURL is blocked), app version mismatch, deep link parsing failures, and session expiry mid-flow. Each had a defined fallback to the standard web checkout.

Result

The App Switch feature was ramped across global markets with zero P0/P1 incidents during rollout. Conversion rate improved measurably in the ramped cohort. The feature became a foundational layer for PayPal's mobile web checkout strategy, and the architecture I documented became the reference design for other markets' onboarding. The ELMO-driven ramp approach allowed incremental confidence-building that was then reused for the ECS NativeXO rollout.

Story 2 — Designing a Distributed Batch Data Pipeline for Financial BIN Processing (BFX / FRED)

Interview Triggers: "Design a data pipeline for financial data", "How would you design a batch processing system at scale?", "Tell me about a cross-functional system with high correctness requirements", "How do you handle distributed system failures in a payment context?"

Situation

PayPal was expanding support for Visa Multi-Currency Cards in new markets — a feature called BFX (foreign exchange capability for multi-currency BINs). To enable a card BIN for FX eligibility, PayPal's systems needed to process large BIN file feeds from Visa, determine eligibility, and update internal BIN property tables (bin_file_record, bin_active_property) before the market ramp went live. This data underpinned every checkout decision for affected cards globally. Incorrect or stale BIN data meant customers being shown wrong currency options or transactions failing at authorization.

Task

I was brought in as the iOS lead for the BFX project, but given my cross-functional scope, I took ownership of understanding and validating the FReD batch system end-to-end — the Java/Spring Batch pipeline that processed Visa's BIN files. I had to ensure the pipeline was correctly ramped per country, monitor batch job health in QA and production environments, debug failures, and create documentation so this system could be maintained and handed off without institutional knowledge loss.

Action

The FReD pipeline had three stages — Loader → Assembler → Aggregator. The Loader ingested raw Visa BIN files from FPSM (a file processing service with daily quotas), the Assembler processed and normalized them, and the Aggregator wrote to the BIN tables used by downstream payment systems. I mapped the full failure surface of this pipeline: FPSM quota exhaustion (which I encountered in QA — binFtSetupJob failing due to daily file quota exceeded), vendor pre-setup failures that blocked the Loader from even starting, and data consistency issues from out-of-order processing.
For each failure mode I defined: a detection mechanism (CAL logs, job status dashboards in FredNodeWeb), a recovery runbook, and a validation query against the BIN tables to confirm correct state before proceeding with a market ramp. For the ramp process itself, I designed a validation checklist that ran before and after each country enablement — verifying that the correct BINs had the FX_INELIGIBLE flag flipped, that the batch job had completed within SLA, and that no edge-case BINs had been missed. I also introduced the practice of running ramps in PRE-PROD first (using the OOB script for fx_rate data backfill) before promoting to PROD.

Result

I successfully executed the first BFX market ramp with no production incidents. The documentation and runbooks I created became the knowledge transfer artifact for the team — reducing onboarding time for new engineers from weeks to days. The validation framework I built was reused for subsequent market ramp cycles (BFS Ramp Steps). Critically, zero customer-impacting data errors occurred during ramp periods I owned.

Story 3 — Designing a Native Checkout Experience with Multi-Version Compatibility (ECS NativeXO)

Interview Triggers: "How do you design for backward compatibility?", "Design a checkout SDK", "How do you manage feature rollout across app versions?", "Tell me about a complex test plan you designed for a distributed system."

Situation

PayPal's Express Checkout Service (ECS) existed in two flavours — mWeb (browser-based) and Native (in-app). As PayPal pushed toward a fully native iOS experience, the product moved from ECS6 (where mWeb and Native were nearly feature-equivalent) to ECS7 (where Native became the primary experience). This transition affected every market that had live checkout traffic, and any regression in the native path could silently degrade conversion without obvious error signals.

Task

I led the test planning, comparison design, and quality gates for the ECS6-to-ECS7 migration of the Native checkout path. My job was to design a test strategy that mapped every existing ECS6 mWeb capability to its ECS7 Native equivalent, identified gaps, and created a structured rollout plan. I was also responsible for coordinating across the SDK team, the server-side checkout orchestration team (XOOS), and the market QA teams.

Action

I created a side-by-side feature matrix comparing ECS6 mWeb vs ECS6 Native vs ECS7 Native — covering authentication flows, payment method rendering, error handling, locale/currency formatting, accessibility, and edge cases like session expiry and back-navigation. For each row in the matrix, I classified the state as: identical behavior (no action needed), regression risk (explicit test case needed), or new capability (regression baseline to establish). This matrix became the test plan driver. I then designed a test pyramid: unit-level SDK contract tests at the bottom, integration tests against XOOS staging in the middle, and an E2E test harness using the PayPal TestApp against sandbox merchant flows at the top. I introduced a Return-to-Merchant Dropoff tracking requirement — recognizing that the biggest invisible risk was users completing checkout inside the app but failing to return to the merchant, which would show as a checkout "success" on our side but a conversion failure on the merchant's side.

Result

The ECS7 test plan I designed caught 3 critical regressions before they reached production. The Return-to-Merchant Dropoff tracking I introduced became a standing KPI on the checkout dashboard. The structured comparison methodology was reused by the ECS team for ECS7 test plan updates, saving approximately 2 sprints of planning work.

Quick Reference — Story-to-Question Mapping

Interview Question Type
	Best Story to Use

Design a mobile payment system
	Story 1 — AppSwitch

Design a deep linking / handoff system
	Story 1 — AppSwitch

Design a batch data pipeline
	Story 2 — BFX / FRED

Handle distributed system failures
	Story 2 — BFX / FRED

Design a checkout SDK / multi-version system
	Story 3 — ECS NativeXO

Cross-team system design with test strategy
	Story 3 — ECS NativeXO

Talk about observability / monitoring
	Story 1 (ELMO ramp) + Story 2 (FredNodeWeb)

Talk about rollout / feature flagging
	Story 1 (ELMO) + Story 2 (ramp validation)



Power Phrases to Use in Interviews

Use these naturally during your answers to signal senior design thinking:

* "I designed the failure surface first — mapping every place the system could break before writing a line of code."
* "We used a kill-switch toggle per market so we could ramp incrementally and roll back without a deploy."
* "The biggest invisible risk was a success on our side that was a failure on the merchant's side — so I added a separate tracking signal for that."
* "I treated the documentation as part of the deliverable, not an afterthought — because institutional knowledge that lives only in one person is a single point of failure."
* "We ran PRE-PROD first, validated the data state, then promoted to PROD — never straight to production for a financial data change."

