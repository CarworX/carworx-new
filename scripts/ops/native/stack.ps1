[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('start', 'status', 'stop')]
    [string] $Action
)

$ErrorActionPreference = 'Stop'
$arguments = @(
    '--distribution', 'CarworX-Native',
    '--user', 'carworx',
    '--cd', '/home/carworx/carworx',
    '--exec', 'env', 'SUPABASE_EXPERIMENTAL_STACK=1',
    '/home/carworx/bin/supabase', $Action, '--stack', 'carworx'
)
if ($Action -eq 'start') {
    $arguments += '--runtime', 'native', '--preparation', 'on-demand'
}
# Start and status output contains local credentials. Suppress it by default.
if ($Action -in 'start', 'status') {
    $arguments += '--output-format', 'json'
    $result = & wsl.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Native Supabase $Action failed."
    }
    $state = ($result -join "`n") | ConvertFrom-Json
    if ($state.runtime -ne 'native') {
        throw 'Unexpected Supabase runtime.'
    }
    Write-Output "Native Supabase $($Action): $($state.runtime) runtime."
} else {
    & wsl.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Native Supabase stop failed.'
    }
}
