# Desinstala el Punto de Venta (POS) y el agente del cajón de este equipo.

param(
  [string]$NombreApp = "Punto de Venta POS"
)

$ErrorActionPreference = 'Continue'

Clear-Host
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "      DESINSTALAR PUNTO DE VENTA (POS)                      " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Desinstalar agente del cajón
$scriptDesinstalarCajon = Join-Path $PSScriptRoot "cajon\desinstalar.ps1"
if (Test-Path -LiteralPath $scriptDesinstalarCajon) {
  & $scriptDesinstalarCajon
}

# 2. Quitar accesos directos
$destinos = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) "$NombreApp.lnk"),
  (Join-Path ([Environment]::GetFolderPath('Startup')) "$NombreApp.lnk"),
  (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) "$NombreApp.lnk"),
  (Join-Path ([Environment]::GetFolderPath('CommonStartup')) "$NombreApp.lnk")
)

foreach ($lnk in $destinos) {
  if ($lnk -and (Test-Path -LiteralPath $lnk)) {
    try {
      Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue
      Write-Host "Acceso directo eliminado: $lnk" -ForegroundColor Gray
    } catch { }
  }
}

Write-Host ""
Write-Host "Punto de Venta desinstalado completamente de este equipo." -ForegroundColor Green
Write-Host ""
