# Fresh-clone verification wrapper (Windows PowerShell). Delegates to the Node runner.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
node scripts/verify-fresh-clone.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
