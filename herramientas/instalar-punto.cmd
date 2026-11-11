@echo off
title Instalador Punto de Venta (POS)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-punto.ps1" %*
pause
