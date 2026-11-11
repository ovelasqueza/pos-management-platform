# Instala el Punto de Venta (POS) completo en ESTE equipo:
#   1. Agente del cajón monedero con impresora térmica e inicio automático.
#   2. App de caja en pantalla completa (Modo Kiosko PWA) que inicia automáticamente al encender el PC.

param(
  [string]$Url = "https://pos.puntocloud.com.co/caja",
  [string]$NombreApp = "Punto de Venta POS",
  [int]$Puerto = 17777,
  [ValidateSet(2, 5)][int]$Pin = 2
)

$ErrorActionPreference = 'Stop'

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       INSTALADOR DE PUNTO DE VENTA (POS)                   " -ForegroundColor Cyan
Write-Host "       $Url" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# 1. Detectar navegador web (Google Chrome o Microsoft Edge)
# -----------------------------------------------------------------------------
Write-Host "[1/3] Detectando navegador web compatible..." -ForegroundColor Yellow

$rutasNavegadores = @(
  @{ Nombre = "Google Chrome"; Ruta = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" },
  @{ Nombre = "Google Chrome"; Ruta = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" },
  @{ Nombre = "Google Chrome"; Ruta = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" },
  @{ Nombre = "Microsoft Edge"; Ruta = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" },
  @{ Nombre = "Microsoft Edge"; Ruta = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" },
  @{ Nombre = "Microsoft Edge"; Ruta = "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe" }
)

$navegadorElegido = $null
foreach ($nav in $rutasNavegadores) {
  if (Test-Path -LiteralPath $nav.Ruta) {
    $navegadorElegido = $nav
    break
  }
}

if (-not $navegadorElegido) {
  Write-Host "ERROR: No se encontró Google Chrome ni Microsoft Edge instalado en este equipo." -ForegroundColor Red
  Write-Host "Por favor instala Google Chrome o Microsoft Edge para continuar."
  exit 1
}

Write-Host "  OK: Navegador detectado: $($navegadorElegido.Nombre)" -ForegroundColor Green
Write-Host "      $($navegadorElegido.Ruta)" -ForegroundColor Gray
Write-Host ""

# -----------------------------------------------------------------------------
# 2. Configurar agente del cajón monedero e impresora térmica
# -----------------------------------------------------------------------------
Write-Host "[2/3] Configurando agente del cajón e impresora térmica..." -ForegroundColor Yellow
$scriptCajon = Join-Path $PSScriptRoot "cajon\instalar.ps1"

if (-not (Test-Path -LiteralPath $scriptCajon)) {
  Write-Host "ADVERTENCIA: No se encontró $scriptCajon. Saltando configuración de cajón." -ForegroundColor Yellow
} else {
  & $scriptCajon -Puerto $Puerto -Pin $Pin -Origenes @($Url, "https://pos.puntocloud.com.co", "http://localhost:3000", "http://127.0.0.1:3000")
}
Write-Host ""

# -----------------------------------------------------------------------------
# 3. Configurar inicio automático en pantalla completa (Modo Kiosko PWA)
# -----------------------------------------------------------------------------
Write-Host "[3/3] Configurando acceso directo e inicio automático en pantalla completa..." -ForegroundColor Yellow

$destinoPublico = Join-Path $env:PUBLIC "POS-Cajon"
if (-not (Test-Path -LiteralPath $destinoPublico)) {
  New-Item -ItemType Directory -Force -Path $destinoPublico | Out-Null
}

# Copiar ícono si está disponible
$icoOrigen = Join-Path $PSScriptRoot "pos.ico"
$icoDestino = Join-Path $destinoPublico "pos.ico"
if (Test-Path -LiteralPath $icoOrigen) {
  Copy-Item -LiteralPath $icoOrigen -Destination $icoDestino -Force
}

# Parámetros para modo Kiosko en pantalla completa:
# --app: abre en ventana independiente limpia sin barras ni pestañas
# --kiosk: pantalla completa fija
# --kiosk-printing: imprime sin ventana emergente de confirmación
$argumentosLnk = "--app=""$Url"" --kiosk --kiosk-printing"

$sh = New-Object -ComObject WScript.Shell

# Rutas donde se colocará el acceso directo:
$destinosAccesos = @(
  # 1. En el Escritorio del usuario actual
  (Join-Path ([Environment]::GetFolderPath('Desktop')) "$NombreApp.lnk"),
  # 2. En la carpeta Inicio de Windows (para que arranque solo al encender el PC)
  (Join-Path ([Environment]::GetFolderPath('Startup')) "$NombreApp.lnk")
)

# Si es administrador, colocar también en el escritorio común y startup común
$comunEscritorio = [Environment]::GetFolderPath('CommonDesktopDirectory')
$comunStartup = [Environment]::GetFolderPath('CommonStartup')
if ($comunEscritorio) { $destinosAccesos += (Join-Path $comunEscritorio "$NombreApp.lnk") }
if ($comunStartup) { $destinosAccesos += (Join-Path $comunStartup "$NombreApp.lnk") }

foreach ($rutaLnk in ($destinosAccesos | Select-Object -Unique)) {
  try {
    $lnk = $sh.CreateShortcut($rutaLnk)
    $lnk.TargetPath = $navegadorElegido.Ruta
    $lnk.Arguments = $argumentosLnk
    $lnk.WorkingDirectory = (Split-Path -Parent $navegadorElegido.Ruta)
    $lnk.Description = "Sistema Punto de Venta (POS)"
    if (Test-Path -LiteralPath $icoDestino) {
      $lnk.IconLocation = "$icoDestino,0"
    }
    $lnk.Save()
    Write-Host "  OK: Acceso directo creado en: $rutaLnk" -ForegroundColor Green
  } catch {
    # Continuar si alguna ruta del sistema requiere privilegios mayores
  }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " ¡INSTALACIÓN COMPLETADA CON ÉXITO!                         " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "1. El cajón monedero está configurado y arrancará siempre." -ForegroundColor White
Write-Host "2. La app de caja abrirá en PANTALLA COMPLETA cada vez que" -ForegroundColor White
Write-Host "   se encienda o reinicie este computador." -ForegroundColor White
Write-Host ""
Write-Host "NOTA: Para salir de la pantalla completa en cualquier momento," -ForegroundColor Gray
Write-Host "      puedes presionar la tecla F11 o la combinación Alt + F4." -ForegroundColor Gray
Write-Host ""

$probar = Read-Host "¿Deseas abrir el Punto de Venta en pantalla completa ahora mismo para probar? (S/N)"
if ($probar -match '^[sS]') {
  Start-Process -FilePath $navegadorElegido.Ruta -ArgumentList $argumentosLnk
}
