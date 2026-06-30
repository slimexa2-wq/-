param(
  [int]$Port = 3000,
  [switch]$SkipDesktop
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Upstream = Join-Path $Root '.upstream\Mineradio'
$Runner = Join-Path $PSScriptRoot 'windows-backend-runner.cjs'

function Assert-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "缺少 $Name。$Hint"
  }
}

Assert-Command 'git' '请先安装 Git for Windows。'
Assert-Command 'node' '请先安装 Node.js 22 或更高版本。'
Assert-Command 'npm' 'Node.js 安装完成后应自带 npm。'

if (-not (Test-Path (Join-Path $Upstream '.git'))) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Upstream) | Out-Null
  git clone --depth 1 https://github.com/XxHuberrr/Mineradio.git $Upstream
} else {
  git -C $Upstream fetch --depth 1 origin main
  git -C $Upstream reset --hard origin/main
}

Push-Location $Upstream
try {
  Write-Host '正在安装或校验 Mineradio 依赖……' -ForegroundColor Cyan
  npm install
} finally {
  Pop-Location
}

$Addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.InterfaceOperationalStatus -eq 'Up'
  } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host ''
Write-Host '=============================================' -ForegroundColor DarkCyan
Write-Host ' Mineradio iPad Windows 伴侣端已经准备完成' -ForegroundColor Green
Write-Host '=============================================' -ForegroundColor DarkCyan
if ($Addresses) {
  foreach ($Address in $Addresses) {
    Write-Host ("iPad 后端地址：http://{0}:{1}" -f $Address, $Port) -ForegroundColor Yellow
  }
} else {
  Write-Host ("未自动识别局域网 IP，请运行 ipconfig 后填写：http://电脑IP:{0}" -f $Port) -ForegroundColor Yellow
}
Write-Host '请保证 Windows 与 iPad 连接同一个 Wi-Fi。' -ForegroundColor Gray
Write-Host '第一次弹出 Windows 防火墙提示时，允许“专用网络”访问。' -ForegroundColor Gray
Write-Host ''

$BackendArgs = @('"' + $Runner + '"', '"' + $Upstream + '"', $Port)
Start-Process -FilePath 'node' -ArgumentList $BackendArgs -WorkingDirectory $Root

if (-not $SkipDesktop) {
  Write-Host '正在打开原版 Mineradio。网易云或 QQ 音乐登录后，iPad 端会自动读取同一账号会话。' -ForegroundColor Cyan
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('start') -WorkingDirectory $Upstream
}

Write-Host '伴侣端将在独立窗口运行。关闭该窗口后，iPad 的在线歌单与音源将停止工作。' -ForegroundColor Gray
