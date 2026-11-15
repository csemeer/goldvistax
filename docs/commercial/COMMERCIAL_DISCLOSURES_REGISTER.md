# Commercial Disclosures Register
**Document Reference:** `docs/commercial/COMMERCIAL_DISCLOSURES_REGISTER.md`

| Feature / Claim | Codebase Implementation | Required User Disclosure | Legal / Compliance Status |
|---|---|---|---|
| **100% Stop-Loss Refund** | Refunds 1 internal Signal Credit (`monetizationEngine.ts`) | Explicitly labeled **Signal Credit Refund (Non-Cash)** | Requires counsel review of advertising wording |
| **Partner Broker Rebates / Free Pro** | `BROKER_PARTNERS` affiliate metadata (`IC Markets`, `Pepperstone`, `Tickmill`) | Compensation/referral disclosure; zero effect on signal direction/confidence | Requires partner contracts & jurisdiction checks |
| **ROI Value Simulator** | Illustrative lot-volume calculator (`MonetizationWorkspace.tsx`) | Illustrative modeling assumptions, not guaranteed trading returns | Requires prominent financial disclaimer |
| **Prop Challenge Guardian** | 0.75% risk cap + simulated 30-day Monte Carlo | Educational risk guardrail; does not guarantee prop firm pass | Disclosed in UI; legal check recommended |
| **Data & Options Models** | Yahoo Finance + Parametric GVZ proxy (`futuresOptionsEngine.ts`) | Non-commercial data limits apply until licensed feeds are contracted | **Release Blocker for paid public launch** |
