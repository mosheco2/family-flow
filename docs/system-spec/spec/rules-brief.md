# Brief: business-rules specification (read-only)

You are writing part of a REBUILD-GRADE specification of the "WeFlowZ / family-flow" system, strictly from code. Do NOT modify any file in /home/user/family-flow. Read-only.

Code: /home/user/family-flow/server.js (46k lines, Express + PostgreSQL, all routes inline), clients in /home/user/family-flow/public/ (business-app.js, app.js, sa-app.js, zone-manager-app.js, kol-haam-app.js, storefront*.html ...).
Already available (do NOT repeat these mechanically): per-route contracts (params/body/SQL) and DB dictionary exist. Helpful machine data: /tmp/claude-0/-home-user-family-flow/588488ff-3593-542a-9d13-f38e6ccbce47/scratchpad/spec/api.json (array of routes: line,end,method,path,mw,body,query,sql,calls) — use it to find the routes of your domain quickly (filter by path prefix), then READ the handlers and client code.

What you must produce: the BUSINESS LOGIC a developer needs to re-implement your domain with identical behavior. For each business process / entity in your domain:
1. **מטרה וטריגר** — who starts it (role/environment/screen/cron) and when.
2. **תנאים מקדימים ואימותים** — every validation in code (required fields, ranges, ownership checks, module gating, plan limits), with exact error messages where short.
3. **שלבי עיבוד** — ordered steps as implemented, including every DB write (table + key columns) and its order; transaction or not.
4. **חישובים ונוסחאות** — exact formulas & constants (VAT, discounts, commissions, cashback %, FLW coin amounts, interest, rounding, time windows, limits), with line numbers.
5. **מכונת מצבים** — all status values used for the entity (including values sent from the client — grep the client for them), allowed transitions, who may trigger each, and side effects per transition.
6. **תופעות לוואי** — notifications (in-app/WhatsApp/email/SMS), coin/wallet movements, audit log, alerts, AI calls (provider+model+prompt purpose), cron jobs that act on the entity later.
7. **התנהגות ממשק** — the client screen(s) that drive it (file:function), key UI rules (what is shown/hidden by role or business type, client-side validation, polling intervals).
8. **פערים/באגים** — only if visible in code (inconsistency client vs server, dead code, missing checks). Short.

Precision rules: cite line numbers (server.js:N or file.js:N) for every rule. No speculation; if something is unclear write "לא נקבע בקוד". Hebrew prose, identifiers in English.

Output: write an HTML fragment (no <html>/<body>/<script>) to the output path given in your task, using exactly this structure, one block per process:
<section class="proc" data-f="keywords lowercase"><h3>שם התהליך</h3>
<div class="kv"><div>מטרה וטריגר</div><div>…</div><div>תנאים ואימותים</div><div><ul><li>…</li></ul></div><div>שלבי עיבוד</div><div><ol><li>…</li></ol></div><div>חישובים</div><div>…</div><div>מכונת מצבים</div><div>… (use a <div class="tbl-wrap"><table>…</table></div> for transitions: מ | ל | מי | תנאי | תופעות)</div><div>תופעות לוואי</div><div>…</div><div>ממשק</div><div>…</div><div>פערים</div><div>…</div></div></section>
Group processes under <h2 class="grp">sub-area</h2> headings. Escape < > & in text. Code identifiers in <code>. Omit a kv row only if truly empty. Be exhaustive for your domain — depth over brevity. Final reply: number of processes documented, list of process names, and top 5 notable rules/bugs with lines.
