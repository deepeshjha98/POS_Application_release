@echo off
chcp 65001 >nul
setlocal
title दुकान POS — तैयारी

set "TARGET=%LOCALAPPDATA%\DukanPOS"
set "EURL=https://github.com/electron/electron/releases/download/v44.4.3/electron-v44.4.3-win32-x64.zip"

echo.
echo   ======================================
echo     दुकान POS  —  पहली बार की तैयारी
echo   ======================================
echo.

if not exist "%~dp0dukan-app.zip" (
  echo   [रुकिए] dukan-app.zip इसी फ़ोल्डर में होनी चाहिए.
  echo   दोनों फ़ाइलें एक ही जगह रख कर दोबारा चलाइए.
  echo.
  pause
  exit /b 1
)

echo   [1/4] पुरानी तैयारी हटा रहे हैं...
if exist "%TARGET%" rmdir /s /q "%TARGET%"
mkdir "%TARGET%" 2>nul

echo   [2/4] Electron उतार रहे हैं (लगभग 110 MB, एक ही बार)...
curl -L --fail --progress-bar -o "%TEMP%\dukan-electron.zip" "%EURL%"
if errorlevel 1 (
  echo.
  echo   [रुकिए] उतर नहीं पाया. इंटरनेट जाँच कर दोबारा चलाइए.
  echo.
  pause
  exit /b 1
)

echo   [3/4] खोल रहे हैं...
tar -xf "%TEMP%\dukan-electron.zip" -C "%TARGET%"
if errorlevel 1 ( echo   [रुकिए] खोलने में दिक़्क़त हुई. & pause & exit /b 1 )
del "%TEMP%\dukan-electron.zip" 2>nul

tar -xf "%~dp0dukan-app.zip" -C "%TARGET%\resources"
if errorlevel 1 ( echo   [रुकिए] app रखने में दिक़्क़त हुई. & pause & exit /b 1 )

if exist "%TARGET%\electron.exe" ren "%TARGET%\electron.exe" "Dukan POS.exe"

echo   [4/4] Desktop पर शॉर्टकट बना रहे हैं...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\दुकान POS.lnk'); $s.TargetPath='%TARGET%\Dukan POS.exe'; $s.WorkingDirectory='%TARGET%'; $s.Description='दुकान POS'; $s.Save()"

echo.
echo   ======================================
echo     हो गया.
echo.
echo     Desktop पर "दुकान POS" का शॉर्टकट बन गया है.
echo     आपका सारा डेटा यहाँ रहेगा:
echo     %APPDATA%\dukan-pos\pos.db
echo   ======================================
echo.
echo   अभी चालू करने के लिए कोई भी कुंजी दबाइए...
pause >nul
start "" "%TARGET%\Dukan POS.exe"
