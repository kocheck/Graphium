# Linting Migration Guide

## Overview

A comprehensive, strict linting configuration has been implemented for Graphium. This document outlines what was configured, current status, and the migration plan to achieve zero linting errors.

**Created:** 2026-01-25
**Status:** Initial Setup Complete - Migration In Progress

---

## What Was Implemented

### 1. Configuration Files

#### ✅ `.eslintrc.cjs` - Ultra-Strict ESLint Configuration

- **400+ lines** of carefully chosen rules
- **AI Agent Error Prevention** - Specific rules targeting common AI mistakes
- **TypeScript Strict Rules** - Comprehensive type safety
- **Code Quality Limits** - Complexity, line count, nesting depth
- **Import Organization** - Enforced module structure
- **React Best Practices** - Hooks, component patterns
- **Security Rules** - XSS, dangerous patterns prevention

Key rule categories:

- No unused variables/imports (error)
- No `any` type (error)
- Explicit return types (warning)
- No floating promises (error)
- Complexity max 15 (warning)
- Function max 150 lines (warning)
- Consistent type imports (error)
- Import order enforcement (error)

#### ✅ `tsconfig.json` - Enhanced Strict Mode

Added strict compiler options:

```json
{
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "allowUnusedLabels": false,
  "allowUnreachableCode": false,
  "forceConsistentCasingInFileNames": true
}
```

#### ✅ `.prettierrc` - Code Formatting

- LF line endings enforced
- 2 space indentation
- Single quotes
- Trailing commas
- 100 character width

#### ✅ `package.json` - New Scripts

```bash
npm run lint           # Check for errors
npm run lint:fix       # Auto-fix issues
npm run lint:strict    # Zero warnings mode
npm run lint:ci        # CI mode with JSON report
npm run type-check     # TypeScript checking only
npm run format         # Format all files
npm run format:check   # Check formatting
npm run lint-staged    # Pre-commit linting
```

#### ✅ `.husky/pre-commit` - Pre-commit Hooks

- Automatically runs `lint-staged` on commit
- Only lints staged files (fast)
- Auto-fixes what's possible
- Blocks commit if errors remain

#### ✅ `lint-staged` Configuration

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{js,jsx,json,md,css}": ["prettier --write"]
}
```

### 2. Documentation Files

#### ✅ `.ai-rules.md` - AI Agent Guidelines (300+ lines)

Comprehensive rules for AI-assisted development:

- Critical pre-flight checklist
- Absolute prohibitions (zero tolerance)
- Mandatory requirements with examples
- Code generation standards
- Pattern matching rules
- Common error fixes
- Emergency override procedures

#### ✅ `LINTING.md` - Complete Linting Guide (800+ lines)

Developer-facing documentation:

- Quick start guide
- All available commands
- Configuration explanations
- Rule categories with examples
- Common errors and fixes
- Editor integration setup
- CI/CD integration
- Troubleshooting guide

#### ✅ `README.md` - Updated with Linting Section

Added prominent section explaining:

- Why strict linting matters
- Quick commands
- Links to full documentation

### 3. CI/CD Integration

#### ✅ `.github/workflows/lint.yml` - GitHub Actions

New workflow that runs on every PR/push:

- ESLint strict checking
- TypeScript type checking
- Code formatting verification
- Complexity analysis
- Quality gate summary
- ESLint report artifacts

### 4. Editor Configuration

#### ✅ `.vscode/settings.json`

Preconfigured for optimal developer experience:

- Format on save
- Auto-fix ESLint on save
- Organize imports on save
- TypeScript workspace integration
- LF line endings
- Trim trailing whitespace

#### ✅ `.vscode/extensions.json`

Recommended extensions:

- ESLint
- Prettier
- Error Lens
- TypeScript Nightly
- Code Spell Checker

### 5. Dependencies Installed

New development dependencies:

- `eslint-plugin-react` - React-specific rules
- `eslint-plugin-import` - Import/export rules
- `eslint-import-resolver-typescript` - TypeScript import resolution
- `lint-staged` - Pre-commit linting

---

## Current Status

### Linting Errors Summary

After running `npm run lint:fix`, the following issues remain:

#### 🔴 Critical Issues (Errors)

1. **Files Not in TSConfig**
   - `diagnose-dungeon.ts`
   - `docs/aoe-templates-concept.tsx`
   - `docs/movement-range-concept.tsx`

   **Fix:** Add to `tsconfig.json` `include` array or add `docs/tsconfig.json`

2. **Unsafe `any` Operations** (~60 instances in `electron/main.ts`)
   - Unsafe assignments
   - Unsafe member access
   - Unsafe calls
   - Unsafe returns

   **Fix:** Add proper types for JSON parsing and external data

3. **Floating Promises** (~5 instances)
   - Promises not awaited in async contexts

   **Fix:** Add `await` or `void` prefix

4. **Naming Conventions**
   - `__dirname` variable name issue

   **Fix:** Use destructuring or rename

5. **Consistent Type Imports**
   - `electron-env.d.ts` has forbidden `import()` annotation

   **Fix:** Use `import type` instead

#### ⚠️ Warnings (Should Fix)

1. **Missing Return Types** (~10 instances)
   - Functions without explicit return types

   **Fix:** Add `: ReturnType` to functions

2. **Function Too Long** (1 instance)
   - Arrow function with 430 lines (max 150)

   **Fix:** Refactor into smaller functions

3. **High Complexity** (1 instance)
   - Function complexity 18 (max 15)

   **Fix:** Simplify logic or extract functions

4. **Prefer Nullish Coalescing** (~10 instances)
   - Using `||` instead of `??`

   **Fix:** Replace `||` with `??` where appropriate

5. **Prefer Optional Chain** (a few instances)
   - Not using optional chaining

   **Fix:** Use `?.` operator

---

## Migration Strategy

### Phase 1: Fix Configuration Issues (Immediate)

**Priority: HIGH - Blocks linting entirely**

1. **Add files to TypeScript config**

   ```json
   // tsconfig.json
   {
     "include": ["src", "electron", "docs", "diagnose-dungeon.ts"]
   }
   ```

   Or create `docs/tsconfig.json` for docs files.

2. **Fix type imports in `electron-env.d.ts`**

   ```typescript
   // Change from:
   import('electron-updater');

   // To:
   import type {} from /* types */ 'electron-updater';
   ```

### Phase 2: Fix Critical Errors (Week 1)

**Priority: HIGH - Security & Correctness**

1. **Fix floating promises in `electron/main.ts`**
   - Lines: 324, 326, 372, 374, 454
   - Add `await` or `void` prefix

2. **Type the JSON parsing**
   - Create interfaces for parsed data
   - Add type guards for runtime validation

   ```typescript
   interface SaveFileData {
     maps: Map[];
     tokens: Token[];
     tokenLibrary: TokenLibraryItem[];
   }

   function isSaveFileData(data: unknown): data is SaveFileData {
     // Type guard implementation
   }
   ```

3. **Fix naming convention error**
   - Rename `__dirname` or add exception

### Phase 3: Refactor Large Functions (Week 2)

**Priority: MEDIUM - Maintainability**

1. **Split 430-line arrow function**
   - Extract logical sections
   - Create helper functions
   - Aim for <150 lines per function

2. **Reduce complexity in high-complexity functions**
   - Extract conditional logic
   - Use early returns
   - Create helper functions

### Phase 4: Add Missing Types (Ongoing)

**Priority: MEDIUM - Type Safety**

1. **Add return types to all functions**
   - Start with public APIs
   - Work through warning list
   - Aim for 100% explicit returns

2. **Replace `any` with proper types**
   - Start with most critical paths
   - Add proper interfaces
   - Use `unknown` as intermediate step if needed

### Phase 5: Code Quality Improvements (Ongoing)

**Priority: LOW - Nice to Have**

1. **Update to nullish coalescing**
   - Safe auto-fix available
   - Run `npm run lint:fix`

2. **Use optional chaining**
   - Safe auto-fix available
   - Run `npm run lint:fix`

---

## Gradual Adoption Strategy

### Option A: Strict Enforcement (Recommended for New Code)

**For new files only:**

- All rules enforced from day one
- Pre-commit hooks active
- CI blocks non-compliant code

**For existing files:**

- Warnings allowed temporarily
- Fix gradually over time
- Track progress

### Option B: Temporary Rule Relaxation

If the errors are too overwhelming, you can temporarily relax some rules:

```javascript
// .eslintrc.cjs
{
  rules: {
    // Temporarily downgrade to warnings
    '@typescript-eslint/no-unsafe-assignment': 'warn',  // Instead of 'error'
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',  // Turn off temporarily

    // Keep these as errors (most critical)
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
  }
}
```

**Migration plan:**

1. Start with rules as warnings
2. Fix all instances over 2-4 weeks
3. Change warnings to errors
4. Enforce strictly going forward

---

## Quick Wins (Auto-Fixable)

These can be fixed immediately with `npm run lint:fix`:

✅ Import organization
✅ Line ending consistency (CRLF → LF)
✅ Trailing commas
✅ Semicolons
✅ Quote style
✅ Some nullish coalescing cases
✅ Some optional chaining cases

**Run now:**

```bash
npm run lint:fix
npm run format
```

---

## Recommended Next Steps

### Immediate (Today)

1. ✅ Review this migration guide
2. ⬜ Fix configuration errors (Phase 1)
3. ⬜ Run `npm run lint:fix` again
4. ⬜ Decide on migration strategy (Option A or B)

### This Week

1. ⬜ Fix all floating promises (Phase 2.1)
2. ⬜ Add types for JSON parsing (Phase 2.2)
3. ⬜ Fix naming conventions (Phase 2.3)
4. ⬜ Team review of linting rules

### This Month

1. ⬜ Refactor large functions (Phase 3)
2. ⬜ Add return types to public APIs (Phase 4.1)
3. ⬜ Begin `any` → proper types migration (Phase 4.2)
4. ⬜ Monitor lint metrics in CI

### Ongoing

- ⬜ All new code follows strict rules
- ⬜ Gradual migration of existing code
- ⬜ Monthly review of rule effectiveness
- ⬜ Team training on linting best practices

---

## Success Metrics

Track progress with these metrics:

```bash
# Count current errors and warnings
npm run lint 2>&1 | grep -E "✖|warning" | tail -1

# Goal metrics:
# Week 1:  < 100 errors
# Week 2:  < 50 errors
# Week 4:  < 10 errors
# Month 2: 0 errors, < 50 warnings
# Month 3: 0 errors, 0 warnings
```

---

## Benefits Already Realized

Even without fixing all errors, you now have:

1. ✅ **Infrastructure in place** - Linting runs on every commit
2. ✅ **Documentation** - Comprehensive guides for developers and AI
3. ✅ **CI Integration** - Quality gates on every PR
4. ✅ **Editor Support** - Auto-fix and inline errors
5. ✅ **Team Alignment** - Clear standards and expectations
6. ✅ **Future-Proofing** - New code starts clean

---

## Getting Help

- **Common errors:** See [LINTING.md](LINTING.md) "Common Errors and Fixes"
- **AI development:** See [.ai-rules.md](.ai-rules.md)
- **Rule explanations:** Comments in `.eslintrc.cjs`
- **TypeScript errors:** [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **ESLint rules:** [ESLint Docs](https://eslint.org/docs/rules/)

---

## Summary

**What's Done:**

- ✅ Ultra-strict linting configuration
- ✅ Comprehensive documentation
- ✅ CI/CD integration
- ✅ Pre-commit hooks
- ✅ Editor configuration
- ✅ AI agent guidelines

**What's Next:**

- ⬜ Fix configuration errors
- ⬜ Decide migration strategy
- ⬜ Gradually fix existing errors
- ⬜ Maintain zero errors for new code

**Estimated Timeline:**

- **Week 1:** Fix critical errors (configuration, floating promises)
- **Month 1:** Refactor large functions, add types
- **Month 2-3:** Achieve zero errors/warnings

The linting infrastructure is production-ready. The migration to full compliance is a process that should be tackled incrementally alongside normal development work.

---

**Questions or Issues?**
Open a GitHub issue with the `linting` label.
