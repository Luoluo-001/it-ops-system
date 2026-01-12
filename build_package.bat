@echo off
chcp 65001 >nul
echo ========================================
echo   IT运维管理系统 - 打包脚本
echo ========================================
echo.

set PACKAGE_NAME=it-ops-system-v1.0

echo 正在创建发布包...
echo.

REM 删除旧的打包目录
if exist "%PACKAGE_NAME%" rd /s /q "%PACKAGE_NAME%"
if exist "%PACKAGE_NAME%.zip" del /f /q "%PACKAGE_NAME%.zip"

REM 创建打包目录
mkdir "%PACKAGE_NAME%"

REM 复制文件
echo 复制核心文件...
copy app.py "%PACKAGE_NAME%\" >nul
copy requirements.txt "%PACKAGE_NAME%\" >nul
copy README.md "%PACKAGE_NAME%\" >nul
copy start.bat "%PACKAGE_NAME%\" >nul
copy start.sh "%PACKAGE_NAME%\" >nul
copy stop.sh "%PACKAGE_NAME%\" >nul
copy install.sh "%PACKAGE_NAME%\" >nul

REM 复制静态文件
echo 复制静态文件...
xcopy static "%PACKAGE_NAME%\static" /E /I /Q >nul

REM 创建空目录
mkdir "%PACKAGE_NAME%\uploads" >nul
mkdir "%PACKAGE_NAME%\instance" >nul

REM 创建说明文件
echo 数据库文件将在首次运行时自动创建 > "%PACKAGE_NAME%\instance\README.txt"
echo 上传的文件将存储在此目录 > "%PACKAGE_NAME%\uploads\README.txt"

REM 打包为zip
echo 压缩打包...
powershell -command "Compress-Archive -Path '%PACKAGE_NAME%' -DestinationPath '%PACKAGE_NAME%.zip' -Force"

if exist "%PACKAGE_NAME%.zip" (
    echo.
    echo ========================================
    echo   打包完成！
    echo ========================================
    echo.
    echo 发布包: %PACKAGE_NAME%.zip
    echo 大小: 
    dir "%PACKAGE_NAME%.zip" | findstr ".zip"
    echo.
    echo 删除临时文件...
    rd /s /q "%PACKAGE_NAME%"
    echo.
    echo 完成！可以将 %PACKAGE_NAME%.zip 传输到Linux服务器。
) else (
    echo.
    echo 错误: 打包失败！
)

echo.
pause
