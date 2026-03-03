@echo off
chcp 65001 >nul 2>&1
title Gemini 提问导航插件 - 安装助手

echo.
echo  ============================================
echo    Gemini 提问导航插件 - 安装助手
echo  ============================================
echo.
echo  [1] Edge 浏览器（推荐）
echo  [2] Chrome 浏览器
echo.
set /p choice="  请输入选择 (1 或 2): "

set "EXT_PATH=%~dp0"

if "%choice%"=="1" (
    echo.
    echo  正在打开 Edge 扩展页面...
    start msedge "edge://extensions/"
) else if "%choice%"=="2" (
    echo.
    echo  正在打开 Chrome 扩展页面...
    start chrome "chrome://extensions/"
) else (
    echo.
    echo  无效选择，默认打开 Edge...
    start msedge "edge://extensions/"
)

echo.
echo  ============================================
echo   请在浏览器中完成以下两步：
echo  ============================================
echo.
echo   1. 打开右上角「开发人员模式」开关
echo.
echo   2. 点击「加载解压缩的扩展」，选择此目录：
echo      %EXT_PATH%
echo.
echo   完成后打开 gemini.google.com 即可使用！
echo.
echo   快捷键：Ctrl+Shift+Q 切换侧栏
echo  ============================================
echo.
pause
