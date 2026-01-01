# Hybrid Testing Workflow (Local + CI Safety Net)

## Overview

**Best of both worlds:**
- 🏃 Fast local testing during development
- 🛡️ CI safety net on `main` branch
- 💰 Minimal CI cost (~2-5 runs/month)

---

## Setup

### 1. Modify CI Workflow

Edit `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests (Playwright)

on:
  push:
    branches: [main]  # ← Only run on main branch
  # Remove pull_request trigger entirely

# ... rest of file stays the same
```

**Commit and push:**
```bash
git add .github/workflows/e2e.yml
git commit -m "Configure CI for main branch only"
git push
```

### 2. Install Pre-Push Hook (Local Testing)

**`.git/hooks/pre-push`**:
```bash
#!/bin/bash

echo "🧪 Running E2E tests before push..."

npm run test:e2e

if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Fix them before pushing."
  echo "To skip (emergency only): git push --no-verify"
  exit 1
fi

echo "✅ Tests passed!"
exit 0
```

**Make executable:**
```bash
chmod +x .git/hooks/pre-push
```

---

## How It Works

### During Development (Local)

1. **Make changes**
2. **Pre-push hook runs automatically**
   ```bash
   git push
   # → Triggers tests locally
   ```
3. **If tests pass:** Push succeeds
4. **If tests fail:** Fix and retry

### After Merge (CI)

1. **PR gets merged to `main`**
2. **CI runs automatically** (GitHub Actions)
3. **If tests fail on main:**
   - Team gets notification
   - Quick hotfix required
   - Roll back if necessary

---

## Benefits

### ✅ Pros

- **Fast feedback:** Local tests run in seconds
- **Low cost:** CI only runs ~2-5 times/month
- **Safety net:** Catches issues before production
- **Developer freedom:** Can skip tests for WIP branches

### ⚠️ Tradeoffs

- **Main can break:** Broken code can reach main (rare with good local testing)
- **Requires discipline:** Team must run tests locally
- **No PR enforcement:** Tests are advisory

---

## Team Workflow

### For Developers

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# ...

# 3. Test locally (automatic via hook)
git push origin feature/my-feature

# 4. Create PR (no CI runs)
# Manual review by team

# 5. Merge PR
# CI runs on main branch
```

### For Reviewers

**PR Review Checklist:**
- ✅ Ask: "Did you run tests locally?"
- ✅ Check: Code quality
- ✅ Approve and merge

**After merge:**
- ✅ Monitor CI run on main
- ✅ If CI fails: Quick fix or revert

---

## Cost Analysis

### GitHub Actions Usage

**Typical month:**
- 10 merges to main = 10 CI runs
- 10 runs × 18 min = **180 minutes**
- Free tier: 2,000 minutes
- **Usage: 9% of free tier** ✅

**Heavy month (50 merges):**
- 50 runs × 18 min = **900 minutes**
- **Usage: 45% of free tier** ✅

Still well within limits!

---

## Monitoring

### Check CI Status

View recent runs:
```
https://github.com/kocheck/Graphium/actions
```

### Check Minute Usage

Go to:
```
https://github.com/kocheck/Graphium/settings/billing
```

---

## Emergency: Skip Local Tests

**Only in emergencies** (hotfix, critical bug):

```bash
git push --no-verify
```

This bypasses the pre-push hook.

**Remember:** CI will still run on main!

---

## Upgrading to Full CI Later

If you want to add PR checks later:

**Re-enable PR trigger:**
```yaml
on:
  pull_request:
    branches: [main]  # ← Add this back
  push:
    branches: [main]
```

**Add branch protection:**
Follow `docs/ENABLE_CI_TESTING.md`

---

## Cost

- **Developer time:** 0 (pre-push hook is automatic)
- **CI minutes:** ~180-900/month (9-45% of free tier)
- **Total:** **$0/month** ✅
