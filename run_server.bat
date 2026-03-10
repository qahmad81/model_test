@echo off
cd /d "%~dp0"
php8 -S localhost:4031 -t .
pause
