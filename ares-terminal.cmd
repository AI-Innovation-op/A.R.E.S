@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if defined ARES_NODE_BINARY (
  "%ARES_NODE_BINARY%" "scripts\terminal.mjs" %*
) else (
  node "scripts\terminal.mjs" %*
)
if errorlevel 1 pause
