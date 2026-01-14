@echo off
chcp 65001 >nul
echo ========================================
echo 正在重启IT运维系统...
echo ========================================
echo.

echo [1/4] 停止现有Python进程...
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] 删除旧数据库...
del /F /Q "c:\Users\yunding\Desktop\coding\it-ops-system\instance\it_ops.db" 2>nul
if exist "c:\Users\yunding\Desktop\coding\it-ops-system\instance\it_ops.db" (
    echo 警告: 数据库文件仍在使用中，请手动删除后重试
    pause
    exit
)

echo [3/4] 等待释放资源...
timeout /t 2 /nobreak >nul

echo [4/4] 启动系统...
cd /d "c:\Users\yunding\Desktop\coding\it-ops-system"
echo.
echo ========================================
echo 系统启动中...
echo 访问地址: http://localhost:5001

echo 用户名: admin
echo 密码: Flzx3qc@2024
echo ========================================
echo.
py app.py
pause
