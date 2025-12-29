# Development Documentation

This directory contains development documentation for the StatPatternHub project.

## Purpose

Development documentation helps maintain context and knowledge about:
- Architecture decisions
- Implementation details
- Technical debt
- Future improvements
- Integration guides

## Usage with Claude Code

The `/dev-docs` and `/dev-docs-update` commands use this directory to:
1. **Create** comprehensive implementation plans
2. **Update** documentation after completing tasks
3. **Track** progress and decisions over time
4. **Maintain** context across development sessions

## Recommended Structure

```
docs/dev/
├── architecture/       # System architecture decisions
├── features/          # Feature implementation docs
├── patterns/          # Code patterns and best practices
├── integrations/      # Third-party integrations
└── active/           # Current development plans
```

## Document Types

### Architecture Docs
- System design decisions
- Technology choices
- Scalability considerations

### Feature Docs
- Feature specifications
- Implementation approaches
- Testing strategies

### Pattern Docs
- Coding patterns
- Best practices
- Reusable templates

### Integration Docs
- API integrations
- Service dependencies
- Configuration guides

## Example Usage

```bash
# Create a development plan
/dev-docs "Implement pattern versioning system"

# Update docs after completing a feature
/dev-docs-update "Pattern versioning complete - document implementation"
```

## Notes

- Use markdown format for all documentation
- Include code examples where relevant
- Link to related files in the codebase
- Keep documentation up-to-date as code evolves
