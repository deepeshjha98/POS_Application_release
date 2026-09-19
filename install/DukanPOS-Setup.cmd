@echo off
chcp 65001 >nul
setlocal
title दुकान POS — तैयारी

set "TARGET=%LOCALAPPDATA%\DukanPOS"
set "EURL=https://github.com/electron/electron/releases/download/v44.4.3/electron-v44.4.3-win32-x64.zip"

echo.
echo   ======================================
echo     दुकान POS  —  तैयारी
echo   ======================================
echo.

if not exist "%~dp0dukan-app.zip" (
  echo   [रुकिए] dukan-app.zip इसी फ़ोल्डर में होनी चाहिए.
  echo   दोनों फ़ाइलें एक ही जगह रख कर दोबारा चलाइए.
  echo.
  pause
  exit /b 1
)

rem Electron पहले से पड़ा हो तो दोबारा 110 MB उतारने की ज़रूरत नहीं —
rem सिर्फ़ app का अंदरूनी हिस्सा बदलना है. दुकान में समय क़ीमती है.
if exist "%TARGET%\Dukan POS.exe" (
  echo   Electron पहले से मौजूद है — सिर्फ़ app बदल रहे हैं.
  echo.
  goto :putapp
)

echo   [1/3] Electron उतार रहे हैं (लगभग 110 MB, सिर्फ़ पहली बार)...
if exist "%TARGET%" rmdir /s /q "%TARGET%"
mkdir "%TARGET%" 2>nul
curl -L --fail --progress-bar -o "%TEMP%\dukan-electron.zip" "%EURL%"
if errorlevel 1 (
  echo.
  echo   [रुकिए] उतर नहीं पाया. इंटरनेट जाँच कर दोबारा चलाइए.
  echo.
  pause
  exit /b 1
)

echo   [2/3] खोल रहे हैं...
tar -xf "%TEMP%\dukan-electron.zip" -C "%TARGET%"
if errorlevel 1 ( echo   [रुकिए] खोलने में दिक़्क़त हुई. & pause & exit /b 1 )
del "%TEMP%\dukan-electron.zip" 2>nul

if exist "%TARGET%\electron.exe" ren "%TARGET%\electron.exe" "Dukan POS.exe"

:putapp
echo   [3/3] app रख रहे हैं...

rem app अभी चल रहा हो तो उसकी फ़ाइलें बंद पड़ी रहती हैं — मिटाई नहीं जा सकतीं.
rem अपडेट बटन से चलने पर app ख़ुद बंद हो रहा होता है, इसलिए थोड़ा इंतज़ार.
set /a __tries=0
:waitapp
if not exist "%TARGET%\resources\app" goto :unpack
rmdir /s /q "%TARGET%\resources\app" 2>nul
if not exist "%TARGET%\resources\app" goto :unpack
set /a __tries+=1
if %__tries% geq 30 (
  echo   [रुकिए] दुकान POS अभी खुला हुआ है. उसे बंद कर के दोबारा चलाइए.
  echo.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto :waitapp

:unpack
tar -xf "%~dp0dukan-app.zip" -C "%TARGET%\resources"
if errorlevel 1 ( echo   [रुकिए] app रखने में दिक़्क़त हुई. & pause & exit /b 1 )

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\दुकान POS.lnk'); $s.TargetPath='%TARGET%\Dukan POS.exe'; $s.WorkingDirectory='%TARGET%'; $s.Description='दुकान POS'; $s.Save()"

rem अपडेट बटन से चला हो तो बिना कुछ पूछे सीधे app खोल दो
if /i "%~1"=="/auto" (
  echo.
  echo   हो गया. दुकान POS खुल रहा है...
  start "" "%TARGET%\Dukan POS.exe"
  exit /b 0
)

echo.
echo   ======================================
echo     हो गया.
echo.
echo     Desktop पर "दुकान POS" का शॉर्टकट है.
echo     आपका सामान और श्रेणियाँ जस की तस हैं:
echo     %APPDATA%\dukan-pos\pos.db
echo   ======================================
echo.
echo   चालू करने के लिए कोई भी कुंजी दबाइए...
pause >nul
start "" "%TARGET%\Dukan POS.exe"
