# Perry Park Ward PWA — Complete Use Case Catalog

This document defines **all functional use cases** for the Perry Park Ward Executive Secretary PWA.  
It is the **authoritative checklist** for development, QA, and acceptance testing.

The app succeeds if **every use case below can be completed smoothly on an iPhone installed PWA** (Safari → Add to Home Screen), with all data stored locally and no cloud dependency.

---

## Legend

- **Actor**: Executive Secretary (primary), Bishop/Counselor (indirect)
- **Messaging**: Always single-recipient via `sms:` with templates
- **Data**: Local-only (IndexedDB)
- **Queue**: All outbound texts flow through the Message Queue Runner

---

# 1. Hallway Scheduling (Primary Daily Use)

## UC-1.1 — Schedule an interview in under 15 seconds (Hallway Mode)

**Scenario**  
Someone approaches you before/during church and asks for an interview.

**Steps**
1. Open app → Hallway Mode.
2. View next available Sunday slots.
3. Select a slot.
4. Select person (or household).
5. Create appointment.
6. Optionally add confirmation message to queue.

**Expected Outcome**
- Appointment created.
- Slot blocked.
- Confirmation queued.
- No double-booking.

---

## UC-1.2 — Quickly answer “When is the next opening?”

**Steps**
1. Open Hallway Mode.
2. See next available slot(s) this Sunday or next Sunday.

**Expected Outcome**
- Accurate availability respecting:
  - Existing appointments
  - Blackouts
  - Recurring Sunday blocks

---

## UC-1.3 — Schedule a rare weekday interview

**Steps**
1. Open scheduling flow.
2. Select weekday.
3. Select time.
4. Create appointment.

**Expected Outcome**
- Appointment stored correctly.
- Appears in Day View.
- Does not affect Sunday logic.

---

# 2. Rescheduling & Blackouts

## UC-2.1 — Punt an appointment to the next available Sunday

**Scenario**
An interview is canceled or needs to move.

**Steps**
1. Open appointment.
2. Tap “Punt to next available Sunday”.

**Expected Outcome**
- Next valid slot selected.
- Appointment moved.
- Updated message optionally queued.

---

## UC-2.2 — Block out a full Sunday

**Scenario**
Stake Conference, General Conference, bishop traveling.

**Steps**
1. Create blackout (manual or template).
2. Apply to date or recurrence.

**Expected Outcome**
- Sunday removed from availability.
- New appointments prevented.

---

## UC-2.3 — Apply blackout when appointments already exist

**Steps**
1. Apply blackout.
2. Choose:
   - Auto-move appointments
   - Mark as “needs reschedule”

**Expected Outcome**
- Explicit resolution.
- No silent data loss.

---

# 3. Messaging & Queue (Core Workflow)

## UC-3.1 — Send confirmation immediately after scheduling

**Steps**
1. Appointment created.
2. Confirmation added to queue.
3. Open Queue Runner.
4. Tap “Open Messages”.
5. Send message.
6. Return → Tap “Done”.

**Expected Outcome**
- Message marked sent.
- Next queued message auto-loads.

---

## UC-3.2 — Send multiple messages back-to-back

**Scenario**
Send 5 texts in a row.

**Steps**
1. Open Queue Runner.
2. Send message #1.
3. Return → Done.
4. Message #2 auto-loads.
5. Repeat.

**Expected Outcome**
- No copy/paste.
- No navigation friction.

---

## UC-3.3 — Re-send message if Messages closed accidentally

**Steps**
1. Return to app.
2. Tap “Send Again”.

**Expected Outcome**
- Same prefilled sms opens again.

---

## UC-3.4 — Skip a message with reason

**Steps**
1. Tap “Skip”.
2. Choose reason.

**Expected Outcome**
- Message marked skipped.
- Reason stored.
- Queue advances.

---

# 4. Message Center & Due Logic

## UC-4.1 — See everything that needs action today

**Steps**
1. Open Dashboard or Message Center.

**Expected Outcome**
- “Due now” list computed locally:
  - Unconfirmed interviews
  - Reminders
  - Follow-ups
  - Tithing invites
  - Prayer invites

---

## UC-4.2 — Send reminders based on time rules

**Steps**
1. Open app when reminder is due.
2. Message appears in “Due now”.

**Expected Outcome**
- No push required.
- Reminder actionable.

---

# 5. Tithing Declaration Mode

## UC-5.1 — See households needing tithing declaration

**Steps**
1. Open Tithing Dashboard.

**Expected Outcome**
- Household-level status:
  - Not contacted
  - Invited
  - Scheduled
  - Completed / Declined

---

## UC-5.2 — Send batch invites one-by-one

**Steps**
1. Select households.
2. Generate queue items.
3. Send via Queue Runner.

**Expected Outcome**
- Personalized messages.
- Explicit send for each.

---

# 6. Prayer Assignment Rotation

## UC-6.1 — See suggested people to say prayers

**Steps**
1. Open Prayer Assignments.

**Expected Outcome**
- Suggestions based on:
  - Least recent prayer
  - Accepted-but-not-completed
  - Eligibility rules
  - Youth/Primary toggles

---

## UC-6.2 — Invite someone to say a prayer

**Steps**
1. Select person.
2. Add prayer invite to queue.
3. Send message.

**Expected Outcome**
- Invite tracked.
- Status updated to “asked”.

---

## UC-6.3 — Track acceptance, decline, completion

**Steps**
1. Mark accepted / declined.
2. After Sunday, mark completed.

**Expected Outcome**
- History updated.
- Rotation logic adjusted.

---

## UC-6.4 — Prevent same person for opening & closing

**Expected Outcome**
- App does not suggest same person twice on same Sunday unless overridden.

---

# 7. Contacts & Households

## UC-7.1 — Import ward contact data safely

**Steps**
1. Paste / upload / fetch JSON.
2. Preview counts.
3. Confirm import.

**Expected Outcome**
- Normalized data only.
- No raw JSON stored.
- Duplicates flagged.

---

## UC-7.2 — Contact correct recipient for youth interviews

**Expected Outcome**
- Default to parent.
- Youth only if allowed and number exists.

---

# 8. Backup, Restore & Safety

## UC-8.1 — Export encrypted backup

**Steps**
1. Open Settings → Backup.
2. Enter password.
3. Download file.

**Expected Outcome**
- Encrypted backup containing all app state.

---

## UC-8.2 — Restore after reinstall or device change

**Steps**
1. Install app.
2. Restore backup.
3. Enter password.

**Expected Outcome**
- Full state restored:
  - Contacts
  - Appointments
  - Tasks
  - Templates
  - Queue
  - Prayer history

---

# 9. Privacy & App Lock

## UC-9.1 — Auto-lock app when idle

**Steps**
1. App idle for configured time.
2. PIN required.

**Expected Outcome**
- Sensitive data hidden.
- Manual unlock required.

---

# 10. Youth Interviews & Interview Requests (Task-Based)

## UC-10.1 — View upcoming youth interviews by leader

**Steps**
1. Open Youth Interviews view.
2. Filter by period and date.
3. Group by “with” (bishop / counselor).

**Expected Outcome**
- Clear list with status:
  - Not contacted
  - Waiting response
  - Scheduled
  - Completed

---

## UC-10.2 — Reach out to schedule youth interview (templated)

**Steps**
1. Select youth.
2. Choose recipient (mom/dad/youth).
3. Send scheduling text.

**Expected Outcome**
- Task updated to `waiting_response`.
- Message queued and sent.

---

## UC-10.3 — Create interview request task (any type)

**Scenario**
Bishop says “I need to meet with X.”

**Steps**
1. Create Interview Request Task.
2. Select person.
3. Select leader (bishop/counselor).
4. Select interview type.
5. Select recipient.

**Expected Outcome**
- Task created in `need_to_reach_out`.

---

## UC-10.4 — Send initial outreach for interview request

**Steps**
1. Open Task List.
2. Select task.
3. Tap “Send outreach”.

**Expected Outcome**
- Correct template used.
- Task moves to `waiting_response`.

---

## UC-10.5 — Schedule appointment from task after response

**Steps**
1. Open task.
2. Tap “Schedule now”.
3. Choose slot.
4. Appointment created.

**Expected Outcome**
- Task moves to `scheduled`.
- Appointment linked.
- Confirmation queued.

---

## UC-10.6 — Follow up when no response

**Steps**
1. Message Center shows follow-up due.
2. Send follow-up message.

**Expected Outcome**
- Follow-up logged.
- Task remains `waiting_response`.

---

# 11. Task List (Bishop Work Queue)

## UC-11.1 — Maintain bishop-driven task list

**Steps**
1. Add tasks quickly.
2. View grouped by status:
   - Need to reach out
   - Waiting response
   - Scheduled

**Expected Outcome**
- Nothing lost.
- Clear ownership and progress.

---

## UC-11.2 — Status-driven templates apply automatically

**Rules**
- `need_to_reach_out` → Initial outreach template
- `waiting_response` → Follow-up template
- `scheduled` → Confirmation template

**Expected Outcome**
- Correct template every time.
- No manual template selection required.

---

# 12. Acceptance Criteria (Must Be TRUE)

- Can schedule and confirm an interview in <15 seconds.
- Can send 5 texts in a row without copy/paste.
- Can always see what still needs action.
- Can rotate prayers fairly without guessing.
- Can recover full app state after wipe.
- No member data leaves device unless explicitly exported.

---

**End of Use Case Catalog**