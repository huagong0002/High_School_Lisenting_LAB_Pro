<#
.SYNOPSIS
清理Git历史中的敏感信息并强制推送到GitHub

.DESCRIPTION
此脚本会：
1. 使用git filter-branch移除历史提交中的敏感文件
2. 清理Git垃圾引用
3. 重新添加清理后的文件
4. 强制推送到GitHub
#>

# 配置变量
$repoUrl = "git@github.com:huagong0002/High_School_Lisenting_LAB_Pro.git"
$sensitiveFiles = @("push-to-github.ps1")
$commitMessage = "fix: remove sensitive information from history"

# 颜色定义
$cyan = "Cyan"
$green = "Green"
$red = "Red"
$gray = "Gray"

function Write-Status {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host "`n$Message" -ForegroundColor $Color
}

try {
    Write-Status "=== 开始清理敏感信息并推送 ===" $cyan

    # 1. 检查Git状态
    Write-Status "步骤1: 检查当前Git状态..." $cyan
    $status = git status
    if ($LASTEXITCODE -ne 0) {
        throw "Git状态检查失败"
    }
    Write-Host $status -ForegroundColor $gray

    # 2. 切换到SSH协议
    Write-Status "步骤2: 配置远程仓库URL..." $cyan
    git remote set-url origin $repoUrl
    if ($LASTEXITCODE -ne 0) {
        throw "设置远程仓库URL失败"
    }
    git remote -v
    Write-Host "远程仓库URL已更新" -ForegroundColor $green

    # 3. 使用filter-branch移除敏感文件
    Write-Status "步骤3: 清理历史提交中的敏感文件..." $cyan
    foreach ($file in $sensitiveFiles) {
        Write-Host "正在移除: $file" -ForegroundColor $gray
        git filter-branch --force --index-filter "git rm --cached --ignore-unmatch $file" --prune-empty -- --all
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "清理文件 $file 时可能出现警告，但继续执行..."
        }
    }

    # 4. 清理垃圾引用
    Write-Status "步骤4: 清理Git垃圾引用..." $cyan
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    Write-Host "垃圾引用清理完成" -ForegroundColor $green

    # 5. 重新添加清理后的文件
    Write-Status "步骤5: 重新添加文件..." $cyan
    foreach ($file in $sensitiveFiles) {
        if (Test-Path $file) {
            git add $file
            Write-Host "已添加: $file" -ForegroundColor $gray
        } else {
            Write-Warning "文件不存在: $file"
        }
    }

    # 6. 提交更改
    Write-Status "步骤6: 提交更改..." $cyan
    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "没有需要提交的更改或提交失败，继续执行..." -ForegroundColor $gray
    }

    # 7. 强制推送
    Write-Status "步骤7: 强制推送到GitHub..." $cyan
    git push -f origin master
    if ($LASTEXITCODE -eq 0) {
        Write-Status "=== 推送成功！ ===" $green
        Write-Host "仓库地址: $repoUrl" -ForegroundColor $green
    } else {
        throw "推送失败"
    }
}
catch {
    Write-Status "错误: $_" $red
    exit 1
}
