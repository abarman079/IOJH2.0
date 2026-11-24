# C07c Windows integration

Do not execute hosted changes during installation. Source baseline: main `e9077ea23a883d4f577f630392f795d4ea86af58`. Branch `c07c-authenticated-worker-scheduler`. No deletions or package changes. Preserve untracked recovery README, `.env.local`, .git, backups. ZIP hashes in manifest represent exact archive bytes, not Git-normalized bytes.

## A — verify and extract
Use PowerShell in VS Code. Compare SHA-256 to the value in delivery message. Stop on any mismatch. No existing tracked changes allowed; only unrelated untracked recovery README may remain. The following block verifies ZIP paths/entries and file bytes before extraction; replace the SHA placeholder with the final delivery checksum.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
$baseline = 'e9077ea23a883d4f577f630392f795d4ea86af58'
$branch = 'c07c-authenticated-worker-scheduler'
if ((git branch --show-current) -ne 'main' -or (git rev-parse HEAD) -ne $baseline) { throw 'Wrong baseline' }
if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist: stop and review' }
$zipPath = Join-Path $env:USERPROFILE 'Downloads\IOJH2_C07c_Worker_Scheduler_Integration.zip'
$expectedHash = 'REPLACE_WITH_DELIVERY_SHA256'
if (!(Test-Path -LiteralPath $zipPath) -or (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'ZIP checksum mismatch' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entry = $archive.GetEntry('docs/manifest/C07c.json')
  if (!$entry) { throw 'Missing manifest' }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { $manifest = ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
  $expected = @($manifest.files | ForEach-Object { $_.path }) + 'docs/manifest/C07c.json'
  if ($archive.Entries.Count -ne $expected.Count) { throw 'Unexpected archive count' }
  $seen = @{}
  foreach ($item in $archive.Entries) {
    $name = $item.FullName
    if ($name -match '(^/|\\|:|(^|/)\.\.(/|$)|(^|/)\.git(/|$)|\.env\.local|node_modules|\.next|README-C05a-MFA-Recovery)' -or $expected -notcontains $name -or $seen.ContainsKey($name)) { throw "Unsafe entry: $name" }
    $seen[$name] = $true
    if ($name -ne 'docs/manifest/C07c.json') {
      $record = $manifest.files | Where-Object path -eq $name
      $stream = $item.Open(); $sha = [Security.Cryptography.SHA256]::Create()
      try { $hex = -join ($sha.ComputeHash($stream) | ForEach-Object {$_.ToString('x2')}) } finally {$sha.Dispose();$stream.Dispose()}
      if ($hex -ne $record.sha256 -or $item.Length -ne $record.bytes) { throw "Entry mismatch: $name" }
    }
    if (($manifest.added -contains $name) -and (Test-Path -LiteralPath $name)) { throw "New path already exists: $name" }
  }
} finally { $archive.Dispose() }
git show-ref --verify --quiet "refs/heads/$branch"
if ($LASTEXITCODE -eq 0) { throw 'Branch already exists; review before proceeding' }
git switch -c $branch
if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed' }
Expand-Archive -LiteralPath $zipPath -DestinationPath (Get-Location).Path -Force
git status --short
Write-Host 'PASS: ZIP verified and extracted; inspect intended files.'
```

## B — local quality verification
Stop development server before build. Keep runner/send/webhook disabled for ordinary browser regression.

```powershell
$ErrorActionPreference = 'Stop'
$checks = @('install --frozen-lockfile','lint','typecheck','test:unit','build')
foreach ($check in $checks) {
  $arguments = $check.Split(' ')
  & corepack pnpm @arguments
  if ($LASTEXITCODE -ne 0) { throw "FAIL: $check" }
  Write-Host "PASS: $check"
}
```

Start production server in separate terminal `corepack pnpm start --hostname 127.0.0.1`. Current Playwright configuration reuses that server locally. Test `corepack pnpm exec playwright test tests/e2e/c07c-runner.spec.ts --workers=1 --timeout=60000` then `corepack pnpm exec playwright test --workers=1 --timeout=60000`. Check exit codes and expected skips. Optional authenticated local probe requires isolated local Supabase, `IOJH_TEST_RUNNER_LOCAL=true` and privately set `IOJH_TEST_RUNNER_SECRET` matching server env; email flags false. Ensure the server points to disposable DB, not hosted. Remove test env vars afterward. Existing Windows Docker limitation: use Linux CI for DB tests.

## C — commit review and CI
After local quality passes, stage exact manifest paths only (not untracked README), inspect `git diff --cached` and `git diff --cached --check`. If edits made, update manifest to canonical staged Git bytes rather than comparing LF/CRLF working files with ZIP bytes; use Node `execFileSync('git',['show',':'+path])` to hash Buffer bytes. Preserve initial ZIP manifest separately; label regenerated hashes `canonical Git index bytes`. Never claim archive SHA after modifying contents. Stage manifest again. Commands:

```powershell
$m = Get-Content 'docs/manifest/C07c.json' -Raw | ConvertFrom-Json
$paths = @($m.files | ForEach-Object {$_.path}) + 'docs/manifest/C07c.json'
git add -- @paths
if ($LASTEXITCODE -ne 0) { throw 'Stage failed' }
$staged = @(git diff --cached --name-only)
if (Compare-Object ($paths | Sort-Object) ($staged | Sort-Object)) { throw 'Staged file set differs' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Whitespace check failed' }
git diff --cached --stat
# after reviewing actual staged diff:
git commit -m 'feat(jobs): add C07c authenticated bounded worker and staging controls'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git push -u origin c07c-authenticated-worker-scheduler
if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
```

Open draft PR to main, verify exact final SHA and C05c/C06/C07a/C07b/C07c Linux database workflow plus full local application regression. Do not merge before owner approval. CI uses disposable local database only; no hosted credentials.

## D — hosted DB only after CI and explicit owner approval
Verify Dashboard project **IOJH 2.0 Web**, ref `zxltczixfwczkmxcozyu`, not book registration. Verify CLI link locally and `npx --yes supabase@2.122.1 migration list --linked`: six prior versions matched. Stop/disable any claims. Run `supabase/verify/c07c_readonly_preflight.sql` in correct SQL editor, expect C07a/b objects present, C07c absent, no leased jobs. Check extensions for future staging only. Fresh post-C07b DB backup required, not the previous backup. Use private local directory `%LOCALAPPDATA%\IOJH-Private-Backups`, pg_dump custom archive from correct connection parameters, password prompted privately (never in chat, URI history or repo). E.g. `pg_dump -Fc -h <correct-pooler-host> -p 5432 -U <correct-project-db-user> -d postgres -W -f <private-backup-path>`; confirm port/user from Connect panel (session pooler or supported direct connection, not transaction pooler). Check `pg_restore -l <path>`, `pg_restore --file=NUL <path>`, `Get-FileHash -Algorithm SHA256 <path>` and exit codes; readability is not a full restore test. Backup excludes Storage bytes. Require independent recovery/restore plan and owner authorization.

Apply **only** `supabase/migrations/202611240001_c07c_runner.sql` once in SQL Editor. It is atomic and additive. If errors stop, inspect state; don't rerun blindly. Run postflight; all boolean columns true, inconsistent dead notices zero. Only if actual migration verified applied and CLI link correct: `npx --yes supabase@2.122.1 migration repair 202611240001 --status applied --linked`, then `npx --yes supabase@2.122.1 migration list --linked` (seven matching versions). Do not use db push/reset or replay prior migrations. No synthetic SQL tests on hosted DB. Do not enable scheduler or delivery on that development project. Separate staging gate: see `C07c-staging-scheduler.md`.
