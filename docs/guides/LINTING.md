# Linting Guide for Graphium

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Configuration Files](#configuration-files)
- [Rule Categories](#rule-categories)
- [Common Errors and Fixes](#common-errors-and-fixes)
- [Editor Integration](#editor-integration)
- [CI/CD Integration](#cicd-integration)
- [Requesting Rule Changes](#requesting-rule-changes)

---

## Overview

Graphium uses a comprehensive linting setup to ensure code quality, consistency, and prevent bugs. The linting system includes:

- **ESLint** - JavaScript/TypeScript linting with strict rules
- **TypeScript** - Strict type checking
- **Prettier** - Code formatting (integrated with ESLint)
- **Pre-commit hooks** - Automatic linting before commits
- **CI/CD checks** - Automated quality gates

### Why Strict Linting?

1. **Prevent Bugs Early** - Catch errors before they reach production
2. **Enforce Consistency** - Maintain uniform code style across the codebase
3. **Guide Development** - Provide immediate feedback on code quality
4. **AI-Assisted Development** - Prevent common AI agent errors and hallucinations
5. **Improve Maintainability** - Make code easier to read, review, and modify

---

## Quick Start

### First Time Setup

```bash
# Install dependencies (includes all linting tools)
npm install

# Run linter to check current status
npm run lint

# Auto-fix fixable issues
npm run lint:fix

# Format all files
npm run format
```

### Daily Development Workflow

```bash
# Before starting work
npm run lint              # Check for issues

# While coding (editor does this automatically)
# ... make changes ...

# Before committing
npm run lint:fix          # Auto-fix what's possible
npm run type-check        # Verify TypeScript types
npm run format            # Format code

# Commit (pre-commit hook runs automatically)
git commit -m "Your message"
```

---

## Available Commands

### Linting Commands

| Command               | Description                          | When to Use                           |
| --------------------- | ------------------------------------ | ------------------------------------- |
| `npm run lint`        | Check for linting errors             | Before committing, during development |
| `npm run lint:fix`    | Auto-fix fixable linting errors      | After making changes, before commit   |
| `npm run lint:strict` | Check with zero warnings allowed     | Before opening PR, in CI              |
| `npm run lint:ci`     | CI-specific linting with JSON output | In CI/CD pipelines only               |

### Type Checking

| Command              | Description                             | When to Use             |
| -------------------- | --------------------------------------- | ----------------------- |
| `npm run type-check` | Check TypeScript types without building | Quick type verification |
| `npm run build`      | Full build with type checking           | Before release          |

### Formatting

| Command                | Description                    | When to Use          |
| ---------------------- | ------------------------------ | -------------------- |
| `npm run format`       | Format all files with Prettier | After bulk changes   |
| `npm run format:check` | Check if files are formatted   | In CI, before commit |

---

## Configuration Files

### `.eslintrc.cjs`

The main ESLint configuration with 400+ lines of carefully chosen rules.

**Key sections:**

- **CRITICAL: Prevent AI Agent Errors** - Rules specifically targeting common AI mistakes
- **TypeScript Strict Rules** - Type safety enforcement
- **Code Quality & Complexity** - Complexity limits and best practices
- **Import Organization** - Module structure and organization
- **React Specific Rules** - React/JSX patterns
- **Code Style & Best Practices** - General JavaScript best practices
- **Security** - Security vulnerability prevention

### `tsconfig.json`

TypeScript compiler configuration with strict mode enabled.

**Strict options enabled:**

- `strict: true` - All strict checks
- `noUnusedLocals` - Detect unused variables
- `noUnusedParameters` - Detect unused parameters
- `noImplicitReturns` - Require explicit returns
- `noUncheckedIndexedAccess` - Safe array/object access
- `noImplicitOverride` - Explicit override keyword
- `forceConsistentCasingInFileNames` - Case-sensitive imports

### `.prettierrc`

Prettier configuration for code formatting.

**Settings:**

- 2 space indentation
- Single quotes
- Semicolons required
- Trailing commas
- 100 character line width
- LF line endings (enforced)

---

## Rule Categories

### 1. Critical Rules (Zero Tolerance)

These rules are **errors** and will block commits:

#### No Unused Variables/Imports

```typescript
// ❌ ERROR
import { useState, useEffect, useMemo } from 'react'; // useMemo unused

// ✅ CORRECT
import { useState, useEffect } from 'react';
```

**Why:** Unused code clutters the codebase and suggests incomplete refactoring.

#### No 'any' Type

```typescript
// ❌ ERROR
function process(data: any) {}

// ✅ CORRECT
function process(data: UserData) {}
// OR
function process(data: unknown) {
  if (isUserData(data)) {
    // Type guard
  }
}
```

**Why:** `any` defeats TypeScript's type system and allows bugs to slip through.

#### No Floating Promises

```typescript
// ❌ ERROR
async function loadData() {
  fetchUsers(); // Promise ignored!
}

// ✅ CORRECT
async function loadData() {
  await fetchUsers();
}
```

**Why:** Unhandled promises can cause silent failures and race conditions.

#### No Unsafe TypeScript Operations

```typescript
// ❌ ERROR - Unsafe member access
const value = data.field; // data is 'any'

// ✅ CORRECT
const value = (data as { field: string }).field;
```

**Why:** Prevents runtime errors from type mismatches.

### 2. Code Quality Rules (Warnings)

These are **warnings** but should be addressed:

#### Function Complexity Limit

```typescript
// ⚠️ WARNING - Cyclomatic complexity > 15
function complexFunction() {
  if (a) {
    if (b) {
      if (c) {
        // ... many branches
      }
    }
  }
}

// ✅ CORRECT - Refactor into smaller functions
function simpleFunction() {
  handleA();
  handleB();
  handleC();
}
```

**Why:** Complex functions are harder to test, understand, and maintain.

#### Max Function Lines (150)

```typescript
// ⚠️ WARNING - Function > 150 lines
function massiveFunction() {
  // 200 lines of code
}

// ✅ CORRECT - Break into logical chunks
function well OrganizedFunction() {
  prepareData();
  processData();
  saveResults();
}
```

**Why:** Large functions are difficult to comprehend and often do too many things.

#### Explicit Return Types

```typescript
// ⚠️ WARNING - No return type
function calculate(a: number, b: number) {
  return a + b;
}

// ✅ CORRECT
function calculate(a: number, b: number): number {
  return a + b;
}
```

**Why:** Explicit return types catch errors and improve code documentation.

### 3. Style Rules

Automatically fixable with `npm run lint:fix`:

#### Import Order

```typescript
// ❌ WRONG - Disorganized imports
import { Button } from './Button';
import { useState } from 'react';
import type { User } from './types';

// ✅ CORRECT - Organized with blank lines
import { useState } from 'react';

import { Button } from './Button';

import type { User } from './types';
```

**Order:**

1. React (first)
2. External packages
3. Internal modules
4. Type imports (last)

#### Naming Conventions

- Variables/Functions: `camelCase`
- Constants: `UPPER_CASE`
- Types/Interfaces/Classes: `PascalCase`
- No `I` prefix for interfaces

### 4. React-Specific Rules

#### Component Definition

```typescript
// ❌ WRONG - Arrow function for named component
export const MyComponent = () => <div>Hello</div>;

// ✅ CORRECT - Function declaration
export function MyComponent(): JSX.Element {
  return <div>Hello</div>;
}
```

#### Hooks Dependencies

```typescript
// ❌ ERROR
useEffect(() => {
  fetchData(userId);
}, []); // Missing userId dependency!

// ✅ CORRECT
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

---

## Common Errors and Fixes

### Error: `'X' is defined but never used`

**Problem:** Unused import or variable.

```typescript
// ❌ ERROR
import { useState, useEffect, useMemo } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  // useEffect and useMemo never used
}
```

**Solution:**

```typescript
// ✅ FIX
import { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
}
```

**Auto-fix:** `npm run lint:fix` can remove unused imports.

---

### Error: `Promise-returning function provided without 'await'`

**Problem:** Async function called without awaiting the result.

```typescript
// ❌ ERROR
async function loadData() {
  fetchUsers(); // Floating promise
}
```

**Solution:**

```typescript
// ✅ FIX
async function loadData() {
  await fetchUsers();
}
```

---

### Error: `Unsafe assignment of 'any' value`

**Problem:** Assigning value with `any` type to typed variable.

```typescript
// ❌ ERROR
const response = await fetch(url);
const data = await response.json(); // Returns 'any'
const user: User = data; // Unsafe!
```

**Solution:**

```typescript
// ✅ FIX
const response = await fetch(url);
const data: unknown = await response.json();

if (isUser(data)) {
  const user: User = data; // Safe
}

// Type guard
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'name' in data && 'email' in data;
}
```

---

### Error: `React Hook useEffect has a missing dependency`

**Problem:** useEffect/useCallback/useMemo missing dependency.

```typescript
// ❌ ERROR
useEffect(() => {
  console.log(userId);
}, []); // userId is missing!
```

**Solution:**

```typescript
// ✅ FIX - Add dependency
useEffect(() => {
  console.log(userId);
}, [userId]);

// OR if you truly want to run once
useEffect(() => {
  console.log(userIdRef.current);
}, []); // Using ref instead
```

---

### Error: `Expected linebreaks to be 'LF' but found 'CRLF'`

**Problem:** Windows-style line endings (CRLF) instead of Unix (LF).

**Solution:**

```bash
# Auto-fix all files
npm run lint:fix

# Or configure git to auto-convert
git config --global core.autocrlf input
```

---

### Warning: `Function has a complexity of X. Maximum allowed is 15`

**Problem:** Function has too many branches/conditions.

**Solution:** Refactor into smaller functions:

```typescript
// ❌ WARNING - Complexity 18
function processOrder(order: Order) {
  if (order.isPaid) {
    if (order.isShipped) {
      if (order.isDelivered) {
        // ... many more branches
      }
    }
  }
}

// ✅ FIX - Extract functions
function processOrder(order: Order) {
  if (!order.isPaid) {
    return handleUnpaidOrder(order);
  }

  if (!order.isShipped) {
    return handleShipping(order);
  }

  return handleDelivery(order);
}
```

---

### Error: `Unexpected console statement`

**Problem:** `console.log` in production code.

```typescript
// ❌ ERROR
console.log('User data:', userData);

// ✅ FIX - Use proper logging or remove
console.error('Failed to load:', error); // OK - error logging
// OR remove entirely in production code
```

**Exceptions:** `console.warn` and `console.error` are allowed everywhere.

---

## Editor Integration

### Visual Studio Code

**Recommended Extensions:**

1. **ESLint** (`dbaeumer.vscode-eslint`) - Required
2. **Prettier** (`esbenp.prettier-vscode`) - Required
3. **Error Lens** (`usernamehw.errorlens`) - Recommended

**Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

**Benefits:**

- Automatic formatting on save
- Inline error display
- Quick fixes available
- Import organization

### Other Editors

**WebStorm/IntelliJ:**

- ESLint is built-in
- Enable "Run eslint --fix on save" in Preferences → Languages → JavaScript → Code Quality Tools → ESLint

**Vim/Neovim:**

- Use ALE or coc-eslint
- Configure to run on save

---

## CI/CD Integration

### GitHub Actions

Our CI pipeline (``.github/workflows/lint.yml`) runs:

```yaml
- name: Lint check
  run: npm run lint:strict

- name: Type check
  run: npm run type-check

- name: Format check
  run: npm run format:check
```

**All checks must pass** before PR can be merged.

### Pre-commit Hooks

Husky runs linting automatically before commits:

`.husky/pre-commit`:

```bash
#!/bin/sh
npm run lint-staged
```

**What gets checked:**

- Only staged files (fast)
- Auto-fix applied
- Commit blocked if errors remain

### Bypassing Checks (Emergency Only)

**NOT RECOMMENDED**, but in emergencies:

```bash
# Skip pre-commit hook
git commit --no-verify -m "Emergency fix"

# This will still fail in CI!
```

**Better approach:** Fix the linting errors.

---

## Requesting Rule Changes

### When to Request a Change

Valid reasons:

- Rule conflicts with project needs
- False positives in specific scenarios
- Rule is too strict for the codebase maturity
- Better alternative rule exists

### How to Request

1. **Document the issue:**
   - Which rule is problematic?
   - Why is it problematic?
   - What should change?

2. **Propose a solution:**
   - Disable entirely? (rarely)
   - Change to warning instead of error?
   - Adjust rule parameters?
   - Add file-specific override?

3. **Create an issue:**

   ````markdown
   ## Linting Rule Change Request

   **Rule:** `@typescript-eslint/explicit-function-return-type`
   **Current:** Error
   **Proposed:** Warning

   **Reasoning:**
   This rule causes excessive boilerplate in test files...

   **Proposed config:**

   ```json
   {
     "overrides": [
       {
         "files": ["**/*.test.ts"],
         "rules": {
           "@typescript-eslint/explicit-function-return-type": "warn"
         }
       }
     ]
   }
   ```
   ````

   ```

   ```

4. **Wait for team consensus** before changing rules

### Emergency Overrides

For **individual lines only**, with justification:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyData: any = thirdPartyLibrary.getData();
// JUSTIFICATION: Third-party library has no types, migration ticket #456
```

---

## Troubleshooting

### Linting is Slow

**Solution 1:** Use lint-staged (only lint changed files)

```bash
npm run lint-staged
```

**Solution 2:** Increase cache

```json
{
  "eslintConfig": {
    "cache": true,
    "cacheLocation": ".eslintcache"
  }
}
```

### False Positives

1. **Check if rule is correct** - Often it's catching a real issue
2. **Use file-specific override** - See `.eslintrc.cjs` overrides section
3. **Request rule change** - Follow process above

### Editor Not Showing Errors

1. **Restart ESLint server** (VS Code: Cmd/Ctrl + Shift + P → "ESLint: Restart ESLint Server")
2. **Check ESLint output** (VS Code: Output → ESLint)
3. **Verify installation:** `npm install`
4. **Check settings** - Ensure ESLint extension is enabled

---

## Best Practices

### 1. Run Linter Frequently

```bash
# Before starting work
npm run lint

# After making changes
npm run lint:fix

# Before committing
npm run lint && npm run type-check
```

### 2. Fix Errors Immediately

Don't accumulate linting errors. Fix them as you see them.

### 3. Understand the Rules

When you get an error, read the message and understand **why** it's wrong.

### 4. Use Auto-Fix

Many rules are auto-fixable:

```bash
npm run lint:fix
npm run format
```

### 5. Keep Dependencies Updated

```bash
# Update ESLint and plugins
npm update eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

---

## Summary

- **Linting is mandatory** - All code must pass linting checks
- **Auto-fix when possible** - Use `npm run lint:fix`
- **Understand errors** - Don't just disable rules
- **Editor integration** - Get immediate feedback
- **Pre-commit hooks** - Catch issues before they're committed
- **CI enforcement** - Final quality gate

**The goal is better code, not more rules. Each rule exists to prevent real problems.**

---

## Additional Resources

- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript ESLint](https://typescript-eslint.io/rules/)
- [React ESLint Plugin](https://github.com/jsx-eslint/eslint-plugin-react)
- [Import Plugin](https://github.com/import-js/eslint-plugin-import)

---

**Last Updated:** 2026-01-25
**Maintained by:** Graphium Development Team
**Questions?** Open an issue or ask in team chat
