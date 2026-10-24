# Bootstrap magro: instala node_modules do app/web sem npm (npm OOM com 4GB RAM).
# Usa curl.exe + tar.exe (nativos, <20MB RAM). Resolve ranges ^ ~ exact >= *.
# Uso: powershell -ExecutionPolicy Bypass -File tools\bootstrap-web.ps1
$ErrorActionPreference = "Stop"
$Web = Join-Path $PSScriptRoot "..\app\web"
$Nm = Join-Path $Web "node_modules"
New-Item -ItemType Directory -Force -Path $Nm | Out-Null
$Tmp = Join-Path ([IO.Path]::GetTempPath()) "radar-bootstrap"
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

function Get-Versions($name) {
  $u = "https://registry.npmjs.org/$name"
  $f = Join-Path $Tmp "$($name -replace '/','__').json"
  if (-not (Test-Path $f)) { curl.exe -sL --retry 3 -H "Accept: application/vnd.npm.install-v1+json" $u -o $f }
  (Get-Content $f -Raw | ConvertFrom-Json).versions.PSObject.Properties.Name
}
function Pad-Ver($v) {
  $core = ($v -split '-')[0]
  $p = $core -split '\.'
  return ("{0:D8}.{1:D8}.{2:D8}" -f [int]$p[0], [int]$p[1], [int]$p[2])
}
function Get-Candidates($name, $range) {
  $r = $range.Trim()
  # pré-releases só entram se o range pedir um (ex: 1.0.0-beta.27)
  $tag = $null
  if ($r -match '-([0-9A-Za-z.]+)') { $tag = $Matches[1] }
  if ($tag) { $vers = @(Get-Versions $name | Where-Object { $_ -match [regex]::Escape($tag) }) }
  else { $vers = @(Get-Versions $name | Where-Object { $_ -notmatch '-' }) }
  if ($r -eq "*" -or $r -eq "latest") { return $vers }
  if ($r -match "^https?:" -or $r -match "^file:") { throw "range não suportado: $range" }
  $base = ($r -replace "^[\^~>=< ]+", "") -replace "\s.*$", ""
  $b = $base -split '\.'
  $cands = @($vers | Where-Object { (Pad-Ver $_) -ge (Pad-Ver $base) })
  if ($r.StartsWith("^")) {
    if ([int]$b[0] -gt 0) { $cands = @($cands | Where-Object { ($_ -split '\.')[0] -eq $b[0] }) }
    else { $cands = @($cands | Where-Object { ($_ -split '\.')[0] -eq "0" -and ($_ -split '\.')[1] -eq $b[1] }) }
  } elseif ($r.StartsWith("~")) {
    $cands = @($cands | Where-Object { ($_ -split '\.')[0] -eq $b[0] -and ($_ -split '\.')[1] -eq $b[1] })
  } elseif ($r -match "^(\S+)\s+-\s+(\S+)") {
    $lo = $Matches[1]; $hi = $Matches[2]
    $cands = @($cands | Where-Object { (Pad-Ver $_) -ge (Pad-Ver $lo) })
    $hb = $hi -split '\.'
    if ($hb.Count -eq 1) { $cands = @($cands | Where-Object { ([int](($_ -split '\.')[0])) -le [int]$hb[0] }) }
    elseif ($hb.Count -eq 2) { $cands = @($cands | Where-Object { ($_ -split '\.')[0] -eq $hb[0] -and ([int](($_ -split '\.')[1])) -le [int]$hb[1] }) }
    else { $cands = @($cands | Where-Object { (Pad-Ver $_) -le (Pad-Ver $hi) }) }
  } elseif ($r -match "^[0-9]") { $cands = @($vers | Where-Object { $_ -eq $base }) }
  return $cands
}
function Resolve-Range($name, $range) {
  $best = Get-Candidates $name $range | Sort-Object { Pad-Ver $_ } | Select-Object -Last 1
  if (-not $best) { throw "sem candidato $name@$range" }
  return $best
}
$PLATFORM_RE = '-(win32|linux|darwin|freebsd|openbsd|android|aix|sunos)-(x64|arm64|arm|ppc64|riscv64|loong64|x32|ia32)$|^fsevents$|^@esbuild/(?!win32-x64$)|^@rollup/rollup-(?!win32-x64-msvc$)|^@lightningcss/(?!.*)|^lightningcss-(win32|linux|darwin)'
$PLATFORM_KEEP = @("@esbuild/win32-x64", "@rollup/rollup-win32-x64-msvc")
function Install-Pkg($name, $range) {
  $dest = Join-Path $Nm $name
  $destPkg = Join-Path $dest "package.json"
  if (Test-Path $destPkg) {
    $cur = (Get-Content $destPkg -Raw | ConvertFrom-Json).version
    if ((Get-Candidates $name $range) -contains $cur) {
      $pj0 = Get-Content $destPkg -Raw | ConvertFrom-Json
      foreach ($d in @($pj0.dependencies, $pj0.optionalDependencies)) {
        if (-not $d) { continue }
        foreach ($p in $d.PSObject.Properties) {
          if (($p.Name -match $PLATFORM_RE) -and ($PLATFORM_KEEP -notcontains $p.Name)) { continue }
          Install-Pkg $p.Name $p.Value
        }
      }
      return
    }
  }
  $ver = Resolve-Range $name $range
  $cur = $null
  if (Test-Path (Join-Path $dest "package.json")) {
    $cur = (Get-Content (Join-Path $dest "package.json") -Raw | ConvertFrom-Json).version
  }
  if ($cur -ne $ver) {
    Write-Host "GET $name@$ver"
    $meta = "https://registry.npmjs.org/$name/$ver"
    $doc = curl.exe -sL --retry 3 $meta | ConvertFrom-Json
    $tgz = Join-Path $Tmp "$($name -replace '/','__')-$ver.tgz"
    if (-not (Test-Path $tgz)) { curl.exe -sL --retry 3 $doc.dist.tarball -o $tgz }
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    tar.exe -xzf $tgz -C $dest --strip-components=1
  }
  $pj = Get-Content (Join-Path $dest "package.json") -Raw | ConvertFrom-Json
    foreach ($d in @($pj.dependencies, $pj.optionalDependencies)) {
    if (-not $d) { continue }
    foreach ($p in $d.PSObject.Properties) {
      # pula binários de outra plataforma (mantém só win32-x64 necessários)
      if (($p.Name -match $PLATFORM_RE) -and ($PLATFORM_KEEP -notcontains $p.Name)) { continue }
      Install-Pkg $p.Name $p.Value
    }
  }
}

$direct = @(
  @("react", "^18.3.1"), @("react-dom", "^18.3.1"),
  @("react-router-dom", "^6.27.0"), @("@tanstack/react-query", "^5.59.0"),
  @("recharts", "^2.13.0"), @("lucide-react", "^0.453.0"),
  @("esbuild", "^0.21.5"), @("typescript", "^5.6.3"),
  @("@types/react", "^18.3.11"), @("@types/react-dom", "^18.3.1"),
  @("tailwindcss", "^3.4.0"), @("postcss", "^8.4.0"), @("autoprefixer", "^10.4.0"),
  @("vite", "^5.4.0"), @("@vitejs/plugin-react", "^4.3.0"),
  @("rollup", "4.24.0")
)
if ($env:BOOTSTRAP_LIBS_ONLY -ne "1") {
foreach ($pair in $direct) { Install-Pkg $pair[0] $pair[1] }
Write-Host "BOOTSTRAP OK"
}
