# Quita el agente del cajón de este equipo (detiene, quita el arranque automático y borra sus archivos).
$ErrorActionPreference = 'Continue'
$destino = Join-Path $env:LOCALAPPDATA 'POS-Cajon'
$inicio = Join-Path ([Environment]::GetFolderPath('Startup')) 'POS Cajon.lnk'

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*agente-cajon.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500

if (Test-Path -LiteralPath $inicio) { Remove-Item -LiteralPath $inicio -Force }
if (Test-Path -LiteralPath $destino) { Remove-Item -LiteralPath $destino -Recurse -Force }

Write-Host 'Agente del cajón desinstalado. El botón Cajón vuelve a abrir imprimiendo ~1 cm de papel.' -ForegroundColor Green
