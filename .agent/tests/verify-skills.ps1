$AgentDir = "$PSScriptRoot/.."
$RootDir = "$AgentDir/.."

$RequiredFiles = @(
  "$AgentDir/AGENTS.md",
  "$AgentDir/INSTALL.md",
  "$AgentDir/workflows/brainstorm.md",
  "$AgentDir/workflows/write-plan.md"
)

$RequiredSkills = @(
  "brainstorming", "executing-plans", "finishing-a-development-branch",
  "receiving-code-review", "requesting-code-review", "systematic-debugging",
  "test-driven-development", "using-git-worktrees", "using-superpowers",
  "verification-before-completion", "writing-plans", "writing-skills",
  "single-flow-task-execution"
)

$Pass = 0
$Fail = 0

function Test-File($Path) {
  if (Test-Path $Path) {
    Write-Host "  [PASS] File exists: $Path" -ForegroundColor Green
    $script:Pass++
  } else {
    Write-Host "  [FAIL] Missing file: $Path" -ForegroundColor Red
    $script:Fail++
  }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Antigravity Profile Checks (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking core files..." -ForegroundColor Cyan
foreach ($File in $RequiredFiles) { Test-File $File }

Write-Host "`nChecking skills..." -ForegroundColor Cyan
foreach ($Skill in $RequiredSkills) {
  Test-File "$AgentDir/skills/$Skill/SKILL.md"
}

Write-Host "`nChecking frontmatter..." -ForegroundColor Cyan
foreach ($Skill in $RequiredSkills) {
  $Path = "$AgentDir/skills/$Skill/SKILL.md"
  if (Test-Path $Path) {
    $Content = Get-Content $Path -Raw
    if ($Content -match '(?s)^---.*?name:.*?description:.*?---') {
      Write-Host "  [PASS] $Skill has frontmatter" -ForegroundColor Green
      $script:Pass++
    } else {
      Write-Host "  [FAIL] $Skill missing frontmatter" -ForegroundColor Red
      $script:Fail++
    }
  }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Passed: $Pass" -ForegroundColor Green
Write-Host "  Failed: $Fail" -ForegroundColor Red
Write-Host ""

if ($Fail -gt 0) {
  Write-Host "STATUS: FAILED" -ForegroundColor Red
  exit 1
} else {
  Write-Host "STATUS: PASSED" -ForegroundColor Green
  exit 0
}
