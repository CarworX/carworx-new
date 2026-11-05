[CmdletBinding()]
param(
  [long]$UbuntuArchiveBytes = 388975696,
  [long]$UbuntuUnpackedArchiveBytes = 1275596800,
  [double]$NativeToolchainAllowanceGiB = 3,
  [double]$SafetyMarginGiB = 2,
  [long]$PreservationBytes = 0
)
$ErrorActionPreference = 'Stop'
if ($UbuntuArchiveBytes -le 0 -or $UbuntuUnpackedArchiveBytes -le 0 -or $NativeToolchainAllowanceGiB -lt 3 -or $SafetyMarginGiB -lt 2 -or $PreservationBytes -lt 0) {
  throw 'Invalid capacity assumptions; do not reduce the safety allowance.'
}
$free = (Get-PSDrive -Name C).Free
$required = $UbuntuArchiveBytes + $UbuntuUnpackedArchiveBytes + (($NativeToolchainAllowanceGiB + $SafetyMarginGiB) * 1GB) + $PreservationBytes
$engine = $false
$containers = $null
$volumes = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
  try {
    $null = & docker info --format '{{.ServerVersion}}' 2>$null
    $engine = $LASTEXITCODE -eq 0
  } catch { $engine = $false }
  if ($engine) {
    $containerIds = @(& docker ps -a -q 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'Container inventory failed; unknown is not empty.' }
    $volumeNames = @(& docker volume ls -q 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'Volume inventory failed; unknown is not empty.' }
    $containers = @($containerIds | Where-Object { $_ }).Count
    $volumes = @($volumeNames | Where-Object { $_ }).Count
  }
}
$capacity = $free -ge $required
$inventoryEmpty = $engine -and $containers -eq 0 -and $volumes -eq 0
[ordered]@{
  version = 1
  checked_at = [DateTime]::UtcNow.ToString('o')
  status = if ($capacity -and $inventoryEmpty) { 'eligible_for_further_checks' } else { 'blocked' }
  free_gib = [Math]::Round($free / 1GB, 2)
  budget_gib = [Math]::Round($required / 1GB, 2)
  additional_gib = [Math]::Round([Math]::Max([double]0, [double]($required - $free)) / 1GB, 2)
  native_toolchain_allowance_is_estimate = $true
  docker_reachable = $engine
  containers = $containers
  volumes = $volumes
  host_bind_data_checked = $false
  migration_verified = $false
  deletion_authorized_by_this_report = $false
} | ConvertTo-Json
if (-not ($capacity -and $inventoryEmpty)) { exit 2 }
