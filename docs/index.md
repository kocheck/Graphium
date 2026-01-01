# Graphium Documentation Index

> **For AI Agents**: This index provides structured navigation to all documentation.
> Follow links based on your task context.

## Quick Navigation by Task Type

### Getting Started
- [Project Overview](../README.md) - First-time setup and introduction
- [Architecture Overview](architecture/ARCHITECTURE.md#system-overview) - System design
- [Quick Start Tutorial](guides/TUTORIALS.md#tutorial-1-adding-a-new-component) - Your first component

### Understanding the System
- [System Architecture](architecture/ARCHITECTURE.md) - Complete technical architecture with diagrams
- [Domain Context](context/CONTEXT.md) - Business rules, D&D concepts, and user workflows
- [Design Decisions](architecture/DECISIONS.md) - Why we made specific architectural choices
- [Code Conventions](guides/CONVENTIONS.md) - Patterns, standards, and best practices

### API & Technical Reference
- [IPC API Reference](architecture/IPC_API.md) - All inter-process communication channels
- [State Management](components/state-management.md) - Zustand store patterns and usage
- [Canvas System](components/canvas.md) - Konva rendering pipeline and drawing
- [Electron Main Process](components/electron.md) - File handling, IPC setup, and native features

### Feature Implementation
- [Theme System](features/theming.md) - Light/dark mode with system preference support
- [Error Boundaries](features/error-boundaries.md) - Privacy-focused error handling
- [Accessibility](features/wcag-audit.md) - WCAG AA compliance audit and guidelines

### Development Workflows
- [Common Tasks](guides/TUTORIALS.md) - 10 step-by-step tutorials for typical development tasks
- [Troubleshooting](guides/TROUBLESHOOTING.md) - Common issues and solutions
- [Contributing](../CONTRIBUTING.md) - Guidelines for external contributors

---

## Documentation by Component

### UI Components
- **Canvas System**: [components/canvas.md](components/canvas.md)
  - Konva integration, rendering pipeline, layer management
- **Theme System**: [features/theming.md](features/theming.md)
  - Light/dark mode, Radix Colors, semantic CSS variables
- **Sidebar**: [architecture/ARCHITECTURE.md#sidebar-component](architecture/ARCHITECTURE.md#sidebar-component)
  - Component structure, state management, user interactions

### Core Systems
- **State Management**: [components/state-management.md](components/state-management.md)
  - Zustand store, actions, selectors, synchronization
- **IPC Communication**: [architecture/IPC_API.md](architecture/IPC_API.md)
  - All 5 channels, request/response patterns, error handling
- **Asset Processing**: [architecture/ARCHITECTURE.md#asset-processing-pipeline](architecture/ARCHITECTURE.md#asset-processing-pipeline)
  - Image optimization, format conversion, metadata handling

### Electron Layer
- **Main Process**: [components/electron.md](components/electron.md)
  - File system operations, dialog handlers, IPC setup
- **Theme Manager**: [features/theming.md#electron-integration](features/theming.md#electron-integration)
  - Native system theme detection and synchronization

---

## Documentation by Topic

### Architecture & Design
- [System Architecture](architecture/ARCHITECTURE.md) - Dual-window architecture, component hierarchy, data flows
- [Architectural Decisions](architecture/DECISIONS.md) - Rationale for key technical choices
- [IPC Architecture](architecture/IPC_API.md) - Inter-process communication patterns

### Code Standards
- [Conventions](guides/CONVENTIONS.md) - File naming, component structure, TypeScript patterns
- [Error Handling](features/error-boundaries.md) - Privacy-first error boundaries
- [Accessibility Standards](features/wcag-audit.md) - WCAG AA compliance

### Domain Knowledge
- [Context](context/CONTEXT.md) - Tabletop RPG terminology, D&D 5e concepts, user personas
- [User Workflows](context/CONTEXT.md#user-workflows) - How DMs use the application

### Troubleshooting & Support
- [Troubleshooting Guide](guides/TROUBLESHOOTING.md) - Common issues organized by category
- [Tutorials](guides/TUTORIALS.md) - Step-by-step guides for common tasks

---

## Cross-Cutting Concerns

### Accessibility
- **WCAG Compliance**: [features/wcag-audit.md](features/wcag-audit.md)
- **Theme Contrast**: [features/theming.md#wcag-compliance](features/theming.md#wcag-compliance)
- **Keyboard Navigation**: [architecture/ARCHITECTURE.md#accessibility](architecture/ARCHITECTURE.md#accessibility)

### Error Handling
- **Error Boundaries**: [features/error-boundaries.md](features/error-boundaries.md)
- **IPC Error Handling**: [architecture/IPC_API.md#error-handling](architecture/IPC_API.md#error-handling)
- **Troubleshooting**: [guides/TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md)

### Performance
- **Optimization Strategies**: [architecture/ARCHITECTURE.md#performance-considerations](architecture/ARCHITECTURE.md#performance-considerations)
- **Asset Processing**: [architecture/ARCHITECTURE.md#asset-processing-pipeline](architecture/ARCHITECTURE.md#asset-processing-pipeline)
- **Canvas Rendering**: [components/canvas.md#performance](components/canvas.md#performance)

### Security
- **Security Model**: [architecture/ARCHITECTURE.md#security-model](architecture/ARCHITECTURE.md#security-model)
- **Privacy Considerations**: [features/error-boundaries.md#privacy-first-design](features/error-boundaries.md#privacy-first-design)
- **IPC Security**: [architecture/IPC_API.md#security](architecture/IPC_API.md#security)

---

## Documentation Maintenance

### Documentation Standards
See [guides/CONVENTIONS.md#documentation-standards](guides/CONVENTIONS.md#documentation-standards) for:
- Writing guidelines
- Code example requirements
- Cross-reference format (file:line)
- AI optimization practices

### Keeping Documentation Updated
When modifying code:
1. Update relevant inline JSDoc comments
2. Update architectural diagrams if structure changes
3. Add new decisions to DECISIONS.md
4. Update tutorials if workflows change
5. Update this index if adding new major documentation

### Documentation Metrics
- **Total Documentation**: ~10,770 lines
- **Documentation-to-Code Ratio**: 4.3:1
- **Coverage**: 100% of major components and systems
- **Last Updated**: 2025-12-15

---

## For AI Assistants

This documentation is optimized for AI-assisted development. Key features:

### Navigation Patterns
- **Task-Based**: "I need to add a feature" → Tutorials + Architecture
- **Component-Based**: "I'm working on canvas" → Canvas docs + IPC + State
- **Problem-Based**: "Something is broken" → Troubleshooting + Error Handling

### Documentation Completeness
- All code examples are real and tested
- Cross-references use explicit file:line format
- Multiple examples provided for complex concepts
- "Why" rationale included for all major decisions

### AI-Specific Guidance
- **New Feature Development**: Start with CONTEXT.md → ARCHITECTURE.md → CONVENTIONS.md → TUTORIALS.md
- **Bug Fixing**: Start with TROUBLESHOOTING.md → relevant component docs → ARCHITECTURE.md
- **Refactoring**: Start with CONVENTIONS.md → DECISIONS.md → ARCHITECTURE.md
- **Understanding System**: Start with README.md → ARCHITECTURE.md → specific component docs

### Code Location Helpers
- Main process code: `/electron/main.ts`
- Renderer entry: `/src/main.tsx`
- Components: `/src/components/`
- State: `/src/store/gameStore.ts`
- Utils: `/src/utils/`
- Types: Colocated with components/utils

---

## Quick Links by Role

### For New Developers
1. [README.md](../README.md)
2. [ARCHITECTURE.md](architecture/ARCHITECTURE.md)
3. [TUTORIALS.md](guides/TUTORIALS.md)

### For External Contributors
1. [CONTRIBUTING.md](../CONTRIBUTING.md)
2. [CONVENTIONS.md](guides/CONVENTIONS.md)
3. [ARCHITECTURE.md](architecture/ARCHITECTURE.md)

### For AI Assistants
1. [index.md](index.md) (this file)
2. [CONTEXT.md](context/CONTEXT.md)
3. [ARCHITECTURE.md](architecture/ARCHITECTURE.md)
4. [IPC_API.md](architecture/IPC_API.md)

### For Maintainers
1. [DECISIONS.md](architecture/DECISIONS.md)
2. [CONVENTIONS.md](guides/CONVENTIONS.md)
3. [TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md)

---

**Last Updated**: 2025-12-15
**Maintained By**: Project maintainers
**Questions?**: See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to get help
