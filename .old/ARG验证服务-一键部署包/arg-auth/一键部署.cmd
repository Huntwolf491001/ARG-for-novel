@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing
where npm >nul 2>nul
if errorlevel 1 goto missing
echo 正在安装部署工具，请稍候……
call npm install
if errorlevel 1 goto failed
node scripts/deploy.js
if errorlevel 1 goto failed
echo.
echo 部署流程结束。请查看上方显示的 Worker 地址。
pause
exit /b 0
:missing
echo 未找到 Node.js 或 npm。请先安装 Node.js，然后重新运行此脚本。
echo https://nodejs.org/
pause
exit /b 1
:failed
echo.
echo 部署未完成。请保留上方错误信息，方便排查。
pause
exit /b 1
