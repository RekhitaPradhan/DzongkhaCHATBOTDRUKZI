@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.11 64-bit first.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating Python environment...
  py -3.11 -m venv .venv
  if errorlevel 1 (
    echo Could not create Python 3.11 environment. Install Python 3.11 64-bit.
    pause
    exit /b 1
  )
)

echo Installing or checking Python packages...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Python package installation failed. Read START_HERE_WINDOWS.md.
  pause
  exit /b 1
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama was not found. Install it from https://ollama.com/download
  echo Then run: ollama pull qwen3:4b
  pause
  exit /b 1
)

start "DRUKZI Translation and Voice" cmd /k ""%CD%\.venv\Scripts\python.exe" "%CD%\server.py""
start "DRUKZI Website" cmd /k "npx --yes serve ."
timeout /t 3 >nul
start "" http://localhost:3000
echo.
echo Keep both terminal windows open while using DRUKZI.
echo First model download can take several minutes.
pause
