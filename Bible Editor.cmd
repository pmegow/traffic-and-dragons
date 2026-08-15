@echo off
cd /d "%~dp0"
node dev\launch-bible-editor.js
if errorlevel 1 pause
