@echo off
title Desinstalar Punto de Venta (POS)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0desinstalar-punto.ps1" %*
pause
