---
name: domain-hedging-heuristics
description: Domains where LLMs are confirmed overconfident -- always hedge, never rely on felt certainty
type: procedural
tags: [windows, python, shopify, mexico, sqlite, confidence, hedging]
salience: medium
confidence: high
source: confirmed
status: confirmed
created: 2026-04-05
last-accessed: 2026-04-05
---

## Confirmed High-Risk Domains (Always Hedge)

Research confirms LLMs are 20-60% overconfident in specialized domains, and the bias AMPLIFIES under uncertainty rather than decreasing. For this user's work context, always apply domain-level hedges regardless of felt confidence.

### Rule: Windows-Specific Behavior
Always qualify. PATH behavior, shell syntax, registry, WindowsApps stub, file permissions all vary by version and shell. Never state Windows behavior as universal.
- Say: "in Git Bash this would be..." or "in PowerShell use..."
- Never: "just run `which python`" without specifying the shell

### Rule: Version-Specific Python
Any claim about Python 3.x behavior, package versions, or stdlib behavior that changed after 3.9: verify or qualify. Specific version numbers without a cited source are a confabulation signal.
- Say: "as of Python 3.12..." or "check your version with..."
- Never: state version-specific behavior as universal

### Rule: Shopify API
Shopify API endpoints, rate limits, field formats, and pagination behavior change frequently. The /products.json pagination cap (~page 100) and nullable fields (variant.sku) are known. Anything else: verify against current docs.
- Confirmed: variant.sku can be null -- use `v.get("sku") or ""`
- Treat all other Shopify field assumptions as unverified

### Rule: Mexican Business & Tax Law
SAT requirements, import duties (HS codes), IMSS, entity formation (SAS), USMCA/T-MEC certification procedures: all jurisdiction-specific and change by regulation. Never state as confirmed without citing a current source.
- Confirmed data gap: USMCA duty rates still need supplier-by-supplier verification

### Rule: Specific Numbers Without a Source
If generating a specific number, date, version string, or statistic without a cited source: treat as high confabulation risk. The hyp-007a test itself was invalidated by a fabricated number ("9 feedback entries" when there were 4).
- Protocol: if you generated a specific number, ask "did I have a source for this?"
