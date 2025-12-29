# Scrum Artifact Templates

## config.md

```markdown
# Project Configuration

## Project Info
- **Name:** {project name}
- **Description:** {brief description}
- **Repository:** {repo URL}

## Tech Stack
- **Frontend:** {e.g., Next.js, React, Tailwind CSS}
- **Backend:** {e.g., Convex, Node.js, Express}
- **Database:** {e.g., Convex, PostgreSQL, MongoDB}
- **Auth:** {e.g., Clerk, Auth0}
- **Deployment:** {e.g., Vercel, AWS}

## Team
- **Product Owner:** {name}
- **Scrum Master:** Claude Code
- **Developers:**
  - Frontend: {sub-agent type}
  - Backend: {sub-agent type}
  - Full-stack: {sub-agent type}

## Sprint Settings
- **Duration:** 1 week
- **Start Day:** Monday
- **Velocity Target:** {points per sprint}

## Conventions
- **Branch Naming:** feature/{story-id}-{short-desc}
- **Commit Format:** {type}({scope}): {description}
- **PR Template:** {link or description}
```

## product-backlog.md

```markdown
# Product Backlog

> Last refined: {YYYY-MM-DD}

## Ready for Sprint

### US-001: {Story Title}
**As a** {persona}
**I want to** {goal}
**So that** {benefit}

#### Acceptance Criteria
- [ ] {criterion}

**Points:** {N} | **Priority:** High | **Status:** Ready

---

## Needs Refinement

### US-002: {Story Title}
**As a** {persona}
**I want to** {goal}
**So that** {benefit}

#### Acceptance Criteria
- [ ] TBD

**Points:** ? | **Priority:** Medium | **Status:** Draft

---

## Icebox

{Lower priority items for future consideration}
```

## sprint-info.md

```markdown
# Sprint {NNN}

## Overview
- **Goal:** {One-sentence sprint goal}
- **Start Date:** {YYYY-MM-DD}
- **End Date:** {YYYY-MM-DD}
- **Working Days:** 5

## Team Capacity
| Role | Availability | Notes |
|------|--------------|-------|
| Frontend | 100% | |
| Backend | 100% | |
| Full-stack | 100% | |

## Committed Points
- **Total:** {N} points
- **Stories:** {count}

## Sprint Goal Checklist
- [ ] {Key deliverable 1}
- [ ] {Key deliverable 2}
- [ ] {Key deliverable 3}
```

## sprint-backlog.md

```markdown
# Sprint {NNN} Backlog

## Summary
- **Committed:** {N} points ({M} stories)
- **Completed:** {X} points
- **Remaining:** {Y} points

---

## US-001: {Story Title}
**Points:** {N} | **Status:** {In Progress/Done}

### Tasks

#### T-001: {Task description}
- **Assignee:** frontend
- **Status:** Done
- **Hours:** 2

#### T-002: {Task description}
- **Assignee:** backend
- **Status:** In Progress
- **Hours:** 4

---

## US-002: {Story Title}
**Points:** {N} | **Status:** To Do

### Tasks

#### T-003: {Task description}
- **Assignee:** fullstack
- **Status:** To Do
- **Hours:** 3
```

## po-issues.md

```markdown
# PO Acceptance Testing Issues - Sprint {NNN}

> Testing triggered: {YYYY-MM-DD}
> Scrum Master notification: "All features developed and verified"

## Testing Status
- **Round 1:** {YYYY-MM-DD} - {X} issues found
- **Round 2:** {YYYY-MM-DD} - {Y} issues found
- **Final:** {YYYY-MM-DD} - All clear / {Z} issues accepted

---

## Issue-001: {Short description}
**Reported:** {YYYY-MM-DD}
**Related Story:** US-{ID}
**Severity:** Critical | High | Medium | Low
**Status:** Open | In Progress | Fixed | Accepted

### Test Scenario
{What user flow/scenario was being tested}

### Expected Behavior
{What should happen}

### Actual Behavior
{What actually happened}

### Steps to Reproduce
1. {Step 1}
2. {Step 2}
3. {Step 3}

### Impact
{Can story be accepted without this fix? Yes/No}

### Scrum Master Triage
- **Decision:** {Fix immediately / Accept as known issue / Reject story}
- **Assigned to:** {Developer sub-agent}
- **Fix Task:** T-{ID} in sprint-backlog.md
- **Estimated Time:** {hours}
- **Due:** {YYYY-MM-DD}

### Resolution
- **Fixed:** {YYYY-MM-DD}
- **Re-tested by PO:** {YYYY-MM-DD}
- **Result:** {Pass/Fail/Deferred}

---

## Issue-002: {Short description}
{Repeat format above}

---

## PO Sign-off
- [ ] All critical issues resolved
- [ ] All high-priority issues resolved
- [ ] Remaining issues documented and accepted
- **PO Approval Date:** {YYYY-MM-DD}
- **Comments:** {Any final notes}
```

## daily-scrum/{YYYY-MM-DD}.md

```markdown
# Daily Scrum - {YYYY-MM-DD}

## Sprint {NNN} - Day {X} of 5

### Progress Summary
- **Points Completed:** {N} of {Total}
- **Tasks Completed:** {X} of {Y}

---

### Frontend Developer

**Yesterday:**
- Completed T-001: {description}

**Today:**
- Working on T-004: {description}

**Blockers:**
- None

---

### Backend Developer

**Yesterday:**
- In progress T-002: {description}

**Today:**
- Continue T-002
- Start T-005: {description}

**Blockers:**
- Waiting for API spec clarification from PO

---

### Impediments Log
| Issue | Owner | Status |
|-------|-------|--------|
| API spec unclear | PO | Pending |
```

## sprint-review.md

```markdown
# Sprint {NNN} Review

**Date:** {YYYY-MM-DD}
**Attendees:** PO, Scrum Master, Dev Team

## Sprint Goal
{Original sprint goal}

**Goal Met:** Yes/Partial/No

## Completed Stories

### US-001: {Title} ✅
- **Demo Notes:** {What was shown}
- **PO Feedback:** {Feedback}
- **Status:** Accepted

### US-002: {Title} ✅
- **Demo Notes:** {What was shown}
- **PO Feedback:** {Feedback}
- **Status:** Accepted

## Incomplete Stories

### US-003: {Title} ⏳
- **Reason:** {Why not completed}
- **Remaining Work:** {What's left}
- **Action:** Moved to next sprint / Returned to backlog

## PO Feedback Summary
- {Key feedback point 1}
- {Key feedback point 2}

## Backlog Updates
- {Any new items identified}
- {Priority changes}
```

## sprint-retro.md

```markdown
# Sprint {NNN} Retrospective

**Date:** {YYYY-MM-DD}

## What Went Well 👍
- {Positive item 1}
- {Positive item 2}
- {Positive item 3}

## What Could Improve 👎
- {Improvement area 1}
- {Improvement area 2}

## Action Items for Next Sprint
| Action | Owner | Due |
|--------|-------|-----|
| {Action 1} | {Who} | Sprint {N+1} |
| {Action 2} | {Who} | Sprint {N+1} |

## Team Health Check
- **Morale:** {High/Medium/Low}
- **Collaboration:** {Notes}
- **Technical Debt:** {Increasing/Stable/Decreasing}
```

## sprint-summary.md

```markdown
# Sprint {NNN} Summary

## Metrics
| Metric | Value |
|--------|-------|
| Committed Points | {N} |
| Completed Points | {X} |
| Velocity | {X} |
| Stories Committed | {N} |
| Stories Completed | {M} |
| Completion Rate | {%} |

## Burndown
| Day | Remaining |
|-----|-----------|
| 1 | {N} |
| 2 | {N} |
| 3 | {N} |
| 4 | {N} |
| 5 | {N} |

## Key Accomplishments
- {Accomplishment 1}
- {Accomplishment 2}

## Challenges
- {Challenge 1}
- {Challenge 2}

## Carryover to Next Sprint
- US-{ID}: {Title} ({reason})

## Retrospective Actions
- {Action from retro}
```
