@echo off
setlocal enabledelayedexpansion
title 狰州市公安局 · 本地预览

cd /d "%~dp0"

set PORT=8801
set PY=

where python >nul 2>nul && set PY=python
if not defined PY (
  where py >nul 2>nul && set PY=py
)
if not defined PY goto NOPY

:CHECKPORT
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
  set /a PORT=!PORT!+1
  if !PORT! GTR 8820 (
    echo.
    echo  端口 8801-8820 均被占用，请关闭部分程序后重试。
    echo.
    pause
    exit /b 1
  )
  goto CHECKPORT
)

echo.
echo  ============================================
echo    狰州市公安局 · 本地预览
echo  ============================================
echo    地址   http://127.0.0.1:!PORT!/
echo    目录   %CD%
echo.
echo    关闭本窗口即停止服务
echo  ============================================
echo.

start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://127.0.0.1:!PORT!/"

!PY! -m http.server !PORT! --bind 127.0.0.1

goto :EOF

:NOPY
echo.
echo  ============================================
echo    未检测到 Python
echo  ============================================
echo.
echo    请先安装 Python 3：
echo    https://www.python.org/downloads/
echo.
echo    安装时务必勾选 "Add Python to PATH"
echo    装好后重新双击本文件即可。
echo.
pause
exit /b 1
