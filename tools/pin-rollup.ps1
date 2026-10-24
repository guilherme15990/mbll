# Uso único: instala rollup@4.24.0 exato + binding msvc íntegro (sem npm, sem packument).
$ErrorActionPreference = "Stop"
$Nm = Join-Path $PSScriptRoot "..\apps\web\node_modules"
$Tmp = Join-Path ([IO.Path]::GetTempPath()) "radar-bootstrap"
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
function Install-Tgz($name, $ver, $url) {
  $dest = Join-Path $Nm $name
  $tgz = Join-Path $Tmp "$($name -replace '/','__')-$ver.tgz"
  if (-not (Test-Path $tgz)) { curl.exe -sL --retry 3 $url -o $tgz }
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  tar.exe -xzf $tgz -C $dest --strip-components=1
  Write-Host "GET $name@$ver"
}
Install-Tgz "rollup" "4.24.0" "https://registry.npmjs.org/rollup/-/rollup-4.24.0.tgz"
Install-Tgz "@rollup/rollup-win32-x64-msvc" "4.24.0" "https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.24.0.tgz"
Write-Host "ROLLUP PIN OK"
