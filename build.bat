@echo off
chcp 65001 >nul 2>&1
title Gemini 提问导航插件 - 打包

set "SRC=%~dp0"
set "OUT=%USERPROFILE%\Desktop\Gemini-Question-Navigator.zip"

echo.
echo  正在打包插件...

if exist "%OUT%" del /q "%OUT%"

powershell -NoProfile -Command ^
  "Compress-Archive -Path '%SRC%manifest.json','%SRC%install.bat','%SRC%README.md','%SRC%icons','%SRC%src' -DestinationPath '%OUT%' -Force"

if exist "%OUT%" (
    echo.
    echo  打包成功！文件位于：
    echo  %OUT%
    echo.
    echo  把这个 .zip 发给别人，对方解压后双击 install.bat 即可安装。
) else (
    echo.
    echo  打包失败，请检查文件是否完整。
)

echo.
pause
