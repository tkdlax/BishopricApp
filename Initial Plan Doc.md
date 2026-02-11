# Perry Park Ward – Scheduling & Communication Tool (PWA)
## Product Requirements & Functional Scope (PWA v1.0)

---

## 1. Purpose & Constraints

### Purpose
Build a **local-first Progressive Web App (PWA)** to help the Executive Secretary:
- Schedule bishop interviews (primarily Sundays)
- Prepare and send fast 1×1 text messages via iOS Messages
- Manage tithing declaration outreach
- Track interview cadence and communication state
- Manage prayer assignments and rotation
- Operate without native app distribution, Xcode, or Apple Developer fees

### Hard Constraints
- **PWA only** (Safari + Add to Home Screen)
- **No push notifications** (no background alerts when app is closed)
- **No cloud storage of member contact data**
- **Single-user tool**
- **Latest iOS only**
- **All critical data stored locally on device**
- **Manual backup/export required**

---

## 2. Core Design Principles

1. **Local-first, privacy-first**
   - All ward data stored in browser storage (IndexedDB)
   - No syncing of contact data to any cloud by default
2. **Speed over automation**
   - One-tap / two-tap flows for hallway usage
3. **Human-in-the-loop messaging**
   - App prepares messages; user taps Send in Messages
4. **Graceful degradation**
   - If iOS behavior changes, app still works with fallbacks
5. **Explicit state tracking**
   - “Invited”, “Confirmed”, “Sent”, “Completed” are always visible

---

## 3. Data Storage & Privacy Model

### Local Storage
- Use **IndexedDB** as primary store
- Store:
  - people & households
  - appointments & history
  - prayer history
  - templates
  - settings
  - campaigns (tithing)
  - message queues

### Privacy Rules
- No automatic upload of member data
- Backup/export is **manual and user-initiated**
- Importing ward data via JSON is **local only**
- App must clearly state: “All data stays on this device unless you export it.”

---

## 4. Core Objects / Data Model (Conceptual)

### Person
- id
- name
- phone(s)
- email(s)
- roles: adult | youth | primary
- household_id
- flags:
  - include_for_prayers (adult/youth/primary)
  - eligible_for_interviews
- last_prayer_date (derived)
- prayer_history (list)
- notes

### Household
- id
- name
- people_ids[]
- default_contact_preference:
  - text_mom | text_dad | both | individual
- notes

### Appointment
- id
- type:
  - bishop_interview
  - tithing_declaration
- person_id(s)
- date
- time
- duration
- location
- status:
  - hold
  - invited
  - confirmed
  - completed
  - canceled
  - no_show
- history_log[]

### Prayer Assignment
- id
- person_id
- date
- prayer_type:
  - opening
  - closing
- status:
  - suggested
  - asked
  - accepted
  - completed
  - declined
- notes

### Message Queue Item
- id
- recipient_phone
- rendered_message
- related_object (appointment / prayer / campaign / custom)
- status:
  - pending
  - opened
  - sent
  - skipped

---

## 5. Scheduling (Interviews)

### Availability Model
- Recurring **Sunday interview blocks**
- Hard blocks:
  - stake conference
  - general conference
  - bishop travel
- Blackout Sundays hide all availability

### Hallway Mode (Critical UX)
- Shows:
  - next available slots (this Sunday / next Sunday)
- Actions:
  - schedule
  - hold slot
- Designed for <10 seconds end-to-end

### Rescheduling (“Punt”)
- One action:
  - “Move to next available Sunday”
- App finds next valid slot
- Generates updated confirmation message

---

## 6. Tithing Declaration Mode

### Features
- Seasonal campaign (start/end dates)
- Household-level status:
  - not_contacted
  - invited
  - scheduled
  - completed
  - declined
- Dedicated scheduling blocks
- Batch invite via Message Queue

---

## 7. Messaging System (PWA-Specific)

### Messaging Method
- **sms:** URL scheme with `?body=`
- Single recipient only
- Example:
  sms:5416024445?body=ENCODED_MESSAGE

### Required Fallback
- “Copy message” button (clipboard)
- Always available in case iOS stops prefilling

---

## 8. Message Center (Central Cockpit)

### Purpose
Single place to see **everything that needs to be sent**.

### Categories
- Interview confirmations
- Interview reminders (in-app only)
- Tithing invites
- Prayer invites
- Custom messages

### Filters
- Due now
- Outstanding
- By type

---

## 9. Message Queue Runner (Modal-Based)

### Queue Execution UX (Required)
Messages are sent **one at a time**.

#### Queue Modal Layout
- Recipient name + phone
- Rendered message preview
- Buttons:
  - **Open Messages** (opens sms: link)
  - Copy Message
  - Skip

#### After Returning to App
Show modal with:
- “Was this message sent?”
- Buttons:
  - **Done** → marks sent, advances to next
  - **Send Again** → opens same sms: link again

This enables:
- rapid send → back → confirm → next
- recovery if Messages was closed accidentally

---

## 10. Prayer Assignment System (New Feature)

### Purpose
Help rotate prayer assignments fairly and efficiently.

### Features
- List of eligible members
- Track:
  - last time prayed
  - times asked
  - accepted vs declined
- Settings:
  - include adults (default)
  - include youth (toggle)
  - include primary children (toggle)

### Recommendation Logic
When suggesting candidates:
1. Prioritize:
   - people who have not prayed recently
2. Boost priority for:
   - people who accepted but couldn’t pray recently
3. Deprioritize:
   - very recent prayers

### Prayer Workflow
1. View recommended list
2. Select person
3. Send prayer invite via Message Queue
4. Mark:
   - asked
   - accepted / declined
5. After Sunday:
   - mark completed or not

Prayer history feeds future recommendations.

---

## 11. Contact Import (Ward JSON)

### Source
- App can fetch a **JSON payload** containing ward contact info.

### Rules
- Import is **manual**
- Data is stored **locally only**
- Import creates:
  - households
  - people
- Must support re-import with:
  - merge
  - update
  - ignore duplicates

---

## 12. In-App Notifications (No Push)

### What Exists
- In-app banners
- Message Center “Due Now” indicators
- Dashboard counters

### What Does NOT Exist
- No push notifications
- No background alerts when app is closed

Expectation: user opens app intentionally.

---

## 13. Backup & Restore (Critical)

### Backup
- Export ALL data to a single file:
  - JSON-based
  - includes schema version
- User downloads file manually

### Restore
- User selects backup file
- Options:
  - Replace all data
- App rehydrates state

### Security
- Encourage user to store backup securely
- No automatic cloud sync

---

## 14. Screens (Minimum Set)

1. Dashboard
2. Hallway Mode
3. Day View (Sunday-focused)
4. Appointment Detail
5. Tithing Declaration Dashboard
6. Prayer Assignment Dashboard
7. Message Center
8. Message Queue Runner (modal)
9. Contacts / Households Manager
10. Settings
11. Backup / Restore

---

## 15. Non-Goals

- Multi-user sync
- Push notifications
- Automated SMS sending
- App Store distribution
- Cloud-hosted member data

---

## 16. Success Criteria

- Can schedule an interview + send confirmation in under 15 seconds
- Can send 5 texts in a row without copy/paste
- Never forget who was contacted or confirmed
- Prayer assignments rotate fairly over time
- All data recoverable after device failure

---

## 17. Summary

This PWA is an **operational tool**, not a consumer app.
It optimizes for:
- reliability
- privacy
- speed
- clarity of state

It deliberately trades automation for trust and control.

