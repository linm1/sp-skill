#!/usr/bin/env python3
"""
Initialize a new sprint folder with all required files.

Usage:
    python init_sprint.py <sprint_number> [project_path]
    
Examples:
    python init_sprint.py 1
    python init_sprint.py 2 /path/to/project
"""

import os
import sys
from datetime import datetime, timedelta

def get_sprint_dates(start_date: datetime = None) -> tuple:
    """Calculate sprint start and end dates (1 week sprint)."""
    if start_date is None:
        # Default to next Monday
        today = datetime.now()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0 and today.hour >= 9:
            days_until_monday = 7
        start_date = today + timedelta(days=days_until_monday)
    
    start = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=4)  # Friday
    return start, end


def create_sprint_info(path: str, sprint_num: int, start: datetime, end: datetime) -> None:
    """Create sprint-info.md."""
    content = f"""# Sprint {sprint_num:03d}

## Overview
- **Goal:** TODO - Define sprint goal with PO
- **Start Date:** {start.strftime('%Y-%m-%d')} (Monday)
- **End Date:** {end.strftime('%Y-%m-%d')} (Friday)
- **Working Days:** 5

## Team Capacity
| Role | Availability | Notes |
|------|--------------|-------|
| Frontend | 100% | |
| Backend | 100% | |
| Full-stack | 100% | |

## Committed Points
- **Total:** 0 points
- **Stories:** 0

## Sprint Goal Checklist
- [ ] TODO: Key deliverable 1
- [ ] TODO: Key deliverable 2

---
*Update during Sprint Planning*
"""
    with open(path, 'w') as f:
        f.write(content)


def create_sprint_backlog(path: str, sprint_num: int) -> None:
    """Create sprint-backlog.md."""
    content = f"""# Sprint {sprint_num:03d} Backlog

## Summary
- **Committed:** 0 points (0 stories)
- **Completed:** 0 points
- **Remaining:** 0 points

---

## Committed Stories

*Add stories from product backlog during Sprint Planning*

### Story Template
```markdown
## US-XXX: Story Title
**Points:** N | **Status:** To Do

### Tasks

#### T-XXX: Task description
- **Assignee:** frontend/backend/fullstack
- **Status:** To Do
- **Hours:** N
```

---
*Update task statuses during Daily Scrum*
"""
    with open(path, 'w') as f:
        f.write(content)


def create_sprint_review(path: str, sprint_num: int) -> None:
    """Create sprint-review.md template."""
    content = f"""# Sprint {sprint_num:03d} Review

**Date:** TODO
**Attendees:** PO, Scrum Master, Dev Team

## Sprint Goal
TODO: Copy from sprint-info.md

**Goal Met:** TODO (Yes/Partial/No)

## Completed Stories

*Document each completed story after demo*

## Incomplete Stories

*Document any stories not completed*

## PO Feedback Summary
- TODO

## Backlog Updates
- TODO

---
*Complete during Sprint Review ceremony*
"""
    with open(path, 'w') as f:
        f.write(content)


def create_sprint_retro(path: str, sprint_num: int) -> None:
    """Create sprint-retro.md template."""
    content = f"""# Sprint {sprint_num:03d} Retrospective

**Date:** TODO

## What Went Well 👍
- 

## What Could Improve 👎
- 

## Action Items for Next Sprint
| Action | Owner | Due |
|--------|-------|-----|
| | | Sprint {sprint_num + 1:03d} |

## Team Health Check
- **Morale:** 
- **Collaboration:** 
- **Technical Debt:** 

---
*Complete during Sprint Retrospective ceremony*
"""
    with open(path, 'w') as f:
        f.write(content)


def create_sprint_summary(path: str, sprint_num: int) -> None:
    """Create sprint-summary.md template."""
    content = f"""# Sprint {sprint_num:03d} Summary

## Metrics
| Metric | Value |
|--------|-------|
| Committed Points | 0 |
| Completed Points | 0 |
| Velocity | 0 |
| Stories Committed | 0 |
| Stories Completed | 0 |
| Completion Rate | 0% |

## Burndown
| Day | Remaining |
|-----|-----------|
| Mon | |
| Tue | |
| Wed | |
| Thu | |
| Fri | |

## Key Accomplishments
- 

## Challenges
- 

## Carryover to Next Sprint
- 

## Retrospective Actions
- 

---
*Complete at end of sprint*
"""
    with open(path, 'w') as f:
        f.write(content)


def init_sprint(sprint_num: int, project_path: str) -> None:
    """Initialize a new sprint folder."""
    scrum_path = os.path.join(project_path, '.scrum')
    
    if not os.path.exists(scrum_path):
        print(f"❌ Error: .scrum/ not found at {project_path}")
        print("   Run init_scrum.py first to initialize project.")
        sys.exit(1)
    
    sprint_folder = f"sprint-{sprint_num:03d}"
    sprint_path = os.path.join(scrum_path, 'sprints', sprint_folder)
    
    if os.path.exists(sprint_path):
        print(f"⚠️  Sprint {sprint_num:03d} already exists at {sprint_path}")
        return
    
    # Create sprint folder and daily-scrum subfolder
    os.makedirs(sprint_path)
    os.makedirs(os.path.join(sprint_path, 'daily-scrum'))
    print(f"✅ Created: {sprint_path}")
    
    # Calculate dates
    start, end = get_sprint_dates()
    
    # Create sprint files
    create_sprint_info(os.path.join(sprint_path, 'sprint-info.md'), sprint_num, start, end)
    create_sprint_backlog(os.path.join(sprint_path, 'sprint-backlog.md'), sprint_num)
    create_sprint_review(os.path.join(sprint_path, 'sprint-review.md'), sprint_num)
    create_sprint_retro(os.path.join(sprint_path, 'sprint-retro.md'), sprint_num)
    create_sprint_summary(os.path.join(sprint_path, 'sprint-summary.md'), sprint_num)
    
    print(f"""
🏃 Sprint {sprint_num:03d} initialized!

Files created:
├── sprint-info.md      <- Sprint goal, dates, capacity
├── sprint-backlog.md   <- Committed stories & tasks
├── daily-scrum/        <- Daily standup notes
├── sprint-review.md    <- Review ceremony notes
├── sprint-retro.md     <- Retrospective notes
└── sprint-summary.md   <- Final metrics & summary

Next steps:
1. Conduct Sprint Planning with PO
2. Select stories from product-backlog.md
3. Break stories into tasks
4. Update sprint-info.md with goal and commitments
5. Generate sub-agent prompts for task assignments
""")


def main():
    if len(sys.argv) < 2:
        print("Usage: python init_sprint.py <sprint_number> [project_path]")
        sys.exit(1)
    
    try:
        sprint_num = int(sys.argv[1])
    except ValueError:
        print(f"❌ Error: Invalid sprint number: {sys.argv[1]}")
        sys.exit(1)
    
    if len(sys.argv) > 2:
        project_path = sys.argv[2]
    else:
        project_path = os.getcwd()
    
    if not os.path.isdir(project_path):
        print(f"❌ Error: {project_path} is not a valid directory")
        sys.exit(1)
    
    init_sprint(sprint_num, project_path)


if __name__ == '__main__':
    main()
