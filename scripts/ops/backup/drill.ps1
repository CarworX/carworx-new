[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../..')).ProviderPath
if ((Get-PSDrive C).Free -lt 7GB) { throw 'K4 requires at least 7 GiB free on C:.' }
$revision = git -C $repo rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { throw 'Cannot identify source revision.' }
$archive = Join-Path "$env:USERPROFILE\Documents" ("carworx-k4-" + [guid]::NewGuid() + ".tar")
$linuxArchive = & wsl.exe -d CarworX-Native -u carworx -- wslpath -u ($archive.Replace('\', '/'))
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve fixture archive path in WSL.' }
$launch = @"
set -eu
umask 077
exec 9>"`$HOME/.carworx-k4.lock"
flock -n 9
archive=`$1
revision=`$2
scratch=`$(mktemp -d)
tar -xf "`$archive" -C "`$scratch"
pg_dump=`$(find "`$HOME/.supabase/cache/stack" -type f -path '*/postgres/17.*/bin/pg_dump' -print -quit)
test -n "`$pg_dump"
"`$HOME/node-v24.22.2-linux-x64/bin/node" "`$scratch/scripts/ops/backup/drill.js" "`$scratch" "`$revision" "`$(dirname "`$pg_dump")"
"@
$launcher = "$archive.sh"
try {
    git -C $repo archive --format=tar "--output=$archive" $revision -- package.json supabase scripts/ops/backup/drill.js
    if ($LASTEXITCODE -ne 0) { throw 'Cannot package the K4 fixture source.' }
    [IO.File]::WriteAllText($launcher, ($launch -replace "`r`n", "`n") + "`n")
    & wsl.exe -d CarworX-Native -u carworx -- bash "$linuxArchive.sh" $linuxArchive $revision
    if ($LASTEXITCODE -ne 0) { throw 'K4 did not produce a passing receipt.' }
} finally {
    foreach ($path in @($launcher, $archive)) {
        if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path }
    }
}
