# Local Testing Workflow (No CI) (superseded)

This document described disabling `.github/workflows/e2e.yml` to save CI minutes. It is
obsolete: CI runs on every pull request into `main` and is the enforcement for the UI
redesign program. Use the gate scripts in `package.json` (`verify:static`, `verify:web`,
`verify:electron`, `verify`) and see `tests/README.md` for running tests locally.
