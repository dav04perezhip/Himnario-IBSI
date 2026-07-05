@echo off
title Himnario IBSI - Servidor local
where py >nul 2>nul
if %errorlevel%==0 (
  echo Abriendo Himnario IBSI en http://localhost:8000/?version=2.4
  start "" http://localhost:8000/?version=2.4
  py -m http.server 8000
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Abriendo Himnario IBSI en http://localhost:8000/?version=2.4
  start "" http://localhost:8000/?version=2.4
  python -m http.server 8000
  goto :eof
)

echo No se encontro Python.
echo Instala Python o usa la extension Live Server de Visual Studio Code.
pause
