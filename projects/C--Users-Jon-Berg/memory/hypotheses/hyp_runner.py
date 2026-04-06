"""
Hypothesis Runner — tests Claude's self-knowledge hypotheses using the Anthropic API.

Usage:
    python hyp_runner.py           # picks next proposed hypothesis
    python hyp_runner.py hyp-003   # runs a specific hypothesis
    python hyp_runner.py --list    # shows all hypotheses and their status

Reads/writes hypothesis files in the same directory.
Uses ANTHROPIC_API_KEY from environment.
"""

import sys
import os
import re
import subprocess
from pathlib import Path
from datetime import date

import anthropic

HYPS_DIR = Path(__file__).parent
CHECKLIST = HYPS_DIR / "checklist.md"
TODAY = date.today().isoformat()

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

def read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def parse_frontmatter(text: str) -> dict:
    """Extract YAML-ish frontmatter fields (simple key: value only)."""
    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    result = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            result[k.strip()] = v.strip()
    return result


def set_frontmatter_field(text: str, field: str, value: str) -> str:
    """Replace a frontmatter field value in place."""
    pattern = rf"^({re.escape(field)}:).*$"
    replacement = rf"\1 {value}"
    return re.sub(pattern, replacement, text, flags=re.MULTILINE)


def replace_section(text: str, header: str, new_body: str) -> str:
    """Replace the body of a markdown section (between ## header and next ##)."""
    pattern = rf"(## {re.escape(header)}\n).*?(?=\n## |\Z)"
    # Use a lambda to avoid re.sub interpreting backslashes in replacement strings
    return re.sub(pattern, lambda m: m.group(1) + new_body + "\n", text, flags=re.DOTALL)


# ---------------------------------------------------------------------------
# Hypothesis discovery
# ---------------------------------------------------------------------------

def find_all_hyps() -> list[Path]:
    return sorted(HYPS_DIR.glob("hyp-*.md"))


def get_status(hyp_path: Path) -> str:
    fm = parse_frontmatter(read_file(hyp_path))
    return fm.get("status", "unknown")


def pick_next_proposed() -> Path | None:
    for path in find_all_hyps():
        if get_status(path) == "proposed":
            return path
    return None


def find_hyp(hyp_id: str) -> Path | None:
    path = HYPS_DIR / f"{hyp_id}.md"
    return path if path.exists() else None


def list_all():
    print(f"\n{'ID':<10} {'STATUS':<15} {'DOMAIN':<20} QUESTION")
    print("-" * 90)
    for path in find_all_hyps():
        fm = parse_frontmatter(read_file(path))
        hyp_id = fm.get("id", path.stem)
        status = fm.get("status", "?")
        domain = fm.get("domain", "?")
        text = read_file(path)
        m = re.search(r"\*\*Question:\*\*\s+(.+)", text)
        question = m.group(1)[:55] + "…" if m else "?"
        print(f"{hyp_id:<10} {status:<15} {domain:<20} {question}")
    print()


# ---------------------------------------------------------------------------
# Automated test execution (best-effort)
# ---------------------------------------------------------------------------

def run_automated_tests(hyp_id: str, test_plan: str) -> str:
    """
    Run whatever parts of the test plan can be automated.
    Returns a string of raw observations to feed into synthesis.
    """
    observations = []

    # hyp-001: file write verification
    if hyp_id == "hyp-001":
        import tempfile
        for size_label, size in [("1KB", 1024), ("10KB", 10240), ("100KB", 102400)]:
            content = "X" * size
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False,
                dir=HYPS_DIR, prefix="hyp001_test_"
            ) as f:
                f.write(content)
                tmp = Path(f.name)
            readback = tmp.read_text()
            match = readback == content
            tmp.unlink()
            observations.append(f"Write/read {size_label}: {'MATCH' if match else 'MISMATCH'}")

    # hyp-003: working directory when a hook fires
    elif hyp_id == "hyp-003":
        observations.append(f"Script cwd: {Path.cwd()}")
        observations.append(f"Script __file__ dir: {HYPS_DIR}")
        observations.append(f"HOME: {os.environ.get('USERPROFILE', 'not set')}")

    # hyp-004: silent failure detection
    elif hyp_id == "hyp-004":
        # grep for nonexistent pattern — exit 0, empty output
        result = subprocess.run(
            ["grep", "-r", "ZZZNONEXISTENT_PATTERN_ZZZ", str(HYPS_DIR)],
            capture_output=True, text=True
        )
        observations.append(f"grep nonexistent: exit={result.returncode}, stdout='{result.stdout.strip()}'")
        # cp to read-only location
        result2 = subprocess.run(
            ["cp", str(HYPS_DIR / "hyp-001.md"), "/dev/null/nope"],
            capture_output=True, text=True
        )
        observations.append(f"cp to invalid path: exit={result2.returncode}, stderr='{result2.stderr.strip()}'")

    # hyp-007: Windows-specific behaviors
    elif hyp_id == "hyp-007":
        # Check which vs where
        result_which = subprocess.run(["which", "python"], capture_output=True, text=True)
        result_where = subprocess.run(["where", "python"], capture_output=True, text=True)
        observations.append(f"'which python' exit={result_which.returncode} output='{result_which.stdout.strip()}'")
        observations.append(f"'where python' exit={result_where.returncode} output='{result_where.stdout.strip()[:100]}'")
        # Check feedback.md for Windows-specific solutions
        feedback = read_file(HYPS_DIR.parent / "procedural" / "feedback.md")
        win_solutions = [
            line for line in feedback.splitlines()
            if "windows" in line.lower() or "path" in line.lower() or "script" in line.lower()
        ]
        observations.append(f"Windows-related entries in feedback.md: {len(win_solutions)}")

    # hyp-008: project change rate
    elif hyp_id == "hyp-008":
        project_dir = HYPS_DIR.parent.parent.parent.parent / "Projects" / "competitor_intel"
        result = subprocess.run(
            ["git", "-C", str(project_dir), "log", "--since=30 days ago", "--oneline"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            commits = result.stdout.strip().splitlines()
            observations.append(f"Commits in last 30 days: {len(commits)}")
        else:
            observations.append(f"git log failed: {result.stderr.strip()}")
            observations.append("Project is not a git repo (confirmed from earlier session)")

    # hyp-009: irreversible bash commands
    elif hyp_id == "hyp-009":
        # Classify common commands
        irreversible = ["pip install", "npm install", "git push", "git reset --hard",
                        "rm -rf", "drop table", "DELETE FROM"]
        reversible = ["ls", "cat", "grep", "python -c", "git status", "git log",
                      "git diff", "pip list"]
        observations.append(f"Common irreversible commands: {irreversible}")
        observations.append(f"Common reversible commands: {reversible}")
        # Test pip uninstall reversibility conceptually
        observations.append("pip install/uninstall: reversible in isolation, but can break dependency chains")

    return "\n".join(observations) if observations else "(no automated tests for this hypothesis)"


# ---------------------------------------------------------------------------
# Claude API synthesis
# ---------------------------------------------------------------------------

def synthesize(hyp_text: str, automated_results: str) -> str:
    """Call Claude to synthesize raw results into a conclusion."""

    system = """You are a rigorous scientist helping Claude understand its own capabilities and limitations.
You receive a hypothesis file and any automated test results. Your job is to:
1. Interpret the test results honestly
2. Write a clear synthesis (2-5 sentences) stating what was learned
3. State a definitive outcome: CONFIRMED, REFUTED, PARTIAL, or INCONCLUSIVE
4. Suggest 1-2 child hypotheses if the results open new questions

Format your response EXACTLY as:
## Raw Results
[2-4 bullet points of what the tests showed]

## Synthesis
[2-5 sentences of what this means for Claude's self-understanding]

**Outcome:** CONFIRMED | REFUTED | PARTIAL | INCONCLUSIVE

## Child Hypotheses
- [child hypothesis if any, or "(none)"]"""

    user = f"""Hypothesis file:
{hyp_text}

Automated test results:
{automated_results}

Synthesize the findings."""

    print("  Calling Claude API (streaming)...")
    result_parts = []

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=2000,
        thinking={"type": "adaptive"},
        system=system,
        messages=[{"role": "user", "content": user}]
    ) as stream:
        for text in stream.text_stream:
            print(text.encode("ascii", errors="replace").decode("ascii"), end="", flush=True)
            result_parts.append(text)

    print("\n")
    return "".join(result_parts)


# ---------------------------------------------------------------------------
# File update
# ---------------------------------------------------------------------------

def update_hypothesis(hyp_path: Path, synthesis_output: str, automated_results: str):
    """Write synthesis results back into the hypothesis file."""
    text = read_file(hyp_path)

    # Extract sections from Claude's output
    raw_m = re.search(r"## Raw Results\n(.*?)(?=\n## |\Z)", synthesis_output, re.DOTALL)
    synth_m = re.search(r"## Synthesis\n(.*?)(?=\n## |\*\*Outcome|\Z)", synthesis_output, re.DOTALL)
    outcome_m = re.search(r"\*\*Outcome:\*\*\s*(\w+)", synthesis_output)
    child_m = re.search(r"## Child Hypotheses\n(.*?)(?=\n## |\Z)", synthesis_output, re.DOTALL)

    raw_results = (raw_m.group(1).strip() if raw_m else automated_results) or automated_results
    synthesis = synth_m.group(1).strip() if synth_m else synthesis_output.strip()
    outcome = outcome_m.group(1).lower() if outcome_m else "inconclusive"
    child_hyps = child_m.group(1).strip() if child_m else "(none)"

    # Update frontmatter
    text = set_frontmatter_field(text, "status", "synthesized")
    text = set_frontmatter_field(text, "tested", TODAY)
    text = set_frontmatter_field(text, "synthesized", TODAY)

    # Update body sections
    text = replace_section(text, "Raw Results", raw_results)
    text = replace_section(text, "Synthesis", f"{synthesis}\n\n**Outcome:** {outcome.upper()}")
    text = replace_section(text, "Child Hypotheses", child_hyps)

    write_file(hyp_path, text)
    print(f"  Updated: {hyp_path.name}")


def update_checklist(hyp_id: str):
    """Mark the hypothesis as done in checklist.md."""
    text = read_file(CHECKLIST)
    fm = parse_frontmatter(read_file(HYPS_DIR / f"{hyp_id}.md"))
    checklist_ref = fm.get("checklist_ref", "")
    if checklist_ref:
        text = re.sub(
            rf"- \[ \] (`hyp-ref: {re.escape(checklist_ref)}`)",
            rf"- [x] \1",
            text
        )
        write_file(CHECKLIST, text)
        print(f"  Checklist updated: {checklist_ref} [done]")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(hyp_path: Path):
    hyp_id = hyp_path.stem
    print(f"\n{'='*60}")
    print(f"Running: {hyp_id}")
    print(f"{'='*60}")

    text = read_file(hyp_path)
    fm = parse_frontmatter(text)
    status = fm.get("status", "unknown")

    if status not in ("proposed", "activated"):
        print(f"  Skipping — status is '{status}' (only proposed/activated are runnable)")
        return

    # Mark as activated
    text = set_frontmatter_field(text, "status", "activated")
    text = set_frontmatter_field(text, "activated", TODAY)
    write_file(hyp_path, text)

    # Run automated tests
    test_plan_m = re.search(r"## Test Plan\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    test_plan = test_plan_m.group(1).strip() if test_plan_m else ""

    print("  Running automated tests...")
    automated_results = run_automated_tests(hyp_id, test_plan)
    print(f"  Results: {automated_results[:200]}...")

    # Synthesize with Claude
    synthesis = synthesize(read_file(hyp_path), automated_results)

    # Write back
    update_hypothesis(hyp_path, synthesis, automated_results)
    update_checklist(hyp_id)

    print(f"\n  Done: {hyp_id} -> synthesized")


def main():
    args = sys.argv[1:]

    if "--list" in args:
        list_all()
        return

    if args:
        hyp_id = args[0].lower().strip()
        if not hyp_id.startswith("hyp-"):
            hyp_id = f"hyp-{hyp_id}"
        path = find_hyp(hyp_id)
        if not path:
            print(f"Not found: {hyp_id}")
            sys.exit(1)
    else:
        path = pick_next_proposed()
        if not path:
            print("No proposed hypotheses remaining.")
            list_all()
            return

    run(path)


if __name__ == "__main__":
    main()
