param([switch]$ApprovedCreate)
$ErrorActionPreference = 'Stop'
if (-not $ApprovedCreate) { throw 'Review/approve container creation and DPAPI root-secret storage before using -ApprovedCreate.' }
if ($env:OS -ne 'Windows_NT' -or $env:USERNAME -ne 'Stephanie') { throw 'Run as the approved Stephanie Windows identity.' }
$proposal = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'replacement.proposed.json') | ConvertFrom-Json
if ($proposal.container -ne 'enterflow-browser-recovery-29caa4ce81d64f02' -or $proposal.database -ne 'enterflow_browser_recovery_29caa4ce81d64f02') { throw 'Proposal changed; re-review required.' }
$secretDirectory = Join-Path $env:LOCALAPPDATA 'EnterFlow/Task29Recovery/29caa4ce81d64f02'
$secretPath = Join-Path $secretDirectory 'root.credentials.dpapi'
$statePath = Join-Path $PSScriptRoot 'created.local.json'
if ((Test-Path -LiteralPath $secretDirectory) -or (Test-Path -LiteralPath $statePath)) { throw 'Existing recovery state; stop for review, never overwrite or retry.' }
$existing = & docker --context desktop-linux ps -a --filter 'name=^/enterflow-browser-recovery-29caa4ce81d64f02$' --format '{{.ID}}'
if ($LASTEXITCODE -ne 0 -or $existing) { throw 'Docker unavailable or proposed name already exists.' }
& docker --context desktop-linux image inspect $proposal.image --format '{{.Id}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Pinned image unavailable; no pull is authorized by this script.' }
$contextRaw = & docker context inspect desktop-linux
if ($LASTEXITCODE -ne 0) { throw 'Docker context check failed.' }
$context = $contextRaw | ConvertFrom-Json
if ($context[0].Endpoints.docker.Host -ne 'npipe:////./pipe/dockerDesktopLinuxEngine') { throw 'Unexpected Docker engine endpoint.' }
New-Item -ItemType Directory -Path $secretDirectory | Out-Null
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $secretDirectory /inheritance:r /grant:r "${currentIdentity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Private secret-directory ACL failed; stop.' }
$randomBytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
$generator.GetBytes($randomBytes)
$generator.Dispose()
$password = ([BitConverter]::ToString($randomBytes)).Replace('-', '').ToLowerInvariant()
$secure = ConvertTo-SecureString -String $password -AsPlainText -Force
[IO.File]::WriteAllText($secretPath, (ConvertFrom-SecureString -SecureString $secure), (New-Object Text.UTF8Encoding($false)))
$previousRootEnvironment = $env:MYSQL_ROOT_PASSWORD
try {
  $env:MYSQL_ROOT_PASSWORD = $password
  $containerId = & docker --context desktop-linux create --name $proposal.container --pull=never --label "$($proposal.labelKey)=$($proposal.label)" --network bridge --cpus 2 --memory 2g --tmpfs '/var/lib/mysql:rw,nosuid,size=1073741824' -p '127.0.0.1::3306' -e MYSQL_ROOT_PASSWORD -e 'MYSQL_ROOT_HOST=%' $proposal.image '--require_secure_transport=ON'
  if ($LASTEXITCODE -ne 0 -or $containerId -notmatch '^[a-f0-9]{64}$') { throw 'Creation failed; retain state for review, no automatic cleanup/retry.' }
  $state = @{ containerId=$containerId; container=$proposal.container; secretPath=$secretPath }
  [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
  & docker --context desktop-linux start $containerId | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Start failed; retain owned resources for review.' }
  Write-Output 'Created the proposed container only. Wait for TLS startup, then perform the separately approved identity observation. No application database/fixture was created.'
} finally {
  $env:MYSQL_ROOT_PASSWORD = $previousRootEnvironment
  $password = $null
  $secure = $null
  [Array]::Clear($randomBytes, 0, $randomBytes.Length)
}
