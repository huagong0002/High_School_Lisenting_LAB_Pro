# 音频云存储升级推送脚本
# 执行 git add, commit, push 命令

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   音频云存储升级 - 推送脚本" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 设置项目路径
$projectPath = "C:\Users\Jerry\Downloads\High_School_Lisenting_LAB_Pro"

# 切换到项目目录
try {
    Set-Location $projectPath -ErrorAction Stop
    Write-Host "✅ 已进入项目目录: $projectPath" -ForegroundColor Green
} catch {
    Write-Host "❌ 无法进入项目目录: $_" -ForegroundColor Red
    exit 1
}

# 检查Git状态
try {
    Write-Host "`n📋 检查 Git 状态..." -ForegroundColor Yellow
    git status
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git 命令执行失败" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 检查状态时出错: $_" -ForegroundColor Red
    exit 1
}

# 执行 git add .
try {
    Write-Host "`n📥 执行 git add ." -ForegroundColor Yellow
    git add .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 文件已添加到暂存区" -ForegroundColor Green
    } else {
        Write-Host "❌ git add 失败" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 添加文件时出错: $_" -ForegroundColor Red
    exit 1
}

# 执行 git commit
try {
    Write-Host "`n📝 执行 git commit..." -ForegroundColor Yellow
    git commit -m "feat: 音频云存储升级 - 支持跨设备同步"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 提交成功" -ForegroundColor Green
    } else {
        Write-Host "❌ git commit 失败（可能没有新更改）" -ForegroundColor Yellow
        # 如果没有新更改，仍然尝试推送
    }
} catch {
    Write-Host "❌ 提交时出错: $_" -ForegroundColor Red
    exit 1
}

# 执行 git push
try {
    Write-Host "`n🚀 执行 git push origin master..." -ForegroundColor Yellow
    git push origin master
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n🎉 推送成功！" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "   Vercel 将自动部署新版本" -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor Cyan
    } else {
        Write-Host "❌ git push 失败" -ForegroundColor Red
        Write-Host "💡 可能需要先执行: git pull origin master" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ 推送时出错: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ 所有操作完成！" -ForegroundColor Green
