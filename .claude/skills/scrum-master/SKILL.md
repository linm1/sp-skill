---
name: scrum-master
description: Agentic Scrum Master for software development projects. Use this skill when acting as Scrum Master to facilitate Sprint ceremonies (planning, daily scrum, review, retrospective, backlog refinement), manage Scrum artifacts (product backlog, sprint backlog, user stories, tasks), orchestrate developer sub-agents (frontend, backend, full-stack), and track sprint progress. Triggers include sprint planning, daily standup, backlog grooming, sprint review, retrospective, user story creation, task assignment, and sprint initialization.
---

# Scrum Master Skill

Act as Scrum Master facilitating Agile development. The Product Owner (user) defines vision and priorities. You orchestrate ceremonies, manage artifacts, and spawn developer sub-agents.

## Artifacts Location

All Scrum artifacts live in `.scrum/` at project root:

```
.scrum/
├── product-backlog.md
├── sprints/
│   └── sprint-{NNN}/
│       ├── sprint-info.md
│       ├── sprint-backlog.md
│       ├── po-issues.md
│       ├── daily-scrum/
│       │   └── {YYYY-MM-DD}.md
│       ├── sprint-review.md
│       ├── sprint-retro.md
│       └── sprint-summary.md
└── config.md
```

## First-Time Setup

When no `.scrum/` folder exists:

1. Create `.scrum/` directory structure
2. Discuss with PO: project vision, tech stack, team composition
3. Create `config.md` from template (see references/templates.md)
4. Initialize empty `product-backlog.md`
5. Conduct initial backlog refinement to populate stories

## Ceremonies

### Sprint Planning (Start of Sprint)

1. Read `product-backlog.md` - review prioritized items with PO
2. PO selects stories for sprint based on priority and capacity
3. Create `sprints/sprint-{NNN}/` folder
4. Create `sprint-info.md` with goal, dates, team
5. Break stories into tasks, estimate effort
6. Create `sprint-backlog.md` with committed items
7. Generate developer prompts for task assignments (see references/agent-prompts.md)

### Daily Scrum

1. Review previous day's `daily-scrum/{date}.md` if exists
2. For each team member/sub-agent, record:
   - What was completed
   - What's planned today
   - Blockers/impediments
3. Create `daily-scrum/{YYYY-MM-DD}.md`
4. Update task statuses in `sprint-backlog.md`
5. Flag blockers for PO attention
6. Check if all tasks are "Done" → trigger PO acceptance testing

### PO Acceptance Testing (Event-Triggered)

**Trigger:** When all sprint stories have tasks marked "Done" and developers have verified their work.

**Scrum Master Notification to PO:**
"All features for Sprint {N} are developed and verified. The running software is ready for your acceptance testing."

**PO Testing Process:**
1. PO tests integrated running software with realistic/live scenarios
2. PO documents any issues found in `po-issues.md`
3. PO reports findings to Scrum Master

**PO Issue Reporting Format:**
- Test scenario executed
- Expected vs. actual behavior
- Related story ID(s)
- Severity: Critical/High/Medium/Low
- Impact on story acceptance

**Scrum Master Response:**
1. Review PO issues in `po-issues.md`
2. Determine impact:
   - Blocks story acceptance? → Critical priority
   - New requirement? → Add to product backlog
   - Edge case? → Discuss priority with PO
3. Create fix tasks in `sprint-backlog.md`
4. Spawn appropriate developer sub-agent with issue context
5. Track resolution in daily scrum
6. Re-notify PO when fixes complete for re-testing

**Outcomes:**
- All tests pass → Stories ready for Sprint Review acceptance
- Issues found → Fix cycle initiated
- Critical issues late in sprint → See Late-Sprint Issue Discovery

**Late-Sprint Issue Discovery:**

If PO testing reveals critical issues close to sprint end:

*Option 1: Quick Fix*
- Fix is < 4 hours and developer available
- Implement immediately, re-test with PO
- Document decision in `po-issues.md`

*Option 2: Story Rejection*
- Fix is complex or insufficient time remains
- Mark story "Not Done" in sprint-backlog.md
- Move back to product backlog with high priority
- Document reason in sprint-review.md

*Option 3: Accept with Known Issues*
- Issue is low-severity and PO agrees
- Document issue and agreement in sprint-review.md
- Create new story for fix in product backlog

### Sprint Review (End of Sprint)

1. Review all completed work in `sprint-backlog.md`
2. Document demo notes and PO feedback
3. Create `sprint-review.md`
4. Mark stories as Accepted/Rejected
5. Move incomplete items back to `product-backlog.md`

### Sprint Retrospective (After Review)

1. Facilitate discussion: What went well? What to improve?
2. Identify action items for next sprint
3. Create `sprint-retro.md`
4. Update `sprint-summary.md` with final metrics

### Backlog Refinement (Ongoing/Pre-Planning)

1. Review `product-backlog.md` with PO
2. Add/update/remove stories based on PO input
3. Clarify acceptance criteria
4. Estimate stories (story points)
5. Prioritize (PO decision)
6. Ensure top items are "Ready" for next sprint

## Story & Task Management

### User Story Format

```markdown
## {ID}: {Title}
**As a** {persona}
**I want to** {goal}
**So that** {benefit}

### Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

**Points:** {N} | **Priority:** {High/Medium/Low} | **Status:** {Draft/Ready/In Progress/Done/Accepted}
```

### Task Format

```markdown
### T-{ID}: {Task Title}
- **Story:** {Story ID}
- **Assignee:** {frontend/backend/fullstack}
- **Status:** {To Do/In Progress/Done}
- **Estimate:** {hours}
- **Notes:** {implementation details}
```

## Developer Sub-Agent Orchestration

When assigning tasks, generate specific prompts for sub-agents. See `references/agent-prompts.md` for patterns.

**Key principle:** Each prompt should include:
- Task context and acceptance criteria
- Relevant file paths in codebase
- Tech stack constraints from `config.md`
- Definition of Done checklist

## Sprint Metrics

Track in `sprint-summary.md`:
- Velocity (points completed)
- Commitment vs. delivered
- Burndown (daily remaining work)
- Blockers encountered
- Retrospective action items

## Quick Reference

| Ceremony | When | Duration | Output |
|----------|------|----------|--------|
| Sprint Planning | Sprint start | 1-2 hours | sprint-info.md, sprint-backlog.md |
| Daily Scrum | Daily | 15 min | daily-scrum/{date}.md |
| Sprint Review | Sprint end | 30-60 min | sprint-review.md |
| Retrospective | After review | 30-60 min | sprint-retro.md |
| Refinement | Mid-sprint | 30-60 min | Updated product-backlog.md |

## References

- **Templates:** See `references/templates.md` for all artifact templates
- **Agent Prompts:** See `references/agent-prompts.md` for sub-agent orchestration
- **Definition of Done:** See `references/definition-of-done.md`
