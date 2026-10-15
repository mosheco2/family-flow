# Brief: build DECISION LOG items (read-only)
Goal: the owner will rebuild the system from our spec. For every GAP (bug, inconsistency, missing check, dead feature, doc-vs-code deviation) in your scope, produce one decision item that states what the code does today and what the correct to-be rule should be, so the owner can approve/change it. Do NOT modify anything under /home/user/family-flow.

Sources (scratchpad = /tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec):
- rules-<domain>.html — the "פערים" rows of each process are the primary source; the rest of the process explains intended behavior.
- s1-docsvscode.html (doc deviations table), s1-rbac.html (server enforcement gaps), s1-messages.html, s1-prompts.html, s1-seed.html, s1-erd.html (schema findings), s1-bizmatrix.html — use rows relevant to your scope.
- Code (/home/user/family-flow/server.js, public/*) — check when a gap is unclear. Cite lines.

Rules for items:
- One item per distinct decision. MERGE duplicates and closely related gaps (e.g. "no auth on all sport routes" = one item, listing routes). Typical scope yields 25–60 items.
- Prefer the behavior the product evidently INTENDS (UI text, guides, comments, other code paths) as the proposal. If intent is unclear, give the proposal plus 1–2 alternatives.
- Security items: propose the secure rule (auth required, ownership from session, etc.).
- Keep it concrete and implementable: rules a developer can code and test (include numbers, statuses, who may do what).
- Hebrew text; identifiers in English.

Output: a JSON array written to the path given in your task. Each element:
{"id":"<PREFIX>-NN", "domain":"<hebrew domain name>", "area":"<sub-area>",
 "category":"security|money|data-integrity|functional|ux|scope|docs|architecture",
 "severity":"critical|high|medium|low",
 "title":"short Hebrew title (≤ 80 chars)",
 "as_is":"what the code does today, with file:line refs (1–3 sentences)",
 "proposal":"the recommended to-be rule (1–4 sentences, testable)",
 "alternatives":["optional alternative rule", "..."],
 "refs":["server.js:123", "business-app.js:456", "rules-x.html#process name"]}
Validate the JSON parses (python -c "import json;json.load(open(path))"). Final reply: item count by severity and category, and the 5 most important items (id+title).
