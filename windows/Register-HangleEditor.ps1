[CmdletBinding()]
param(
    [string]$Vault,
    [string]$ObsidianExe,
    [switch]$Unregister
)
$ErrorActionPreference = 'Stop'
$installDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'HangleEditor'
$launcher = Join-Path $installDir 'HangleEditor.exe'
$classes = 'Software\Classes'
$progId = 'HangleEditor.Document'
$appKey = "$classes\Applications\HangleEditor.exe"
$registered = 'Software\RegisteredApplications'
$capabilities = 'Software\HangleEditor\Capabilities'
$registry = [Microsoft.Win32.Registry]::CurrentUser
$command = '"' + $launcher + '" "%1"'
foreach ($commandKey in @("$classes\$progId\shell\open\command","$appKey\shell\open\command")) {
    $existingKey = $registry.OpenSubKey($commandKey)
    if ($null -ne $existingKey) {
        try { $existingCommand = $existingKey.GetValue('') } finally { $existingKey.Dispose() }
        if ($existingCommand -and $existingCommand -ne $command) { throw "Another application owns $commandKey." }
    }
}
function Set-RegValue([string]$Key, [string]$Name, $Value, $Kind = [Microsoft.Win32.RegistryValueKind]::String) {
    $handle = $registry.CreateSubKey($Key)
    try { $handle.SetValue($Name, $Value, $Kind) } finally { $handle.Dispose() }
}
function Remove-RegValue([string]$Key, [string]$Name) {
    $handle = $registry.OpenSubKey($Key, $true)
    if ($null -ne $handle) { try { $handle.DeleteValue($Name, $false) } finally { $handle.Dispose() } }
}
if ($Unregister) {
    foreach ($extension in '.hwp','.hwpx') { Remove-RegValue "$classes\$extension\OpenWithProgids" $progId }
    Remove-RegValue $registered 'Hangle Editor'
    foreach ($key in @("$classes\$progId",$appKey,$capabilities)) { $registry.DeleteSubKeyTree($key, $false) }
    foreach ($name in 'HangleEditor.exe','explorer.config') {
        $owned = Join-Path $installDir $name
        if (Test-Path -LiteralPath $owned) { Remove-Item -LiteralPath $owned -Force }
    }
    Write-Output 'Removed the Hangle Editor application registration for this Windows user.'
    return
}

$config = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'obsidian\obsidian.json'
$entries = @((Get-Content -Raw -Encoding UTF8 -LiteralPath $config | ConvertFrom-Json).vaults.PSObject.Properties)
if ($Vault) {
    $matchesVault = @($entries | Where-Object { $_.Name -eq $Vault -or $_.Value.path -eq $Vault -or (Split-Path -Leaf $_.Value.path) -eq $Vault })
    if ($matchesVault.Count -ne 1) { throw 'Specify an existing vault ID or its full folder path with -Vault.' }
    $entry = $matchesVault[0]
} else {
    $entry = $entries | Sort-Object { $_.Value.ts } -Descending | Select-Object -First 1
    if (!$entry) { throw 'Open an Obsidian vault with Hangle Editor enabled first.' }
}
if (!$ObsidianExe) {
    $running = Get-Process -Name Obsidian -ErrorAction SilentlyContinue | Where-Object Path | Select-Object -First 1 -ExpandProperty Path
    $candidates = @($running, (Join-Path $env:ProgramFiles 'Obsidian\Obsidian.exe'), (Join-Path $env:LOCALAPPDATA 'Programs\Obsidian\Obsidian.exe'))
    $ObsidianExe = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
}
if (!$ObsidianExe -or !(Test-Path -LiteralPath $ObsidianExe -PathType Leaf)) { throw 'Specify Obsidian.exe with -ObsidianExe.' }
$ObsidianExe = (Resolve-Path -LiteralPath $ObsidianExe).Path
$compiler = @('Framework64','Framework') | ForEach-Object { Join-Path $env:WINDIR "Microsoft.NET\$_\v4.0.30319\csc.exe" } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$compiler) { throw 'The Windows .NET Framework C# compiler is required.' }
$source = Join-Path $PSScriptRoot 'HangleEditor.cs'
if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Keep HangleEditor.cs beside the registration script.' }
[IO.Directory]::CreateDirectory($installDir) | Out-Null
& $compiler /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll "/out:$launcher" $source
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
[IO.File]::WriteAllLines((Join-Path $installDir 'explorer.config'), [string[]]@($entry.Name,$ObsidianExe), [Text.UTF8Encoding]::new($false))
$icon = '"' + $ObsidianExe + '",0'
Set-RegValue "$classes\$progId" '' 'Hangle Editor document'
Set-RegValue "$classes\$progId" 'FriendlyTypeName' 'Hangle Editor document'
Set-RegValue "$classes\$progId\Application" 'ApplicationName' 'Hangle Editor'
Set-RegValue "$classes\$progId\DefaultIcon" '' $icon
Set-RegValue "$classes\$progId\shell\open\command" '' $command
Set-RegValue $appKey 'FriendlyAppName' 'Hangle Editor'
Set-RegValue "$appKey\shell\open\command" '' $command
Set-RegValue $capabilities 'ApplicationName' 'Hangle Editor'
Set-RegValue $capabilities 'ApplicationDescription' 'Edit HWP and HWPX documents in Obsidian.'
Set-RegValue $capabilities 'ApplicationIcon' $icon
foreach ($extension in '.hwp','.hwpx') {
    Set-RegValue "$classes\$extension\OpenWithProgids" $progId ([byte[]]::new(0)) ([Microsoft.Win32.RegistryValueKind]::None)
    Set-RegValue "$appKey\SupportedTypes" $extension ''
    Set-RegValue "$capabilities\FileAssociations" $extension $progId
}
Set-RegValue $registered 'Hangle Editor' $capabilities
Add-Type -Namespace HangleEditor -Name ShellNotification -MemberDefinition '[System.Runtime.InteropServices.DllImport("shell32.dll")] public static extern void SHChangeNotify(int evt, uint flags, System.IntPtr a, System.IntPtr b);'
[HangleEditor.ShellNotification]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output ("Registered Hangle Editor for vault " + $entry.Value.path + ". In Open with, select Hangle Editor and Always for each extension you want to open by double-click.")
