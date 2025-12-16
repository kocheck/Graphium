# Contributing to Hyle

Thank you for your interest in contributing to Hyle! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Conventions](#code-conventions)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Getting Help](#getting-help)

## Getting Started

Before contributing, please:

1. Read the [README](README.md) for project overview
2. Review the [Architecture documentation](docs/architecture/ARCHITECTURE.md) to understand the system design
3. Check the [Code Conventions](docs/guides/CONVENTIONS.md) for coding standards
4. Browse existing [issues](https://github.com/your-username/hyle/issues) to see what's being worked on

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- Git
- Basic understanding of:
  - TypeScript
  - React
  - Electron

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/hyle.git
cd hyle

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Project Structure

```
hyle/
├── docs/               # Comprehensive documentation
├── electron/           # Main process code (Node.js)
├── src/                # Renderer process code (React)
│   ├── components/     # React components
│   ├── store/          # Zustand state management
│   └── utils/          # Utility functions
└── public/             # Static assets
```

For detailed information, see:
- [Documentation Index](docs/index.md) - AI-optimized navigation
- [Architecture Overview](docs/architecture/ARCHITECTURE.md) - System design
- [Tutorials](docs/guides/TUTORIALS.md) - Step-by-step guides

## Code Conventions

Please follow these conventions when contributing:

### TypeScript

- Use explicit types for function parameters and return values
- Avoid `any` types - use `unknown` if necessary
- Use interfaces for object shapes
- Use type guards for runtime validation

### React Components

- Use functional components with hooks
- Name files in PascalCase (e.g., `CanvasManager.tsx`)
- Include JSDoc comments for complex components
- Follow single responsibility principle

### State Management

- Use Zustand actions for all state mutations
- Never mutate state directly
- Keep state immutable
- Document state shape with interfaces

### Commit Messages

- Use conventional commits format: `type(scope): message`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Example: `feat(canvas): add ruler tool for distance measurement`
- Keep first line under 72 characters
- Add detailed description for complex changes

### Code Style

- Run `npm run lint` before committing
- Use Prettier for formatting (configured in `.prettierrc`)
- Follow existing code patterns in the file you're editing
- Add comments for non-obvious logic

For complete conventions, see [docs/guides/CONVENTIONS.md](docs/guides/CONVENTIONS.md).

## Documentation

### When to Update Documentation

Update documentation when you:
- Add new features or components
- Change existing APIs or behavior
- Fix bugs that affect documented behavior
- Add new architectural patterns

### Documentation Standards

- Write clear, concise explanations
- Include code examples for new features
- Use explicit file:line references for cross-references
- Update the [Documentation Index](docs/index.md) for new major docs
- Follow the style guide in [docs/guides/CONVENTIONS.md#documentation-standards](docs/guides/CONVENTIONS.md#documentation-standards)

### Where to Add Documentation

- **New components**: Add JSDoc comments in code + update component README
- **New features**: Update relevant docs/ files + add to index
- **API changes**: Update [IPC_API.md](docs/architecture/IPC_API.md) or [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- **Decisions**: Add entry to [DECISIONS.md](docs/architecture/DECISIONS.md)

## Submitting Changes

### Before Submitting

1. **Test your changes**
   ```bash
   npm run dev  # Manual testing
   npm run build  # Production build test
   ```

2. **Check code quality**
   ```bash
   npm run lint  # Linting
   npm run format  # Formatting (if available)
   ```

3. **Update documentation**
   - Add/update JSDoc comments
   - Update relevant docs/ files
   - Update CHANGELOG (if exists)

4. **Create descriptive commits**
   ```bash
   git add .
   git commit -m "feat(canvas): add fog of war layer with reveal areas"
   ```

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a pull request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - List any breaking changes

4. **Respond to feedback**
   - Address review comments
   - Push additional commits as needed
   - Keep discussion focused and respectful

5. **Merge requirements**
   - All CI checks pass
   - Code review approved
   - Documentation updated
   - No merge conflicts

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
- [ ] Tested in Architect View
- [ ] Tested in World View
- [ ] Tested save/load functionality
- [ ] Manual testing performed

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] Code follows project conventions
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No console errors or warnings
```

## Development Workflow

### Adding a New Feature

1. **Plan**: Review [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) and [DECISIONS.md](docs/architecture/DECISIONS.md)
2. **Implement**: Follow [CONVENTIONS.md](docs/guides/CONVENTIONS.md) and [TUTORIALS.md](docs/guides/TUTORIALS.md)
3. **Test**: Manual testing in both Architect and World views
4. **Document**: Update relevant docs and add examples
5. **Submit**: Create PR with clear description

### Fixing a Bug

1. **Reproduce**: Verify the bug exists
2. **Investigate**: Check [TROUBLESHOOTING.md](docs/guides/TROUBLESHOOTING.md)
3. **Fix**: Make minimal changes to resolve the issue
4. **Test**: Verify fix works and doesn't break other features
5. **Document**: Update troubleshooting guide if helpful
6. **Submit**: Create PR referencing the issue

### Refactoring Code

1. **Justify**: Explain why refactoring is needed
2. **Plan**: Ensure refactoring doesn't change behavior
3. **Incremental**: Make small, focused changes
4. **Test**: Verify all functionality still works
5. **Document**: Update architectural decisions if needed

## Code Review Guidelines

### For Contributors

- Be responsive to feedback
- Ask questions if you don't understand a comment
- Be open to suggestions and alternative approaches
- Keep discussions professional and respectful

### For Reviewers

- Be constructive and helpful
- Explain the "why" behind suggestions
- Acknowledge good work
- Focus on code, not the person

## Getting Help

### Resources

- **Documentation**: Start with [docs/index.md](docs/index.md)
- **Tutorials**: See [docs/guides/TUTORIALS.md](docs/guides/TUTORIALS.md)
- **Troubleshooting**: Check [docs/guides/TROUBLESHOOTING.md](docs/guides/TROUBLESHOOTING.md)
- **Architecture**: Read [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)

### Asking Questions

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For code-specific questions

When asking questions:
1. Search existing issues/discussions first
2. Provide context and details
3. Include error messages and logs
4. Describe what you've already tried

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information
- Other conduct inappropriate in a professional setting

## License

By contributing to Hyle, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Hyle! Your efforts help make this project better for everyone.
