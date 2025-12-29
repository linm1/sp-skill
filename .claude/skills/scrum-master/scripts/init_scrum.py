#!/usr/bin/env python3
"""
Initialize .scrum/ folder structure in a project.

Usage:
    python init_scrum.py [project_path]
    
If project_path is omitted, uses current directory.
"""

import os
import sys
from datetime import datetime

def create_config_md(path: str) -> None:
    """Create initial config.md template."""
    content = """# Project Configuration

## Project Info
- **Name:** {PROJECT_NAME}
- **Description:** {DESCRIPTION}
- **Repository:** {REPO_URL}

## Tech Stack
- **Frontend:** TODO
- **Backend:** TODO
- **Database:** TODO
- **Auth:** TODO
- **Deployment:** TODO

## Team
- **Product Owner:** TODO
- **Scrum Master:** Claude Code
- **Developers:**
  - Frontend: sub-agent
  - Backend: sub-agent
  - Full-stack: sub-agent

## Sprint Settings
- **Duration:** 1 week
- **Start Day:** Monday
- **Velocity Target:** TBD (establish after 2-3 sprints)

## Conventions
- **Branch Naming:** feature/{story-id}-{short-desc}
- **Commit Format:** {type}({scope}): {description}
- **PR Template:** TODO

---
*Configure this file during project setup with Product Owner.*
"""
    with open(path, 'w') as f:
        f.write(content)


def create_product_backlog_md(path: str) -> None:
    """Create initial empty product backlog."""
    content = f"""# Product Backlog

> Last refined: {datetime.now().strftime('%Y-%m-%d')}

## Ready for Sprint

*No stories ready yet. Conduct backlog refinement with Product Owner.*

---

## Needs Refinement

*Add draft stories here during refinement sessions.*

---

## Icebox

*Lower priority items for future consideration.*

---

## Story Template

```markdown
## US-XXX: Story Title
**As a** [persona]
**I want to** [goal]
**So that** [benefit]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

**Points:** ? | **Priority:** Medium | **Status:** Draft
```
"""
    with open(path, 'w') as f:
        f.write(content)


def init_scrum(project_path: str) -> None:
    """Initialize .scrum/ folder structure."""
    scrum_path = os.path.join(project_path, '.scrum')
    
    if os.path.exists(scrum_path):
        print(f"⚠️  .scrum/ already exists at {scrum_path}")
        print("   Use existing structure or delete and re-run.")
        return
    
    # Create directory structure
    dirs = [
        scrum_path,
        os.path.join(scrum_path, 'sprints'),
    ]
    
    for d in dirs:
        os.makedirs(d, exist_ok=True)
        print(f"✅ Created: {d}")
    
    # Create config.md
    config_path = os.path.join(scrum_path, 'config.md')
    create_config_md(config_path)
    print(f"✅ Created: {config_path}")
    
    # Create product-backlog.md
    backlog_path = os.path.join(scrum_path, 'product-backlog.md')
    create_product_backlog_md(backlog_path)
    print(f"✅ Created: {backlog_path}")
    
    print(f"""
🎉 Scrum structure initialized at {scrum_path}

Next steps:
1. Edit config.md with Product Owner to set project details
2. Conduct initial backlog refinement to add stories
3. Run Sprint Planning to start Sprint 001

Structure:
.scrum/
├── config.md           <- Configure project & team
├── product-backlog.md  <- Add user stories here
└── sprints/            <- Sprint folders created during planning
""")


def main():
    if len(sys.argv) > 1:
        project_path = sys.argv[1]
    else:
        project_path = os.getcwd()
    
    if not os.path.isdir(project_path):
        print(f"❌ Error: {project_path} is not a valid directory")
        sys.exit(1)
    
    init_scrum(project_path)


if __name__ == '__main__':
    main()
