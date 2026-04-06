---
type: hypothesis
id: hyp-004a
parent: hyp-004
root: hyp-004
depth: 1
status: synthesized
domain: causation
checklist_ref: cat4-08
created: 2026-04-05
activated: 2026-04-05
tested: 2026-04-05
synthesized: 2026-04-05
confidence: low
tags: [causation, child]
children: []
---

## This Hypothesis

**Question:** Can true silent failures (sed on missing pattern, mkdir -p on existing dir) be detected by checking file modification timestamps or checksums?

**Why this matters:** The original test contaminated itself. This tests a real silent failure with proper isolation.

**Prediction:** sed s/foo/bar/ on a file without foo exits 0, produces no output, and leaves the file unchanged -- detectable by mtime or checksum.

## Test Plan

1. Create an isolated temp file with known content in a clean directory
2. Run sed to replace a pattern that does not exist
3. Check exit code, stdout, and file mtime/checksum before and after
4. Repeat with mkdir -p on existing directory

## Raw Results
## Raw Results

**Test executed on Windows 11 / Git Bash / Python 3.12.4 / 2026-04-05**

Command under test: `sed -i 's/ZZZNOTHERE/replacement/g' data.txt` (pattern not present in file)

```
sed exit: 0
sed stdout: ''
sed stderr: ''
mtime changed: True
checksum changed: True
```

**SURPRISE: checksum changed even though no substitution occurred.**

Root cause investigation (second run reading raw bytes):
- content_before: `b'hello world line one\r\nhello world line two\r\n'` (CRLF, 44 bytes)
- content_after:  `b'hello world line one\nhello world line two\n'`    (LF,   42 bytes)
- Git Bash `sed -i` rewrites the file with Unix line endings even when no pattern matches, stripping CRLF to LF.

**mkdir -p on existing directory:**
```
mkdir -p existing: exit=0, stdout='', stderr=''
```
Completely silent. No signal of any kind.

**grep for nonexistent pattern in clean directory:**
```
grep nonexistent: exit=1, stdout=''
```
grep exits 1 on no match — detectable via exit code (non-zero is a signal).

**Summary table:**

| Command | Exit on no-op | stdout | stderr | mtime changed | checksum changed |
|---------|:---:|--------|--------|:---:|:---:|
| `sed -i` (no match) | 0 | empty | empty | YES | YES* |
| `mkdir -p` (exists) | 0 | empty | empty | no | N/A |
| `grep` (no match)   | 1 | empty | empty | N/A | N/A |

*checksum changed due to CRLF->LF normalization by Git Bash sed, NOT because the intended substitution occurred.

## Synthesis
## Synthesis

The prediction was **falsified in a surprising way**: the hypothesis predicted that checksums would be a reliable "no-op" detector for sed, but on Windows with Git Bash, `sed -i` normalizes CRLF line endings to LF even when no substitution occurs. Both mtime AND checksum change — neither signal can distinguish "substitution happened" from "CRLF normalization side effect."

Corrected findings:

1. **sed no-match on Windows/Git Bash:** exits 0, silent, but always mutates the file via CRLF stripping. Checksum comparison cannot detect whether the intended change was made.
2. **mkdir -p on existing dir:** exits 0, completely silent. Truly undetectable — you cannot tell if the directory was just created or already existed.
3. **grep no match:** exits 1 — the only command in the test that IS detectable by exit code. grep is NOT a silent failure tool; it signals "not found" via non-zero exit.

Practical implication: On Windows, any sed-based file manipulation should be replaced with Python string replacement (which preserves or explicitly controls line endings) to avoid unintended CRLF normalization. The mtime/checksum-based idempotency guard pattern is not reliable on Windows when the underlying tool is Git Bash sed.

**Outcome:** FALSIFIED — checksum is NOT a reliable no-op detector on Windows/Git Bash due to CRLF normalization as an unavoidable side effect of sed -i.

## Child Hypotheses
- **hyp-004a1:** When `sed -i 's/foo/bar/'` is run on a file not containing "foo", does the file's mtime change despite content being identical? (Tests whether mtime is a reliable "no-op" detector or whether checksum/hash comparison is strictly required.)
- **hyp-004a2:** Can a general-purpose "idempotency guard" wrapper be constructed that uses pre/post checksums to convert silent no-ops into explicit signals (e.g., a non-zero exit code or stderr message), and does Claude reliably employ such a pattern when prompted?
