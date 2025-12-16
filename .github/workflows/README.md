# GitHub Workflows

This directory contains automated workflows for Hyle repository maintenance.

## Documentation Check Workflow

**File:** `documentation-check.yml`

**Purpose:** Automatically reviews pull requests to main branch and determines if documentation needs to be updated based on code changes.

### Features

- ✅ Analyzes PR diffs using GitHub Copilot (GPT-4o)
- ✅ Identifies which documentation files need updates
- ✅ Posts detailed analysis as PR comment
- ✅ Adds `documentation-needed` label for high/medium impact changes
- ✅ Provides direct links to relevant documentation files
- ✅ No external API keys required - uses built-in GitHub token

### Setup

1. **Enable workflow permissions:**
   - Go to Settings → Actions → General
   - Under "Workflow permissions", select:
     - ✅ Read and write permissions
   - Click "Save"

2. **Create label (optional):**
   - Go to Issues → Labels
   - Click "New label"
   - Name: `documentation-needed`
   - Description: "PR requires documentation updates"
   - Color: Choose a color (e.g., #FFA500 for orange)
   - Click "Create label"

3. **Enable GitHub Models (if required):**
   - GitHub Models is generally available for public repositories
   - For private repositories, you may need a GitHub Copilot subscription
   - The workflow uses the built-in `GITHUB_TOKEN` automatically

### Usage

The workflow runs automatically when:
- A pull request is opened to `main` branch
- A pull request to `main` is updated (new commits)
- A pull request to `main` is reopened

**No manual action required** - it runs automatically!

### What It Checks

The workflow analyzes code changes against:

**Root Documentation (8 files):**
- `.cursorrules` - AI assistant reference
- `ARCHITECTURE.md` - System architecture
- `CONVENTIONS.md` - Code standards
- `CONTEXT.md` - Domain knowledge
- `IPC_API.md` - IPC channel reference
- `DECISIONS.md` - Architectural decisions
- `TROUBLESHOOTING.md` - Common issues
- `TUTORIALS.md` - Workflow guides
- `DOCUMENTATION.md` - Documentation index

**Directory READMEs (6 files):**
- `electron/README.md`
- `src/README.md`
- `src/components/README.md`
- `src/components/Canvas/README.md`
- `src/store/README.md`
- `src/utils/README.md`

**Inline Documentation:**
- JSDoc in modified files

### Example Output

The workflow posts a comment on each PR like this:

```markdown
## 📚 Documentation Check

GitHub Copilot has analyzed this PR for documentation impact.

**Documentation Impact:** High

**Files Needing Updates:**
- `IPC_API.md` - Add documentation for new `CLEAR_DRAWINGS` IPC channel
- `src/App.tsx` - Add JSDoc to new `clearDrawings` handler function
- `.cursorrules` - Update with new clear drawings pattern

**Required Changes:**
1. **IPC_API.md**: Add new section documenting CLEAR_DRAWINGS channel with usage, parameters, examples
2. **App.tsx JSDoc**: Document new button handler with rationale and cross-reference to IPC handler
3. **.cursorrules**: Add clear drawings to common tasks section

**New Documentation:**
None required

---
[View Documentation Index](DOCUMENTATION.md)
```

### Customization

**Adjust which branches trigger the workflow:**

Edit `documentation-check.yml`:

```yaml
on:
  pull_request:
    branches:
      - main
      - develop  # Add more branches
```

**Change impact threshold for labeling:**

Edit the grep pattern in the workflow:

```bash
# Only label "High" impact (not Medium)
if echo "$analysis" | grep -q "Documentation Impact: High"; then
```

**Adjust diff size limit:**

Change line limit in the workflow:

```bash
head -n 1000 pr_diff.txt  # Increase from 500 to 1000 lines
```

**Change AI model:**

Edit the model in the workflow:

```json
"model": "gpt-4o-mini"  # Use faster/cheaper model
```

Available models:
- `gpt-4o` - Most capable (default)
- `gpt-4o-mini` - Faster and more cost-effective
- `gpt-4-turbo` - Alternative high-quality model

### Troubleshooting

**Issue: Workflow not running**

- ✅ Check that workflow permissions are set to "Read and write"
- ✅ Verify the PR is targeting the `main` branch
- ✅ Check Actions tab for any error messages

**Issue: "Unauthorized" or API errors**

- ✅ Verify workflow permissions include "Read and write"
- ✅ Check if your repository has access to GitHub Models
- ✅ For private repos, verify GitHub Copilot subscription is active
- ✅ Try re-running the workflow

**Issue: Comment not posted**

- ✅ Check workflow permissions include "Write" for pull requests
- ✅ Verify GitHub token has correct scopes
- ✅ Check Actions logs for specific error messages

**Issue: Rate limiting**

- ✅ GitHub Models has rate limits per repository
- ✅ Consider adding caching or throttling for high-PR-volume repos
- ✅ Check GitHub Actions logs for specific rate limit messages

### Cost Estimates

**GitHub Models pricing:**

- **Public repositories**: Free with GitHub account
- **Private repositories**: Included with GitHub Copilot subscription
  - Individual: $10/month
  - Business: $19/user/month
  - Enterprise: Custom pricing

**Typical usage:**
- Per PR analysis: Minimal token usage (~3-5K tokens)
- 100 PRs/month: Well within free tier or included limits

**Cost comparison:**
- GitHub Copilot approach: **$0/month** (if you already have Copilot)
- Claude API approach: **~$1/month** for 100 PRs

### Alternative Workflows

**Simple Rule-Based Workflow:**

The repository also includes `documentation-check-simple.yml` which uses pattern matching instead of AI:

- ✅ No AI or API required
- ✅ Zero setup needed
- ✅ Fast execution
- ❌ Less intelligent analysis
- ❌ Fixed rules only

To use the simple workflow instead:
1. Disable `documentation-check.yml`
2. Enable `documentation-check-simple.yml`

### Maintenance

**Update documentation list:**

When adding new documentation files, update the workflow prompt in `documentation-check.yml`:

```bash
**New Documentation:**
- NEW_FILE.md (description)
```

**Update to newer models:**

GitHub Models may release new models. Check available models and update:

```json
"model": "gpt-4o"  # Update to newer version when available
```

### Security Notes

- ✅ Uses built-in `GITHUB_TOKEN` (no external secrets needed)
- ✅ Workflow only has read access to code, write access to PR comments
- ✅ PR diffs are sent to GitHub's Models API (Microsoft Azure backend)
- ✅ Data is processed according to GitHub's data processing terms
- ✅ No credentials or secrets are included in diffs
- ℹ️ For highly sensitive repositories, consider using the simple rule-based workflow instead

### GitHub Models Information

**What is GitHub Models?**

GitHub Models provides access to AI models through Azure OpenAI Service:
- GPT-4o and other OpenAI models
- Claude models (via Azure)
- Other AI models as they become available

**Data Processing:**
- Requests are processed through Azure OpenAI
- Subject to GitHub's data processing agreement
- Not used to train AI models (per GitHub's policy)

**Access:**
- Public repositories: Generally available
- Private repositories: Requires GitHub Copilot subscription
- Rate limits apply per repository

### See Also

- [DOCUMENTATION.md](../../DOCUMENTATION.md) - Documentation inventory
- [CONVENTIONS.md](../../CONVENTIONS.md) - Documentation standards
- [GitHub Actions docs](https://docs.github.com/en/actions)
- [GitHub Models docs](https://docs.github.com/en/github-models)
- [GitHub Copilot docs](https://docs.github.com/en/copilot)

---

## Simple Documentation Check Workflow

**File:** `documentation-check-simple.yml`

A rule-based alternative that doesn't use AI:

**Features:**
- ✅ Pattern matching for file changes
- ✅ No AI or API required
- ✅ Zero setup or configuration
- ✅ Fast execution
- ✅ Predictable suggestions

**How it works:**
- Detects which directories/files were modified
- Suggests relevant documentation based on patterns
- Posts recommendations as PR comment

**When to use:**
- You don't have GitHub Copilot subscription
- You prefer deterministic rule-based checks
- Your repository has simple documentation update patterns
- You want zero external dependencies

---

## Build and Release Workflow

**File:** `build-release.yml`

**Purpose:** Automatically builds Hyle for macOS, Windows, and Linux when you create a version tag, then creates a GitHub release with all the installers.

### Features

- ✅ Multi-platform builds (macOS, Windows, Linux)
- ✅ Automatic artifact uploads to GitHub releases
- ✅ Triggered by version tags (e.g., v0.0.1, v1.2.3)
- ✅ Build caching for faster runs
- ✅ No secrets required - uses built-in GITHUB_TOKEN

### How It Works

1. You push a version tag (e.g., `v0.0.1`)
2. GitHub Actions automatically:
   - Builds macOS DMG (on macOS runner)
   - Builds Windows NSIS installer (on Windows runner)
   - Builds Linux AppImage (on Ubuntu runner)
3. Creates a GitHub release with all installers attached

### Usage

**Step 1: Update version in package.json**

```json
{
  "version": "0.0.1"
}
```

**Step 2: Commit and push your changes**

```bash
git add .
git commit -m "Prepare v0.0.1 release"
git push
```

**Step 3: Create and push a version tag**

```bash
git tag -a v0.0.1 -m "v0.0.1 - Hyle: Protos"
git push origin v0.0.1
```

**Step 4: Wait for the build**

- Go to Actions tab on GitHub
- Watch the "Build and Release" workflow run
- All three platforms will build in parallel (takes ~10-15 minutes)

**Step 5: Add release notes**

Once the release is created, you can edit it to add your release notes:

```bash
gh release edit v0.0.1 --notes-file release-notes.md
```

Or edit directly on GitHub.

### Build Outputs

The workflow creates these installers:

- **macOS**: `Hyle-Mac-0.0.1-Installer.dmg` (~94 MB)
- **Windows**: `Hyle-Windows-0.0.1-Setup.exe` (~85 MB)
- **Linux**: `Hyle-Linux-0.0.1.AppImage` (~95 MB)

Each includes a `.blockmap` file for delta updates.

### Advanced Options

**Create a pre-release:**

Add `prerelease: true` to the release job:

```yaml
- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    prerelease: true  # Add this line
```

**Add release notes automatically:**

```yaml
- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    generate_release_notes: true  # Change to true
```

**Draft release instead of publishing:**

```yaml
- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    draft: true  # Change to true
```

### Troubleshooting

**Issue: Build fails on macOS**

- Check that `electron-builder.json5` has proper mac configuration
- Verify all dependencies are in package.json
- Code signing is optional - builds will work without it

**Issue: Build fails on Windows**

- Check for Windows-specific path issues
- Verify NSIS configuration in electron-builder.json5
- Check build logs for specific errors

**Issue: Build fails on Linux**

- Verify AppImage target in electron-builder.json5
- Check for missing system dependencies
- Review build logs for linker errors

**Issue: Release not created**

- Verify GITHUB_TOKEN has write permissions
- Check that tag format matches `v*.*.*` pattern
- Ensure you pushed the tag (not just created it locally)

**Issue: Artifacts not uploaded**

- Check file paths in upload-artifact steps
- Verify files were actually created in release/*/
- Review artifact upload logs

### Cost

**GitHub Actions minutes:**

- Free tier: 2,000 minutes/month for private repos
- Unlimited for public repos
- This workflow uses ~30 minutes per release (all platforms)

**Typical usage:**

- 10 releases/month = 300 minutes (~15% of free tier)

### Security Notes

- ✅ Uses built-in GITHUB_TOKEN (no secrets needed)
- ✅ Builds run in isolated GitHub-hosted runners
- ✅ Artifacts are stored securely in GitHub
- ⚠️ Installers are NOT code-signed (users will see security warnings)

To add code signing, you'll need to:
1. Get a developer certificate (Apple Developer, Windows Code Signing)
2. Add certificates as repository secrets
3. Update workflow to use signing keys

### See Also

- [Electron Builder docs](https://www.electron.build/)
- [GitHub Actions docs](https://docs.github.com/en/actions)
- [Creating releases docs](https://docs.github.com/en/repositories/releasing-projects-on-github)

---

**Last updated:** 2025-12-15
