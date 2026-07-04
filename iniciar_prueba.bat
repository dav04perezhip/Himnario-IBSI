@echo off
title Himnario IBSI 2.0 - Servidor local
where py >nul 2>nul
if %errorlevel%==0 (
  echo Abriendo Himnario IBSI 2.0 en http://localhost:8000
  start "" http://localhost:8000/?version=2.1
  py -m http.server 8000
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Abriendo Himnario IBSI 2.0 en http://localhost:8000
  start "" http://localhost:8000/?version=2.1
  python -m http.server 8000
  goto :eof
)

echo No se encontro Python.
echo Instala Python o usa la extension Live Server de Visual Studio Code.
pause
