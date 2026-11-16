param(
  [Parameter(Mandatory=$true)][ValidateSet('01-client','02-admin-auth','03-admin-workflows','04-admin-remaining')][string]$Spec,
  [switch]$Approved
)
$ErrorActionPreference = 'Stop'
if (-not $Approved) { throw 'Explicit approval of the isolated acceptance write scope is required.' }
$specifications = @{
  '01-client' = @('playwright.config.mjs','tests/browser/client-portal.spec.mjs')
  '02-admin-auth' = @('playwright.admin.config.mjs','tests/browser-admin/admin-auth.smoke.spec.mjs')
  '03-admin-workflows' = @('playwright.admin.config.mjs','tests/browser-admin/admin-portal.spec.mjs')
  '04-admin-remaining' = @('playwright.admin.config.mjs','tests/browser-admin/admin-remaining.spec.mjs')
}
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ((Get-Location).Path -ne $projectRoot) { throw 'Run from the existing project root.' }
$evidenceDirectory = Join-Path $projectRoot "docs/evidence/task29-authenticated-execution/$Spec"
if (Test-Path -LiteralPath $evidenceDirectory) { throw 'This spec already has attempt evidence. No automatic rerun.' }
$redactions = New-Object 'System.Collections.Generic.List[string]'
foreach ($name in @('admin','client')) {
  $file = Join-Path $env:LOCALAPPDATA "EnterFlow/$name-browser-test.credentials.dpapi"
  $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($file))
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if ($value.database -ne 'enterflow_browser_recovery_29caa4ce81d64f02' -or $value.container -ne 'enterflow-browser-recovery-29caa4ce81d64f02') { throw 'Protected fixture target mismatch.' }
  $accounts = if ($name -eq 'admin') { @($value.account) } else { @($value.accounts) }
  foreach ($account in $accounts) { if (-not $account.password) { throw 'Protected password unavailable.' }; $redactions.Add($account.password) }
  $value = $null
  $secure = $null
}
New-Item -ItemType Directory -Path $evidenceDirectory | Out-Null
$definition = $specifications[$Spec]
$cliArguments = @('node_modules/@playwright/test/cli.js','test',"--config=$($definition[0])",$definition[1],
  '--workers=1','--retries=0','--max-failures=1','--output',(Join-Path $evidenceDirectory 'artifacts'))
[IO.File]::WriteAllText((Join-Path $evidenceDirectory 'command.txt'),('node ' + ($cliArguments -join ' ')),(New-Object Text.UTF8Encoding($false)))
$ErrorActionPreference = 'Continue'
$captured = & node @cliArguments 2>&1
$testExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
$text = ($captured | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
foreach ($secret in $redactions) { $text = $text.Replace($secret,'[REDACTED TEST CREDENTIAL]') }
$text = [regex]::Replace($text,'DisposableTask[0-9A-Za-z!]+','[REDACTED SYNTHETIC PASSWORD]')
[IO.File]::WriteAllText((Join-Path $evidenceDirectory 'playwright.log'),$text,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $evidenceDirectory 'exit-code.txt'),[string]$testExit,(New-Object Text.UTF8Encoding($false)))
# Existing config disables traces; text artifacts are scrubbed before evidence use.
foreach ($artifact in @(Get-ChildItem -LiteralPath $evidenceDirectory -Recurse -File | Where-Object { $_.Extension -in @('.md','.txt','.json','.log') })) {
  $artifactText = [IO.File]::ReadAllText($artifact.FullName)
  foreach ($secret in $redactions) { $artifactText = $artifactText.Replace($secret,'[REDACTED TEST CREDENTIAL]') }
  $artifactText = [regex]::Replace($artifactText,'DisposableTask[0-9A-Za-z!]+','[REDACTED SYNTHETIC PASSWORD]')
  [IO.File]::WriteAllText($artifact.FullName,$artifactText,(New-Object Text.UTF8Encoding($false)))
}
$redactions.Clear()
$captured = $null
Write-Output "Spec $Spec completed once; exit $testExit."
Get-Content -LiteralPath (Join-Path $evidenceDirectory 'playwright.log') -Tail 65
exit $testExit
