@echo off
rem Doble clic: abre el puerto del lector en el firewall y muestra la IP para el lector (ver preparar-lector.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar-lector.ps1"
