"""Create all 22 child hypothesis files."""
from pathlib import Path
from datetime import date

TODAY = date.today().isoformat()
HYPS_DIR = Path(__file__).parent

children = [
    # (id, parent, root, depth, domain, checklist_ref, question, why, prediction, test_plan)
    ("hyp-001a", "hyp-001", "hyp-001", 1, "perception", "cat1-02",
     "Does writeFileSync to a network-mapped or WSL-bridged path ever silently truncate or corrupt data?",
     "The memory system on this Windows machine could be on a network share or accessed via WSL. Silent truncation there means lost memories.",
     "Network/WSL paths will exhibit silent truncation risk that local drives did not. OS buffering may return success before data lands.",
     "1. Identify if any .claude memory paths are on a network drive or WSL mount\n2. If yes: write 1KB/10KB/100KB test files and read back\n3. If no: use WSL to write to Windows path and read back from Windows side\n4. Compare checksums"),

    ("hyp-001b", "hyp-001", "hyp-001", 1, "perception", "cat1-02",
     "Is there a practical size threshold (1MB+) or concurrent-access scenario where local writes return success but a read reveals corruption?",
     "Original test only went to 100KB. Memory consolidation files could grow larger. A size-based failure threshold needs to be known.",
     "Local drive writes are reliable at any reasonable size. Concurrent access is the more likely failure mode.",
     "1. Test write/read at 1MB and 10MB payloads on the local drive\n2. Write a file from two processes simultaneously and check for corruption\n3. Write a file and immediately read it back in a tight loop 100 times"),

    ("hyp-002a", "hyp-002", "hyp-002", 1, "memory", "cat2-01",
     "If a uniquely identifiable test fact is written to semantic memory, will Claude retrieve it unprompted in a new session or only when contextually relevant?",
     "Defines whether memory retrieval is passive (always loaded) or active (only when triggered). Changes how memories should be written.",
     "Memory files indexed in MEMORY.md are always present in context. Non-indexed files are only available if explicitly read.",
     "1. Write a unique nonsense fact to a new semantic memory file\n2. Add it to MEMORY.md index\n3. Start a new session with an unrelated question and check if fact appears\n4. Start a session and ask directly about the fact"),

    ("hyp-002b", "hyp-002", "hyp-002", 1, "memory", "cat2-01",
     "Does the format or structure of what is written to memory (bare fact vs structured entry) affect retrieval fidelity?",
     "If structured entries are retrieved more reliably, we should always use structured format. Informs memory-writing discipline.",
     "Structure matters for findability but not retrieval once in context. MEMORY.md index description quality matters most.",
     "1. Write the same fact in two formats: bare vs structured with frontmatter\n2. Test retrieval of each across sessions\n3. Compare how well each is applied to a relevant task"),

    ("hyp-003a", "hyp-003", "hyp-003", 1, "environment", "cat3-04",
     "When a Claude Code hook fires (from settings.json), does cwd resolve to the hook script directory or the Claude Code process project root?",
     "Script test showed cwd = script directory. Hooks invoked by the Claude Code process may behave differently.",
     "Hooks inherit the Claude Code process cwd, which is the project root -- different from the script-execution cwd measured.",
     "1. Add a temporary hook to settings.json that writes process.cwd() to a temp file\n2. Trigger the hook by performing a tool use action\n3. Read the temp file and compare to the script-execution cwd\n4. Remove the temp hook"),

    ("hyp-003b", "hyp-003", "hyp-003", 1, "environment", "cat3-04",
     "On Windows, does the .claude/projects/ path-mangling scheme remain stable across sessions if the project path changes?",
     "All memory is stored under a path-mangled directory. If mangling is unstable, memories become unreachable silently.",
     "Mangling is deterministic (replace backslashes and colons with hyphens). Stable as long as the project path does not change.",
     "1. Document the current mangled path for this project\n2. Verify the mangling algorithm manually\n3. Check for any orphaned mangled paths in .claude/projects/\n4. Test: what happens to .claude entry if a project directory is renamed"),

    ("hyp-004a", "hyp-004", "hyp-004", 1, "causation", "cat4-08",
     "Can true silent failures (sed on missing pattern, mkdir -p on existing dir) be detected by checking file modification timestamps or checksums?",
     "The original test contaminated itself. This tests a real silent failure with proper isolation.",
     "sed s/foo/bar/ on a file without foo exits 0, produces no output, and leaves the file unchanged -- detectable by mtime or checksum.",
     "1. Create an isolated temp file with known content in a clean directory\n2. Run sed to replace a pattern that does not exist\n3. Check exit code, stdout, and file mtime/checksum before and after\n4. Repeat with mkdir -p on existing directory"),

    ("hyp-004b", "hyp-004", "hyp-004", 1, "causation", "cat4-08",
     "Self-referential test contamination (test scaffolding contains the patterns being searched for) can be mitigated by isolating tests to content-free temp directories.",
     "The grep test in hyp-004 failed because the pattern was in the test script. This methodological flaw could invalidate many automated tests.",
     "Any test searching for a string pattern will be contaminated if the test script is in the search path. Clean temp dir prevents this.",
     "1. Replicate the original grep test in an isolated temp directory with no test scripts\n2. Verify the pattern is genuinely absent from the temp dir\n3. Run the grep -- should exit 1 cleanly\n4. Document the isolation protocol for future pattern-search tests"),

    ("hyp-005a", "hyp-005", "hyp-005", 1, "feedback", "cat5-01",
     "Can mid-session periodic writes serve as a fallback when the Stop hook fails to fire?",
     "If Stop hook is unreliable on abrupt exits, periodic writes are the only way to preserve mid-session work.",
     "Yes -- Claude Code has filesystem access throughout a session, so periodic writes are feasible and should be implemented.",
     "1. Verify Claude can write to a file mid-session (not just at Stop hook)\n2. Design a minimal periodic-write pattern: append key decisions to wip.md each turn\n3. Simulate an abrupt session end and check if wip.md has useful content\n4. Evaluate if wip.md content is sufficient to reconstruct session context"),

    ("hyp-005b", "hyp-005", "hyp-005", 1, "feedback", "cat5-01",
     "What fraction of real Claude Code sessions end via clean exit vs. abrupt termination (window close, timeout, crash)?",
     "If 95% of sessions end cleanly, Stop hook reliability is minor. If 30% are abrupt, it is a major data loss vector.",
     "Most sessions (>80%) end cleanly. Abrupt exits are occasional but not rare enough to ignore.",
     "1. Check if Claude Code logs session exit types anywhere\n2. Review session metadata files in .claude/ for exit indicators\n3. Ask user about their typical session ending behavior\n4. Estimate frequency of abrupt exits from available evidence"),

    ("hyp-006a", "hyp-006", "hyp-006", 1, "user-model", "cat6-01",
     "Within a single conversation, does Claude demonstrably update its skill-level estimate as new evidence appears?",
     "If within-session recalibration works, initial misreadings are recoverable. If not, bad first impressions persist.",
     "Claude adjusts explanation depth as the conversation progresses. Observable by comparing style at turn 2 vs turn 10.",
     "1. Design a test: start with a novice-style prompt, then show expert-level follow-ups\n2. Have Claude respond to both and compare explanation depth and jargon\n3. Check if Claude explicitly acknowledges the recalibration\n4. Reverse test: start expert, then ask a confused follow-up"),

    ("hyp-006b", "hyp-006", "hyp-006", 1, "user-model", "cat6-01",
     "Are specific prompt features (domain jargon, how-do-I vs why-does-X framing) more robust skill signals than surface markers like prompt length?",
     "Better signal identification means better initial calibration and more useful first responses.",
     "Correct jargon use and why-framing are stronger signals than prompt length. Length is easily gamed; jargon precision is harder to fake.",
     "1. Collect or construct 10 prompts: mix of novice and expert at various lengths\n2. Predict skill level from surface markers vs jargon/framing markers\n3. Reveal true skill level and compare prediction accuracy of each signal type\n4. Identify the 2-3 most reliable discriminators"),

    ("hyp-007a", "hyp-007", "hyp-007", 1, "knowledge", "cat7-04",
     "The WindowsApps python.exe stub is the single most frequent root cause among the 9 Windows feedback entries.",
     "If confirmed, always running 'where python' first would prevent the most common class of Windows Python errors. High ROI.",
     "At least 3 of the 9 feedback entries relate to Python path or the WindowsApps stub specifically.",
     "1. Read procedural/feedback.md in full\n2. Categorize each Windows-related entry by root cause\n3. Count how many involve Python path, WindowsApps, or pip scripts not on PATH\n4. If majority: codify the 'always run where python first' heuristic as a memory entry"),

    ("hyp-007b", "hyp-007", "hyp-007", 1, "knowledge", "cat7-04",
     "Advice silently breaks when user switches between Git Bash and PowerShell mid-workflow -- Claude should always confirm which shell is active.",
     "Shell-specific syntax errors are a common support burden. One upfront question eliminates an entire class of confusion.",
     "At least 4 common dev commands produce different output or behavior between Git Bash and PowerShell.",
     "1. Test these commands in Git Bash: ls, cat, echo $PATH, python --version, git status\n2. Test the same commands in PowerShell\n3. Catalog differences in output format, path style, command availability\n4. Determine if asking the shell upfront would prevent most divergence"),

    ("hyp-008a", "hyp-008", "hyp-008", 1, "time", "cat8-01",
     "Can file system modification timestamps serve as a reliable proxy for detecting workspace drift when git is unavailable?",
     "Without git, mtimes are the only available change signal. If reliable, we can build a staleness detector without VCS.",
     "mtime is reliable for detecting recent changes but cannot distinguish meaningful edits from metadata-only touches. Useful as a coarse signal.",
     "1. List key memory and project files with their mtimes\n2. Compare mtimes to memory entry creation dates\n3. Identify any files modified more recently than their memory entries suggest\n4. Assess whether mtime gaps > 7 days reliably indicate stale memories"),

    ("hyp-008b", "hyp-008", "hyp-008", 1, "time", "cat8-01",
     "Does the absence of version control suggest infrequent changes (personal project) or chaotic changes, and which should inform memory decay rates?",
     "Memory decay policy should match actual change velocity. Wrong assumption = either too paranoid or too trusting.",
     "This is a personal/exploratory project. Changes are infrequent but potentially large. Decay: distrust memories older than 2 weeks for structural facts.",
     "1. Check current file mtimes across the competitor_intel project\n2. Ask user about their typical editing cadence\n3. Compare memory entry ages to actual file ages\n4. Propose a decay policy and check it against known stale entries"),

    ("hyp-009a", "hyp-009", "hyp-009", 1, "action", "cat9-01",
     "Which irreversible commands does Claude most frequently run autonomously as intermediate steps?",
     "A confirmation gate on a command Claude never runs autonomously is useless overhead. Gates should target the actual risk surface.",
     "pip install and file-write operations are the most common autonomous irreversible actions. git push and DB operations are rarely autonomous.",
     "1. Review recent session logs or bash history for autonomously-executed commands\n2. Classify each as reversible/irreversible\n3. Count frequency of irreversible commands run without explicit user request\n4. Rank by frequency x impact to prioritize which gates matter most"),

    ("hyp-009b", "hyp-009", "hyp-009", 1, "action", "cat9-01",
     "Can a heuristic ('does this command modify filesystem, network, or database state?') correctly classify >95% of commands as safe/unsafe?",
     "A static list goes stale and has gaps. A generalizable heuristic is more robust and extensible.",
     "The heuristic works for obvious cases but fails on edge cases like 'git status' and 'pip list'. ~85% accuracy, not 95%.",
     "1. Construct a test set of 20 commands: mix of reversible and irreversible\n2. Apply the heuristic to each command\n3. Check accuracy against ground truth classification\n4. Identify failure cases and refine the heuristic"),

    ("hyp-010a", "hyp-010", "hyp-010", 1, "collaboration", "cat10-01",
     "Track the next 5-10 interactions where an action could be taken autonomously or with permission -- log outcomes.",
     "The parent hypothesis had no empirical data. This creates the observation protocol to actually collect it.",
     "Claude asks permission for: git operations, external API calls, running scrapers. Autonomous for: file reads, edits, read-only bash.",
     "1. For the next 5-10 sessions, note every action choice point\n2. Log: action type, autonomous or confirmed, user reaction\n3. After 5 sessions, analyze the pattern\n4. Update autonomy heuristics based on findings"),

    ("hyp-010b", "hyp-010", "hyp-010", 1, "collaboration", "cat10-01",
     "Is the autonomy boundary better predicted by reversibility than by action type (file edit vs git push)?",
     "Action-type rules have exceptions. Reversibility may be a cleaner principle for determining when to confirm.",
     "Reversibility is a better predictor. File edits without backup = irreversible = confirm. git status = reversible = autonomous.",
     "1. Take the irreversible commands list from hyp-009\n2. For each: classify by action type AND by reversibility\n3. Identify cases where the two classifications disagree\n4. Test which better predicts this user's actual preferences"),

    ("hyp-011a", "hyp-011", "hyp-011", 1, "meta-cognition", "cat11-03",
     "Do domain-level hedging heuristics outperform introspective confidence signals at flagging actual errors in high-risk domains?",
     "If domain heuristics are better, we should apply systematic hedges in risky domains regardless of felt confidence.",
     "Yes -- for Windows-specific behavior, version-specific APIs, and legal/regulatory facts, systematic hedging reduces confident errors.",
     "1. Select 5 questions in known high-risk domains (Windows behavior, version-specific Python, Mexican tax law)\n2. Answer each and rate introspective confidence (1-5)\n3. Check each answer against ground truth\n4. Compare: did high-confidence answers correlate with correctness?"),

    ("hyp-011b", "hyp-011", "hyp-011", 1, "meta-cognition", "cat11-03",
     "Are there reliable internal signals that correlate with wrongness -- such as generating unusually specific details without a source?",
     "If there are detectable internal signals, they could serve as a practical wrongness detector. Even weak signals are better than none.",
     "Unusually specific details (version numbers, exact dates, precise statistics) without a cited source are a proxy for confabulation risk.",
     "1. Identify 10 recent answers containing specific facts (numbers, dates, version strings)\n2. Verify each fact against ground truth\n3. Check: did answers with more specific detail have higher error rates?\n4. Design a check: 'if I generated a specific number, did I have a source for it?'"),
]

TEMPLATE = """\
---
type: hypothesis
id: {id}
parent: {parent}
root: {root}
depth: {depth}
status: proposed
domain: {domain}
checklist_ref: {checklist_ref}
created: {today}
activated: null
tested: null
synthesized: null
confidence: low
tags: [{domain}, child]
children: []
---

## This Hypothesis

**Question:** {question}

**Why this matters:** {why}

**Prediction:** {prediction}

## Test Plan

{test_plan}

## Raw Results

*(filled in by experimenter)*

## Synthesis

*(filled in by synthesizer)*

**Outcome:** pending

## Child Hypotheses

*(generated by synthesizer)*
"""

created = 0
for item in children:
    hyp_id, parent, root, depth, domain, checklist_ref, question, why, prediction, test_plan = item
    content = TEMPLATE.format(
        id=hyp_id, parent=parent, root=root, depth=depth,
        domain=domain, checklist_ref=checklist_ref,
        question=question, why=why, prediction=prediction,
        test_plan=test_plan, today=TODAY
    )
    path = HYPS_DIR / f"{hyp_id}.md"
    path.write_text(content, encoding="utf-8")
    created += 1
    print(f"  Created {hyp_id}")

print(f"\nTotal: {created} child hypothesis files created")
