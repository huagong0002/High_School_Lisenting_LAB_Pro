$repoUrl = "https://github.com/huagong0002/High_School_Lisenting_LAB_Pro.git"
$username = "huagong0002"

Write-Host "Configuring Git repository..." -ForegroundColor Cyan

git remote remove origin
Write-Host "Removed existing origin" -ForegroundColor Gray

git remote add origin $repoUrl
Write-Host "Added new origin: $repoUrl" -ForegroundColor Gray

Write-Host ""
Write-Host "Configuring credential helper..." -ForegroundColor Cyan
git config credential.helper manager
Write-Host "Configured credential helper" -ForegroundColor Gray

Write-Host ""
Write-Host "Pushing code to GitHub..." -ForegroundColor Cyan
git push -u origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! Project pushed to GitHub" -ForegroundColor Green
    Write-Host "Repository: $repoUrl" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "FAILED! Check network or credentials" -ForegroundColor Red
}