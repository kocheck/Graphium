# Local Testing Workflow (No CI)

## Setup (One-Time)

### 1. Disable CI Workflow

**Option A: Delete the workflow file**

```bash
rm .github/workflows/e2e.yml
git commit -m "Disable CI testing (local-only)"
git push
```

**Option B: Rename to disable**

```bash
mv .github/workflows/e2e.yml .github/workflows/e2e.yml.disabled
git commit -m "Disable CI testing (local-only)"
git push
```

### 2. Install Playwright Browsers

```bash
npx playwright install --with-deps chromium
```

---

## Daily Workflow

### Before Every Commit

```bash
# Run all tests
npm run test:e2e

# Or run specific tests
npm run test:e2e:web          # Web tests only
npm run test:e2e:functional   # Functional tests only
```

### Before Every Push

```bash
# Run full suite
npm run test:e2e

# If all pass, push
git push
```

### Pre-Commit Hook (Optional Automation)

Add a git hook to run tests automatically:

**`.git/hooks/pre-push`** (create this file):

```bash
#!/bin/bash

echo "🧪 Running E2E tests before push..."

npm run test:e2e

if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Push aborted."
  echo "Fix failing tests or use: git push --no-verify"
  exit 1
fi

echo "✅ Tests passed. Proceeding with push."
exit 0
```

**Make it executable:**

```bash
chmod +x .git/hooks/pre-push
```

Now tests run automatically before every push!

---

## Best Practices

### ✅ DO

- Run tests before every commit
- Run full suite before pushing
- Fix failing tests immediately
- Update tests when changing functionality

### ❌ DON'T

- Skip tests with `--no-verify` (except emergencies)
- Push broken code
- Assume "it works on my machine"
- Ignore flaky tests

---

## Team Agreement Template

**Copy this to your team README:**

```markdown
## Testing Policy

### Before Merging PRs

1. ✅ Run `npm run test:e2e` locally
2. ✅ All tests must pass
3. ✅ Screenshot test results in PR description
4. ✅ Reviewer verifies tests were run

### If Tests Fail

1. Fix the issue
2. Re-run tests
3. Do not merge until green
```

---

## Troubleshooting

### Tests pass locally but fail for reviewer

**Cause:** Environment differences

**Solution:**

```bash
# Clear all state
npm run test:e2e -- --update-snapshots
git add tests/
git commit -m "Update test snapshots"
```

### Tests are slow

**Options:**

```bash
# Run in parallel (faster)
npm run test:e2e -- --workers=4

# Run only changed tests
npm run test:e2e -- --only-changed

# Run headed mode (see what's happening)
npm run test:e2e -- --headed
```

### Forgot to run tests

**Prevention:** Use the pre-push hook above!

---

## Cost

**$0/month** ✅

All testing happens on developer machines.
