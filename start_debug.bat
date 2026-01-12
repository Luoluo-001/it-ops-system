@echo off
echo ========================================
echo 正在启动IT运维系统...
echo ========================================
cd /d "c:\Users\yunding\Desktop\coding\it-ops-system"
echo 当前目录: %CD%
echo.
echo 检查Python版本:
py --version
echo.
echo 开始运行程序...
echo ========================================
py test_run.py
pause
