@echo off
chcp 65001 >nul
rem 雙擊啟動模擬器：開發伺服器啟動後會自動開瀏覽器。關掉這個視窗就會停止。
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
if not exist node_modules call npm install
call npm run dev -- --open
