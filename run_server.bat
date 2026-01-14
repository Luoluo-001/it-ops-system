@echo off
chcp 65001 >nul
title IT运维系统服务器
color 0A
echo.
echo ========================================
echo    IT运维系统正在启动...
echo ========================================
echo.
cd /d "c:\Users\yunding\Desktop\coding\it-ops-system"
py -m flask --app app run --host=0.0.0.0 --port=5001 --debug

pause
