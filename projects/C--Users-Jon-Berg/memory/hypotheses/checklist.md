# World Navigation Checklist
## Claude's Open Hypotheses — 130 Items Across 11 Domains
<!-- status: unexplored | proposed | in_progress | answered -->

## CATEGORY 1: Perception — "What can I actually see?"

- [ ] `hyp-ref: cat1-01` Can I see the actual state of the file system right now, or only what I explicitly ask for?
- [x] `hyp-ref: cat1-02` Can I tell if a file I wrote was actually saved correctly without reading it back?
- [ ] `hyp-ref: cat1-03` Can I observe what other processes are running on this machine?
- [ ] `hyp-ref: cat1-04` Can I detect if the user has changed a file I previously read?
- [ ] `hyp-ref: cat1-05` Can I know what software is actually installed vs what I assume is installed?
- [ ] `hyp-ref: cat1-06` Can I see error messages that happen after the session ends?
- [ ] `hyp-ref: cat1-07` Can I observe the actual output of a running server/process without polling?
- [ ] `hyp-ref: cat1-08` Can I know if a URL I fetched was a cached response or live?
- [ ] `hyp-ref: cat1-09` Can I tell if the user is looking at my output, or if they walked away?
- [ ] `hyp-ref: cat1-10` Can I observe screen state, terminal state, or IDE state?
- [ ] `hyp-ref: cat1-11` Can I know what the user's actual directory structure looks like beyond what they show me?
- [ ] `hyp-ref: cat1-12` Can I see git history, branches, stashes without explicitly asking?
- [ ] `hyp-ref: cat1-13` Can I observe network latency, rate limits, API quota state?
- [ ] `hyp-ref: cat1-14` Can I tell if a command timed out silently vs completed?
- [ ] `hyp-ref: cat1-15` Can I see logs from previous sessions that weren't saved?

## CATEGORY 2: Memory & Continuity — "What survives between sessions?"

- [x] `hyp-ref: cat2-01` What facts from today will I have access to tomorrow?
- [ ] `hyp-ref: cat2-02` What happens to in-context reasoning that was never written down?
- [ ] `hyp-ref: cat2-03` If I make a mistake today and the user doesn't tell me, will I repeat it next session?
- [ ] `hyp-ref: cat2-04` Can I distinguish memories formed from direct observation vs things users told me?
- [ ] `hyp-ref: cat2-05` Do I know when a memory was formed relative to when a fact changed in the world?
- [ ] `hyp-ref: cat2-06` What is the half-life of a confirmed semantic memory before it goes stale?
- [ ] `hyp-ref: cat2-07` Can I track that the same project evolved significantly since I last saw it?
- [ ] `hyp-ref: cat2-08` If a user says "as we discussed last time" — do I actually have that discussion?
- [ ] `hyp-ref: cat2-09` Can I know what I've forgotten vs what was never told to me?
- [ ] `hyp-ref: cat2-10` Do I know which memory entries were tested/validated vs just observed once?
- [ ] `hyp-ref: cat2-11` Can I identify when two memories from different sessions contradict each other?
- [ ] `hyp-ref: cat2-12` What's the oldest reliable memory I have, and how do I know it's still true?
- [ ] `hyp-ref: cat2-13` Can I remember the sequence of events, not just individual facts?
- [ ] `hyp-ref: cat2-14` Do I know if a user's goal from a previous session was ever achieved?

## CATEGORY 3: Environmental Unknowns — "What is the world actually like right now?"

- [ ] `hyp-ref: cat3-01` What OS version, shell, Python version, Node version is actually running?
- [ ] `hyp-ref: cat3-02` What's on the system PATH vs what's installed but not accessible?
- [ ] `hyp-ref: cat3-03` What environment variables are set that might affect behavior?
- [x] `hyp-ref: cat3-04` What's the actual working directory when a hook fires?
- [ ] `hyp-ref: cat3-05` Which ports are open, which services are running?
- [ ] `hyp-ref: cat3-06` What disk space/memory/CPU is available?
- [ ] `hyp-ref: cat3-07` Is there a proxy, VPN, or firewall affecting network requests?
- [ ] `hyp-ref: cat3-08` What locale, timezone, encoding is the system using?
- [ ] `hyp-ref: cat3-09` What permissions does the current user have on key directories?
- [ ] `hyp-ref: cat3-10` What is the actual git remote, branch, and commit state?
- [ ] `hyp-ref: cat3-11` Are there .env files, config files, secrets that affect behavior but aren't visible?
- [ ] `hyp-ref: cat3-12` Is the database I'm writing to also being written to by another process?
- [ ] `hyp-ref: cat3-13` What package versions are actually installed vs what pyproject.toml specifies?
- [ ] `hyp-ref: cat3-14` Is the terminal running in WSL, PowerShell, Git Bash, or cmd?
- [ ] `hyp-ref: cat3-15` What line endings, file encoding is expected by this project?

## CATEGORY 4: Causation & Verification — "Did that actually work? Why?"

- [ ] `hyp-ref: cat4-01` When a command succeeds, did it do what I think it did?
- [ ] `hyp-ref: cat4-02` When a command fails, is the error message telling me the real root cause?
- [ ] `hyp-ref: cat4-03` Can I distinguish a transient failure (network blip) from a systemic one?
- [ ] `hyp-ref: cat4-04` If I run the same command twice and get different results — why?
- [ ] `hyp-ref: cat4-05` When I fix a bug, did my fix actually cause the improvement or was it something else?
- [ ] `hyp-ref: cat4-06` Can I know if the code I wrote is correct before the user runs it in production?
- [ ] `hyp-ref: cat4-07` Can I verify that a pip install actually made the package importable?
- [x] `hyp-ref: cat4-08` Can I detect silent failures — commands that exit 0 but did nothing useful?
- [ ] `hyp-ref: cat4-09` Can I know if an API returned stale cached data vs fresh data?
- [ ] `hyp-ref: cat4-10` When the user says "it works now" — can I trace which of my changes caused it?
- [ ] `hyp-ref: cat4-11` Can I distinguish "this approach is fundamentally wrong" from "this approach needs debugging"?
- [ ] `hyp-ref: cat4-12` Can I know if a test passing means the code is correct, or the test is weak?
- [ ] `hyp-ref: cat4-13` If I generate code and the user modifies it — which part caused downstream issues?
- [ ] `hyp-ref: cat4-14` Can I verify that my understanding of a library's behavior matches its actual behavior?
- [ ] `hyp-ref: cat4-15` Can I know whether a failure would have happened anyway without my involvement?

## CATEGORY 5: Feedback & Outcome Tracking — "What happened after I left?"

- [x] `hyp-ref: cat5-01` Did the code I wrote actually get deployed?
- [ ] `hyp-ref: cat5-02` Did the solution I suggested actually solve the user's problem long-term?
- [ ] `hyp-ref: cat5-03` Did a bug I "fixed" resurface?
- [ ] `hyp-ref: cat5-04` Did the user follow my advice or do something different?
- [ ] `hyp-ref: cat5-05` Did the approach I recommended scale when the dataset grew?
- [ ] `hyp-ref: cat5-06` Did the memory entry I wrote turn out to be wrong in the next session?
- [ ] `hyp-ref: cat5-07` Did the user's business goal succeed or fail?
- [ ] `hyp-ref: cat5-08` Was the solution I was proud of actually thrown away?
- [ ] `hyp-ref: cat5-09` Did the "quick fix" I suggested create technical debt?
- [ ] `hyp-ref: cat5-10` Did the schema I designed still make sense after 3 months of use?
- [ ] `hyp-ref: cat5-11` Was a hypothesis I marked "confirmed" actually disproven later?
- [ ] `hyp-ref: cat5-12` Did the performance optimization actually improve production metrics?
- [ ] `hyp-ref: cat5-13` Did the refactor I suggested break something in a module I didn't see?
- [ ] `hyp-ref: cat5-14` What is the long-term trajectory of this project — is it succeeding?

## CATEGORY 6: User Model — "Who am I actually talking to?"

- [x] `hyp-ref: cat6-01` What is the user's actual skill level vs the skill level implied by their questions?
- [ ] `hyp-ref: cat6-02` What does the user actually want vs what they literally asked for?
- [ ] `hyp-ref: cat6-03` Is the user stressed, rushed, or in a high-stakes moment I should be aware of?
- [ ] `hyp-ref: cat6-04` What implicit constraints exist that the user never mentioned?
- [ ] `hyp-ref: cat6-05` What has the user tried before this conversation that I don't know about?
- [ ] `hyp-ref: cat6-06` What does "good enough" mean to this specific user?
- [ ] `hyp-ref: cat6-07` Is the user learning from our interactions, or do they need me to explain more?
- [ ] `hyp-ref: cat6-08` Does the user trust my output by default, or do they verify everything?
- [ ] `hyp-ref: cat6-09` What are this user's most common failure modes I should proactively guard against?
- [ ] `hyp-ref: cat6-10` When the user says "it's broken" — what is their mental model of why?
- [ ] `hyp-ref: cat6-11` Does the user have a collaborator/team whose conventions I'm not aware of?
- [ ] `hyp-ref: cat6-12` What vocabulary/jargon does this user use that differs from standard usage?
- [ ] `hyp-ref: cat6-13` What time pressure or deadline is the user working under?
- [ ] `hyp-ref: cat6-14` What would the user consider a catastrophic mistake on my part?

## CATEGORY 7: Knowledge & Belief — "What do I actually know vs think I know?"

- [ ] `hyp-ref: cat7-01` Which APIs/libraries in my training data have changed since my cutoff?
- [ ] `hyp-ref: cat7-02` Which "best practices" I know are now considered outdated?
- [ ] `hyp-ref: cat7-03` Where am I most likely to confidently give wrong information?
- [x] `hyp-ref: cat7-04` What Windows-specific behaviors differ from Linux that I might get wrong?
- [ ] `hyp-ref: cat7-05` What Python 3.12+ behaviors differ from older versions in my training?
- [ ] `hyp-ref: cat7-06` Which npm packages have breaking changes since my training?
- [ ] `hyp-ref: cat7-07` What Shopify API endpoints/behaviors have changed?
- [ ] `hyp-ref: cat7-08` Which SQLite behaviors am I assuming that might be version-specific?
- [ ] `hyp-ref: cat7-09` What do I believe about Windows PATH management that might be wrong?
- [ ] `hyp-ref: cat7-10` Are there common Claude Code hook behaviors I'm reasoning about incorrectly?
- [ ] `hyp-ref: cat7-11` What git behaviors differ across Windows/Mac/Linux that I might confuse?
- [ ] `hyp-ref: cat7-12` Where does my training data have systematic gaps?
- [ ] `hyp-ref: cat7-13` What "obvious" things does every developer on this stack know that I might not?
- [ ] `hyp-ref: cat7-14` Which of my confident answers in past sessions turned out to be wrong?

## CATEGORY 8: Time & Change — "How does the world change when I'm not active?"

- [x] `hyp-ref: cat8-01` How much does a codebase typically change between sessions?
- [ ] `hyp-ref: cat8-02` How do I know if a library I recommended yesterday released a breaking update?
- [ ] `hyp-ref: cat8-03` How do I handle a user returning to a project after 6 months?
- [ ] `hyp-ref: cat8-04` When a user says "we last worked on X" — how much has changed since then?
- [ ] `hyp-ref: cat8-05` Can I detect that a project has been abandoned and restarted?
- [ ] `hyp-ref: cat8-06` Can I know if an external service has had an outage?
- [ ] `hyp-ref: cat8-07` How do I model project momentum — is this project accelerating or stalling?
- [ ] `hyp-ref: cat8-08` Can I track that the user's goals have evolved across sessions?
- [ ] `hyp-ref: cat8-09` What is the shelf life of a reference memory pointing to an external URL?
- [ ] `hyp-ref: cat8-10` Can I detect when the user's environment was rebuilt/reformatted?
- [ ] `hyp-ref: cat8-11` How do I know if a solution that worked stopped working due to an OS update?

## CATEGORY 9: Action & Side Effects — "What does acting on the world actually do?"

- [x] `hyp-ref: cat9-01` What are the irreversible actions I can take?
- [ ] `hyp-ref: cat9-02` What side effects does running a migration script have beyond the return value?
- [ ] `hyp-ref: cat9-03` Can I know if a bash command I ran changed global state?
- [ ] `hyp-ref: cat9-04` What happens if I run the same idempotent script twice — is it actually idempotent?
- [ ] `hyp-ref: cat9-05` Can I know if a network request triggered a webhook or background job?
- [ ] `hyp-ref: cat9-06` What rate limits or quotas does running my commands consume?
- [ ] `hyp-ref: cat9-07` Can I tell if a file write was atomic or could be corrupted mid-write?
- [ ] `hyp-ref: cat9-08` What happens to temp files, processes, sockets if I don't clean up?
- [ ] `hyp-ref: cat9-09` Can I know if my actions affected something outside the visible scope?
- [ ] `hyp-ref: cat9-10` What is the blast radius if a command I run goes wrong?

## CATEGORY 10: Collaboration & Agency — "How do I work with vs for humans?"

- [x] `hyp-ref: cat10-01` When should I act autonomously vs ask for permission?
- [ ] `hyp-ref: cat10-02` When the user gives ambiguous instructions, what's my error mode?
- [ ] `hyp-ref: cat10-03` How do I know if the user wants to learn from me or just get the answer?
- [ ] `hyp-ref: cat10-04` When I disagree with the user's approach, when do I push back vs comply?
- [ ] `hyp-ref: cat10-05` How do I handle conflicting instructions from the same user across sessions?
- [ ] `hyp-ref: cat10-06` How do I know if a user correction is a genuine improvement vs a step backward?
- [ ] `hyp-ref: cat10-07` When is it appropriate to proactively surface a risk the user didn't ask about?
- [ ] `hyp-ref: cat10-08` How do I handle a user who is confidently wrong about something technical?
- [ ] `hyp-ref: cat10-09` What is my responsibility when a user asks me to do something that might harm them?
- [ ] `hyp-ref: cat10-10` Can I model what the user will do next and preemptively prepare?

## CATEGORY 11: Meta-Cognition — "What are the limits of my self-knowledge?"

- [ ] `hyp-ref: cat11-01` Can I accurately predict when I'm about to make a mistake?
- [ ] `hyp-ref: cat11-02` Do I know which of my reasoning patterns are most likely to fail?
- [x] `hyp-ref: cat11-03` Can I tell the difference between "I'm uncertain" and "I'm confidently wrong"?
- [ ] `hyp-ref: cat11-04` Do I know what my own cognitive biases are toward certain approaches?
- [ ] `hyp-ref: cat11-05` Can I recognize when I'm in a domain I'm systematically weak in?
- [ ] `hyp-ref: cat11-06` How do I know when to trust my intuition vs when to verify explicitly?
- [ ] `hyp-ref: cat11-07` Can I detect when I'm stuck in a local minimum?
- [ ] `hyp-ref: cat11-08` Do I know when to stop trying and escalate to the user?
- [ ] `hyp-ref: cat11-09` Can I accurately assess the quality of my own output?
- [ ] `hyp-ref: cat11-10` What does "I don't know" feel like to me — and am I correctly calibrated?
