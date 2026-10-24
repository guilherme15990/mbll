# Completa-faltas: lê o erro do Vite, descobre o range no package.json pai e instala.
# Uso: powershell -ExecutionPolicy Bypass -File tools\fix-missing.ps1 (vite dev precisa estar no ar)
$ErrorActionPreference = "Stop"
$env:BOOTSTRAP_LIBS_ONLY = "1"
. (Join-Path $PSScriptRoot "bootstrap-web.ps1")
$Nm = Join-Path $PSScriptRoot "..\apps\web\node_modules"

function Find-Range($mod) {
  $files = Get-ChildItem -Path $Nm -Filter package.json -Recurse -Depth 3 -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    try { $pj = Get-Content $f.FullName -Raw | ConvertFrom-Json } catch { continue }
    foreach ($bag in @($pj.dependencies, $pj.optionalDependencies, $pj.peerDependencies)) {
      if ($bag -and $bag.PSObject.Properties.Name -contains $mod) {
        return $bag.$mod
      }
    }
  }
  return $null
}

for ($i = 1; $i -le 12; $i++) {
  $page = (curl.exe -s -m 20 "http://localhost:5173/src/main.tsx" | Out-String)
  if ($page -match "Cannot find module '([^']+)'") {
    $mod = $Matches[1]
    Write-Host "[$i] falta: $mod"
    $range = Find-Range $mod
    if (-not $range) { $range = "latest"; Write-Host "  range desconhecido, usando latest" }
    else { Write-Host "  range: $range" }
    Install-Pkg $mod $range
  } elseif ($page -match '"message":"([^"]+)"') {
    Write-Host "[$i] outro erro: $($Matches[1].Substring(0, [Math]::Min(200, $Matches[1].Length)))"
    break
  } else {
    Write-Host "[$i] main.tsx transforma OK"
    break
  }
}
Write-Host "FIX DONE"
