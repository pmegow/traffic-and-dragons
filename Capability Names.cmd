@echo off
cd /d "%~dp0"
node dev\launch-bible-editor.js --names
if errorlevel 1 pause
