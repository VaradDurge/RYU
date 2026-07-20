# Dismiss must cancel, never allow

**Problem:** Clearing a stale card could be mistaken for Approve if waiters get `allow`.

**Learned:** `POST /dismiss` responds `{ status: 'cancelled' }`; hooks fail-open (empty stdout). Same as timeout path trust rule.

**Rule:** Only `/decision` allow/deny unblocks tools. Dismiss = fail-open.
