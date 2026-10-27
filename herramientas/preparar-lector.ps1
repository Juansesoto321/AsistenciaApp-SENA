# Prepara este computador para que el lector ZKTeco se conecte por la red (WiFi):
# abre en el firewall de Windows el puerto del backend y muestra lo que hay que
# escribir en el lector (COMM. > Cloud Server Settings). Se ejecuta con doble
# clic en preparar-lector.bat; pide permiso de administrador para el firewall.
param([int]$Puerto = 0)

[Console]::OutputEncoding = [Text.Encoding]::UTF8
$raiz = Split-Path -Parent $PSScriptRoot

# El puerto que publica Docker (PUERTO_API en el .env); sin .env, el 4000
if (-not $Puerto) {
  $Puerto = 4000
  $archivoEnv = Join-Path $raiz ".env"
  if (Test-Path $archivoEnv) {
    $linea = Select-String -Path $archivoEnv -Pattern '^\s*PUERTO_API\s*=\s*(\d+)' | Select-Object -First 1
    if ($linea) { $Puerto = [int]$linea.Matches[0].Groups[1].Value }
  }
}

# El firewall solo se puede cambiar como administrador: se vuelve a abrir pidiendo permiso
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Puerto $Puerto"
  exit
}

$regla = "AsistenciaApp - lector biométrico (puerto $Puerto)"
if (Get-NetFirewallRule -DisplayName $regla -ErrorAction SilentlyContinue) {
  Write-Host "El puerto $Puerto ya estaba abierto en el firewall." -ForegroundColor Green
} else {
  New-NetFirewallRule -DisplayName $regla -Direction Inbound -Protocol TCP -LocalPort $Puerto -Action Allow -Profile Any | Out-Null
  Write-Host "Listo: el puerto $Puerto quedó abierto en el firewall de Windows." -ForegroundColor Green
}

# Las IP de las redes reales (sin Docker, WSL ni máquinas virtuales)
$redes = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|VirtualBox|VMware|Loopback|Bluetooth" } |
  Sort-Object { if ($_.InterfaceAlias -match "Wi-?Fi|WLAN|inal") { 0 } elseif ($_.IPAddress -like "192.168.137.*") { 1 } else { 2 } }

Write-Host ""
Write-Host "Escribe esto en el lector:  M/OK > COMM. > Cloud Server Settings" -ForegroundColor Cyan
Write-Host "  Enable Domain Name: apagado   ·   Enable Proxy Server: apagado"
if (-not $redes) {
  Write-Host "  No encontré una red. Conecta este computador a la misma WiFi del lector y vuelve a abrir este archivo." -ForegroundColor Yellow
}
$primera = $true
foreach ($red in $redes) {
  $tipo = if ($red.IPAddress -like "192.168.137.*") { "hotspot de este computador" } else { $red.InterfaceAlias }
  if ($primera) {
    Write-Host ("  Server Address: {0}   ({1})" -f $red.IPAddress, $tipo) -ForegroundColor White
    $primera = $false
  } else {
    Write-Host ("  ...o si el lector está en otra red: {0}   ({1})" -f $red.IPAddress, $tipo) -ForegroundColor DarkGray
  }
}
Write-Host ("  Server Port:    {0}" -f $Puerto) -ForegroundColor White
Write-Host ""
Write-Host "Y antes: M/OK > COMM. > PC Connection > HTTPS apagado (el lector se reinicia)."
Write-Host "Después abre en la app: Ambientes y lectores > Conectar un lector."
Write-Host ""
Read-Host "Presiona Enter para cerrar"
