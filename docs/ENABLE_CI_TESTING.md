# Enable CI Testing with Branch Protection

## Step-by-Step Setup

### 1. Navigate to Repository Settings
Go to: https://github.com/kocheck/Graphium/settings/branches

### 2. Add Branch Protection Rule

Click **"Add rule"**

#### Branch Name Pattern
```
main
```

#### Required Settings

✅ **Require status checks to pass before merging**
- Search for and select these checks:
  - `Web Tests (Shard 1/3)`
  - `Web Tests (Shard 2/3)`
  - `Web Tests (Shard 3/3)`
  - `Electron Tests`

✅ **Require branches to be up to date before merging**
- Ensures tests run against latest `main`

✅ **Do not allow bypassing the above settings**
- Prevents force-merges (even for admins)

#### Optional (Recommended)

✅ **Require linear history**
- Cleaner git history

✅ **Require conversation resolution before merging**
- All PR comments must be resolved

### 3. Save Changes

Click **"Create"** or **"Save changes"**

---

## Verification

1. Create a test PR with a failing test
2. Verify "Merge" button is disabled
3. Fix the test and push
4. Verify "Merge" button becomes enabled

---

## Cost Monitoring

Monitor your Actions usage at:
https://github.com/kocheck/Graphium/settings/billing

**Free tier limits:**
- Public repos: Unlimited ✅
- Private repos: 2,000 minutes/month

**Current workflow usage:**
- ~18 minutes per PR
- ~111 PRs within free tier

---

## Disabling Later

If you need to disable:
1. Go to Settings → Branches
2. Click "Edit" on the `main` rule
3. Uncheck "Require status checks to pass"
4. Save changes

Tests will still run, but won't block merges.
