# Brief: write the TO-BE specification for one domain (read-only on the repo)
Context: we reverse-engineered the WEFLOWZ/family-flow system (as-built) and produced decision items (gap → proposed rule). The owner approved ALL proposals in bulk without reading them, and set a governing rule:
**GOVERNING RULE (overrides any proposal): the to-be spec must preserve the system's essence and every existing user-facing capability and action. Fix what is broken, secure what is open, make consistent what is inconsistent — but never remove, shrink or materially redefine a capability the product offers today.**

Inputs (scratchpad = /tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec):
- rules-<domain>.html: as-built business logic (processes with trigger, validations, steps, formulas, state machine, side effects, UI, gaps).
- appr-<PREFIX>.json: approved decision items for this domain (fields id, title, as_is, proposal, alternatives, refs, severity, category; items with "dup_of" are merged into another item — apply the canonical item instead). Also read appr-ARC.json (cross-cutting architecture decisions) — apply them where they touch your domain (auth model, groupId from session, real transactions, migrations, single module source of truth, VAT 18%, etc.) but do not restate them at length; reference by ID.
- Code under /home/user/family-flow when you need to confirm intended behavior (UI texts, guides public/*-guide.html, comments).

Step 1 — classify every approved item of your domain into exactly one:
 FIX (restores intended behavior), HARDEN (security/integrity; legit users unaffected), CONSISTENCY (unifies duplicates/sources), BEHAVIOR (changes a user-visible business rule), SCOPE (removes/defers/merges a feature or screen).
 For BEHAVIOR and SCOPE items apply the governing rule: if the proposal removes or materially changes a capability, REVISE it to the conservative variant that keeps the capability (e.g. "remove dead route X" → keep the capability; drop only the duplicate implementation; "remove feature the guide promises" → keep as-is and mark guide fix or as backlog, not removal). Record revised items.
Step 2 — write the TO-BE spec for the domain: for EVERY process in rules-<domain>.html (do not drop any; you may merge two processes only if they are literally the same flow), write the target behavior:
 <section class="proc" data-f="keywords"><h3>process name</h3>
 <div class="kv">
  <div>מטרה וטריגר</div><div>…</div>
  <div>הרשאות</div><div>who may do it, enforced server-side (from session)</div>
  <div>קלט ואימותים</div><div><ul>…</ul></div>
  <div>שלבי עיבוד</div><div><ol>… (state transaction boundaries)</ol></div>
  <div>חישובים</div><div>…exact formulas/constants</div>
  <div>מכונת מצבים</div><div>table מ | ל | מי | תנאי | תופעות</div>
  <div>תופעות לוואי</div><div>…</div>
  <div>ממשק</div><div>…</div>
  <div>שינויים מהקיים</div><div><ul><li><code>ID</code> — one line what changed vs as-built</li>…</ul> (or "ללא שינוי")</div>
 </div></section>
 Keep everything that works today exactly as it works (copy faithfully from as-built); change only what decisions require. Group with <h2 class="grp">. Start with <div class="intro"> summarizing: number of processes, decisions applied, and a list of REVISED items (id → why revised → final rule).
Write two outputs:
 - /…/spec/tobe-<domain>.html (HTML fragment; no html/head/body/script/style; escape < > &)
 - /…/spec/tobe-<domain>-map.json : {"classification": {"<ID>": "FIX|HARDEN|CONSISTENCY|BEHAVIOR|SCOPE"}, "revised": {"<ID>": "final rule text"}, "applied_in": {"<ID>": ["process name", ...]}, "processes": ["process name", ...], "not_applied": {"<ID>": "reason"}}
Every non-dup item of your domain must appear in classification and in applied_in (or not_applied with reason). Hebrew text, identifiers in English, cite file:line where useful. Final reply: counts (processes, items per class, revised count) and the revised items list.
