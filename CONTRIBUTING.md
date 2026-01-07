# Contributing to Graphium

Thank you for your interest in contributing to Graphium! This document provides guidelines and information for contributors.

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
4. Browse existing [issues](https://github.com/kocheck/Graphium/issues) to see what's being worked on

> **🤖 For AI Agents:** Please read [docs/context/AI_CONTEXT.md](docs/context/AI_CONTEXT.md) for specific context about this codebase.

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- Git
- Basic understanding of:
  - TypeScript
  - React
  - Electron
  - **Zustand** (State Management)

### Installation

```bash
# Clone the repository
git clone https://github.com/kocheck/Graphium.git
cd Graphium

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Project Structure (Key Folders)

```
graphium/
├── docs/               # Comprehensive documentation
├── electron/           # Main process code (Node.js) - Handles IPC & Windows
├── src/                # Renderer process code (React)
│   ├── components/     # React components
│   │   ├── Canvas/     # Map & Token rendering (Konva)
│   ├── store/          # Zustand state management (gameStore.ts)
│   └── utils/          # Utility functions (syncUtils.ts, assetProcessor.ts)
└── public/             # Static assets
```

## Code Conventions

### TypeScript

- Use explicit types for function parameters and return values.
- **Strict Null Checks**: Always handle `undefined`/`null`, especially in `syncUtils.ts` (state arrays can be sparse).
- Use interfaces for object shapes.

### State Management (Zustand)

- **Single Store**: `useGameStore` is the source of truth.
- **Sync Logic**: We use a `syncUtils.ts` delta detector to sync state between windows.
- **Do not manually dispatch IPC events** for state changes. Let `SyncManager` handle it automatically via diffing.

### Testing

- We use `Vitest` for unit testing.
- Run `npm run test` for a quick check.
- Run `npm run test:coverage` before major PRs.

## Documentation

### When to Update Documentation

Update documentation when you:

- Add new features or components
- Change existing APIs (especially Sync logic)
- Fix bugs that affect documented behavior

### Documentation Standards

- Write clear, concise explanations
- Include code examples for new features
- Update the [Documentation Index](docs/index.md) for new major docs

## Submitting Changes

### Before Submitting

1. **Test your changes**

   ```bash
   npm run dev      # Manual testing (Architect & World View)
   npm run test     # Unit tests
   npm run build    # Production build test
   ```

2. **Check code quality**

   ```bash
   npm run lint     # Linting
   ```

3. **Update documentation**
   - Add/update JSDoc comments
   - Update `AI_CONTEXT.md` if architectural patterns change.

### Pull Request Process

1. **Create a feature branch** `git checkout -b feature/your-feature-name`
2. **Push your changes** `git push origin feature/your-feature-name`
3. **Open a pull request**
   - Describe what changed and why
   - Include screenshots for UI changes

## Development Workflow

### Adding a New Feature

1. **Plan**: Review `AI_CONTEXT.md` and `ARCHITECTURE.md`.
2. **Implement**: Follow existing patterns (Command Palette, Sidebar).
3. **Test**: Manual testing in **both** Architect and World views.
4. **Document**: Update relevant docs.

### Fixing a Bug

1. **Reproduce**: Verify the bug exists.
2. **Investigate**: Check if it's a Sync issue (common).
3. **Fix**: Make minimal changes. **Beware of Sync Loops!**
4. **Test**: Verify fix works and doesn't break other features.

## License

By contributing to Graphium, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Graphium!
