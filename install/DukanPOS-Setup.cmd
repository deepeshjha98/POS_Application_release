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

echo   [1/4] Electron उतार रहे हैं (लगभग 110 MB, सिर्फ़ पहली बार)...
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

echo   [2/4] खोल रहे हैं...
tar -xf "%TEMP%\dukan-electron.zip" -C "%TARGET%"
if errorlevel 1 ( echo   [रुकिए] खोलने में दिक़्क़त हुई. & pause & exit /b 1 )
del "%TEMP%\dukan-electron.zip" 2>nul

if exist "%TARGET%\electron.exe" ren "%TARGET%\electron.exe" "Dukan POS.exe"

:putapp
echo   [3/4] app रख रहे हैं...

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

echo   [4/4] डेस्कटॉप पर शॉर्टकट बना रहे हैं...
set "B64=%TEMP%\dukan-lnk.b64"
set "PS1=%TEMP%\dukan-lnk.ps1"
> "%B64%" echo 77u/cGFyYW0oW3N0cmluZ10kVGFyZ2V0KQ0KJEVycm9yQWN0aW9uUHJlZmVyZW5jZSA9ICdTdG9w
>> "%B64%" echo Jw0KDQokZXhlICA9IEpvaW4tUGF0aCAkVGFyZ2V0ICdEdWthbiBQT1MuZXhlJw0KJGljb24gPSBK
>> "%B64%" echo b2luLVBhdGggJFRhcmdldCAncmVzb3VyY2VzXGFwcFxpY29uLmljbycNCiRzaGVsbCA9IE5ldy1P
>> "%B64%" echo YmplY3QgLUNvbU9iamVjdCBXU2NyaXB0LlNoZWxsDQoNCmZ1bmN0aW9uIE5ldy1EdWthbkxpbmso
>> "%B64%" echo W3N0cmluZ10kTGlua1BhdGgpIHsNCiAgJGRpciA9IFNwbGl0LVBhdGggJExpbmtQYXRoDQogIGlm
>> "%B64%" echo ICgtbm90IChUZXN0LVBhdGggJGRpcikpIHsgTmV3LUl0ZW0gLUl0ZW1UeXBlIERpcmVjdG9yeSAt
>> "%B64%" echo UGF0aCAkZGlyIC1Gb3JjZSB8IE91dC1OdWxsIH0NCiAgJGxpbmsgPSAkc2hlbGwuQ3JlYXRlU2hv
>> "%B64%" echo cnRjdXQoJExpbmtQYXRoKQ0KICAkbGluay5UYXJnZXRQYXRoID0gJGV4ZQ0KICAkbGluay5Xb3Jr
>> "%B64%" echo aW5nRGlyZWN0b3J5ID0gJFRhcmdldA0KICAkbGluay5EZXNjcmlwdGlvbiA9ICfgpKbgpYHgpJXg
>> "%B64%" echo pL7gpKggUE9TIOKAlCDgpKbgpYHgpJXgpL7gpKgg4KSV4KS+IOCkueCkv+CkuOCkvuCkrCcNCiAg
>> "%B64%" echo aWYgKFRlc3QtUGF0aCAkaWNvbikgeyAkbGluay5JY29uTG9jYXRpb24gPSAiJGljb24sMCIgfQ0K
>> "%B64%" echo ICAkbGluay5TYXZlKCkNCn0NCg0KJGRlc2t0b3AgPSBbRW52aXJvbm1lbnRdOjpHZXRGb2xkZXJQ
>> "%B64%" echo YXRoKCdEZXNrdG9wJykNCiRzdGFydE1lbnUgPSBbRW52aXJvbm1lbnRdOjpHZXRGb2xkZXJQYXRo
>> "%B64%" echo KCdQcm9ncmFtcycpDQoNCk5ldy1EdWthbkxpbmsgKEpvaW4tUGF0aCAkZGVza3RvcCAn4KSm4KWB
>> "%B64%" echo 4KSV4KS+4KSoIFBPUy5sbmsnKQ0KTmV3LUR1a2FuTGluayAoSm9pbi1QYXRoICRzdGFydE1lbnUg
>> "%B64%" echo J+CkpuClgeCkleCkvuCkqCBQT1MubG5rJykNCg0KIyDgpKrgpYHgpLDgpL7gpKjgpYcgc2V0dXAg
>> "%B64%" echo 4KSo4KWHIOCkleCkreClgCDgpIXgpILgpJfgpY3gpLDgpYfgpJzgpLzgpYAg4KSo4KS+4KSuIOCk
>> "%B64%" echo uOClhyDgpLbgpYngpLDgpY3gpJ/gpJXgpJ8g4KSs4KSo4KS+4KSv4KS+IOCkueCliyDgpKTgpYsg
>> "%B64%" echo 4KS14KWLIOCkueCkn+CkviDgpKbgpYssDQojIOCkteCksOCkqOCkviDgpKHgpYfgpLjgpY3gpJXg
>> "%B64%" echo pJ/gpYngpKog4KSq4KSwIOCkpuCliy3gpKbgpYsg4KS24KWJ4KSw4KWN4KSf4KSV4KSfIOCkquCk
>> "%B64%" echo oeCkvOClhyDgpLDgpLngpYfgpILgpJfgpYcNCmZvcmVhY2ggKCRvbGQgaW4gQCgnRHVrYW4gUE9T
>> "%B64%" echo LmxuaycsICdEdWthblBPUy5sbmsnKSkgew0KICAkcCA9IEpvaW4tUGF0aCAkZGVza3RvcCAkb2xk
>> "%B64%" echo DQogIGlmIChUZXN0LVBhdGggJHApIHsgUmVtb3ZlLUl0ZW0gJHAgLUZvcmNlIC1FcnJvckFjdGlv
>> "%B64%" echo biBTaWxlbnRseUNvbnRpbnVlIH0NCn0NCg0KV3JpdGUtT3V0cHV0ICdzaG9ydGN1dC1vaycNCg==
certutil -f -decode "%B64%" "%PS1%" >nul 2>&1
if errorlevel 1 (
  echo   [ध्यान दें] शॉर्टकट नहीं बन पाया. app फिर भी यहाँ से खुलेगा:
  echo   %TARGET%\Dukan POS.exe
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" "%TARGET%" >nul
  if errorlevel 1 (
    echo   [ध्यान दें] शॉर्टकट नहीं बन पाया. app फिर भी यहाँ से खुलेगा:
    echo   %TARGET%\Dukan POS.exe
  )
)
del "%B64%" "%PS1%" 2>nul

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
