@echo off
chcp 65001 >nul

echo ==========================================
echo    音频云存储升级 - 推送脚本
echo ==========================================
echo.

cd /d "C:\Users\Jerry\Downloads\High_School_Lisenting_LAB_Pro"
if %errorlevel% neq 0 (
    echo ❌ 无法进入项目目录
    pause
    exit /b 1
)

echo ✅ 已进入项目目录
echo.

echo 📋 检查 Git 状态...
git status
if %errorlevel% neq 0 (
    echo ❌ Git 命令执行失败
    pause
    exit /b 1
)
echo.

echo 📥 执行 git add .
git add .
if %errorlevel% equ 0 (
    echo ✅ 文件已添加到暂存区
) else (
    echo ❌ git add 失败
    pause
    exit /b 1
)
echo.

echo 📝 执行 git commit...
git commit -m "feat: 音频云存储升级 - 支持跨设备同步"
if %errorlevel% equ 0 (
    echo ✅ 提交成功
) else (
    echo ⚠️ git commit 失败（可能没有新更改）
)
echo.

echo 🚀 执行 git push origin master...
git push origin master
if %errorlevel% equ 0 (
    echo.
    echo 🎉 推送成功！
    echo ==========================================
    echo    Vercel 将自动部署新版本
    echo ==========================================
) else (
    echo ❌ git push 失败
    echo 💡 可能需要先执行: git pull origin master
    pause
    exit /b 1
)

echo.
echo ✅ 所有操作完成！
pause