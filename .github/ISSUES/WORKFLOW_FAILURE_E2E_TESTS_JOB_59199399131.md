### Description:
The job 'Electron Tests' is failing due to the following error:
```plaintext
⨯ GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"
```

This issue occurs when the Electron builder tries to perform upload-related operations that require a GitHub token.

### Solution Options:
1. Use the default `GITHUB_TOKEN` provided by GitHub Actions.
   - Add the following configuration to `.github/workflows/e2e.yml`
     ```yaml
     env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
     ```
   - Ensure that `permissions.contents` is set appropriately to allow write access:
     ```yaml
     permissions:
       contents: write
     ```

2. Skip tasks requiring `GH_TOKEN` for public CI workflows:
   - Add a check to ensure these tasks are conditionally executed only if `GH_TOKEN` is available:
     ```bash
     if [ -n "${GH_TOKEN}" ]; then
       echo "GH_TOKEN available, proceeding."
       # Commands here
     else
       echo "Skipping tasks requiring GH_TOKEN."
     fi
     ```

3. Consider creating an alternative approach for public visibility repositories without using any token or workflows requiring access to private API data.

---

### Metadata  
* **Job Details:** [Failing Job](https://github.com/kocheck/Graphium/actions/runs/20612430919/job/59199399131)  
* **Reported on:** 2025-12-31 12:01 UTC