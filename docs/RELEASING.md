# RELEASING.md — Time Manager Dashboard

**Last updated:** 2025-09-07  
**Audience:** Maintainers  
**Scope:** How to cut **beta** (Development) and **stable** (Production) desktop releases, verify artifacts, and handle rollbacks/hotfixes.


---

## 1) Release Channels & Artifacts

- **Channels**
  - **Development (beta):** tags like `vX.Y.Z-beta.N` → GitHub **Pre-release** → used by testers who enable prereleases in the app.
  - **Production (stable):** tags like `vX.Y.Z` → GitHub **Release** → used by all users (default update channel).

- **Artifacts**
  - **Windows:** Installer `.exe` (NSIS) and optional portable `.zip`
  - **macOS:** `.dmg` or `.zip`
  - **Checksums:** SHA-256 for each artifact
  - **Release notes:** See template below


---

## 2) Versioning & Tagging

- **SemVer:** `MAJOR.MINOR.PATCH`
- **Beta/pre-release:** `vX.Y.Z-beta.N` (N starts at 1)
- **Stable:** `vX.Y.Z`
- **Rules**
  - **beta → stable promotion:** Create a **new** stable tag (`vX.Y.Z`) on the validated commit. Do not retag or edit the beta tag.
  - Patch hotfixes increment PATCH: `vX.Y.(Z+1)`
  - Breaking changes require a migration and a clear **Data Notes** section in release notes.


---

## 3) Preconditions Checklist

- [ ] Tests pass locally (`lint`, `unit`, `e2e` if any)
- [ ] DB migrations: present, idempotent, and **pre-migration backup** implemented
- [ ] `CHANGELOG.md` updated (with **Data Notes** if schema changed)
- [ ] App version bumped (package version + app about screen)
- [ ] Icons/splash updated if needed
- [ ] No TODOs or console errors on startup
- [ ] Manual smoke test on the dev machine (start/stop Pomodoro, create task, daily report)


---

## 4) Cutting a **Beta** Release (Development Channel)

1. **Branch:** work is on `develop`. Merge PRs and ensure CI is green.  
2. **Bump version (beta):** e.g., `v1.4.0-beta.1`  
3. **Tag & push:** create git tag `v1.4.0-beta.1` and push the tag to origin.  
4. **Actions run:** the **release-dev** workflow builds installers and creates a **Pre-release** on GitHub with artifacts + checksums.  
5. **QA:** Install on Windows/macOS; verify:
   - Fresh install + DB init
   - Upgrade path from previous beta
   - Auto-update from previous beta to current
   - Critical flows: tasks, time entries, Pomodoro start/stop, daily report
6. **Gate:** If any blocker is found, fix and cut `-beta.2`, etc.


---

## 5) Promoting to **Stable** (Production Channel)

1. **Merge:** fast-forward or merge `develop` → `main` (release commit is identical).  
2. **Tag & push:** create **stable** tag `vX.Y.Z` at the validated commit and push the tag.  
3. **Actions run:** the **release-prod** workflow builds installers and creates a **Release** on GitHub.  
4. **Sanity check:** download artifacts from the Release page, install, and verify auto-update from previous **stable** to new **stable**.  
5. **Communicate:** publish release notes; notify testers if relevant.


---

## 6) Release Notes Template

```md
# vX.Y.Z (YYYY-MM-DD)

## Highlights
- Short, user-focused bullets

## Changes
- Feature: ...
- Fix: ...
- Chore: ...
- Perf: ...

## Data Notes (IMPORTANT if schema changed)
- Migration `NNN_add_table_...` runs on first launch
- Automatic backup created at `<userData>/backups/app-YYYYMMDD.sqlite`

## Platform Notes
- Windows: ...
- macOS: ...

## Checksums (SHA-256)
- app-vX.Y.Z-win.exe — `aaaaaaaa...`
- app-vX.Y.Z-mac.dmg — `bbbbbbbb...`

## Known Issues
- ...
```


---

## 7) QA Matrix (Minimum)

| Area | Scenario | Windows | macOS |
|---|---|:--:|:--:|
| Install | Fresh install on clean profile | ☐ | ☐ |
| Update | Auto-update from latest stable to new stable | ☐ | ☐ |
| Beta | Auto-update from last beta to current beta | ☐ | ☐ |
| DB | Migration runs, backup created, data intact | ☐ | ☐ |
| Core | Create project/task, track time, run Pomodoro | ☐ | ☐ |
| Reports | Daily report aggregates correctly | ☐ | ☐ |


---

## 8) Rollback & Yanking

- **If a beta is bad:** mark the Pre-release as **Deprecated** in notes; cut a new `-beta.N+1` fixing the issue.  
- **If a stable is bad:**  
  1) Publish a fast-follow patch `vX.Y.(Z+1)` addressing the issue.  
  2) Edit the bad release notes with a **YANKED** warning at the top.  
  3) Optionally unlist assets (users may still have downloaded them).  
- **DB issues:** instruct users to restore from the automatic backup at `<userData>/backups/...`, then update to the fixed version.


---

## 9) Hotfix Flow

1. Branch from `main`: `hotfix/vX.Y.(Z+1)`  
2. Fix, bump PATCH, update changelog  
3. Tag `vX.Y.(Z+1)` and push → **release-prod** runs  
4. Back-merge hotfix into `develop` to keep branches aligned


---

## 10) Local Rehearsal (Optional)

- Run release workflows locally using **Docker** + **act** without publishing:  
  - `act workflow_dispatch -j release --env ACT=true`  
  - Ensure the workflow guards publishing when `ACT=true` (or use pack builds with `--publish=never`).


---

## 11) Auto-Update Channels

- **Stable users:** default channel (no prerelease updates).  
- **Beta testers:** enable prereleases in the app settings; they will receive `-beta.*` builds.  
- **Promotion path:** when satisfied, tag the same commit as `vX.Y.Z` for stable.


---

## 12) Code Signing / Notarization (Optional)

- **Windows:** Code signing cert recommended (reduces SmartScreen warnings).  
- **macOS:** Notarization recommended (reduces Gatekeeper prompts).  
- For internal/testing only, unsigned builds are acceptable but expect OS prompts.


---

## 13) Responsibilities & Approvals

- **Release Owner:** prepares changelog, version bump, and tags.  
- **Reviewer:** verifies QA checklist across at least one OS different from the Owner.  
- **Approver (optional):** final sign-off using GitHub Environment protection on **Production**.


---

## 14) Troubleshooting

- **Action failed on signing/notarization:** publish unsigned artifacts for testing, or retry with proper secrets.  
- **Updater not seeing release:** confirm the tag type (beta vs stable), release visibility, and that assets are attached.  
- **Migration loop:** check migration idempotency and recorded version in `schema_migrations`.  
- **Crash on first launch:** check logs under `<userData>/logs/app.log`.


---

## 15) Reference

- Branch strategy: `develop` (beta) → `main` (stable)  
- Tags: `vX.Y.Z-beta.N` and `vX.Y.Z`  
- Artifacts: Windows `.exe` / macOS `.dmg` (plus checksums)  
- Backups: `<userData>/backups/app-YYYYMMDD.sqlite` created automatically before migrations
