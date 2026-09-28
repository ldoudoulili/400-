@echo off
cd /d "%~dp0"
echo ============================================
echo   Starting 400 Service Record ...
echo   Browser: http://localhost:8400
echo   Close the WEB PAGE to stop the program.
echo   (This window is only for debugging.)
echo ============================================
echo.
start "" http://localhost:8400
node "%~dp0server.js"
echo.
echo Program stopped. If node is not found, please install Node.js first.
pause
