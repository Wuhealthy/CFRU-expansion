# 从 Windows 凭据管理器读取 GitHub Desktop 的 token，用于 push + 开启 Pages
$ErrorActionPreference = "Continue"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CredMan {
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr credPtr);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
  public static string ReadPass(string target) {
    IntPtr p;
    if (!CredRead(target, 1, 0, out p)) return null;
    int blobSize = Marshal.ReadInt32(p, 32);
    IntPtr blobPtr = Marshal.ReadIntPtr(p, 40);
    byte[] blob = new byte[blobSize];
    Marshal.Copy(blobPtr, blob, 0, blobSize);
    CredFree(p);
    return System.Text.Encoding.UTF8.GetString(blob);
  }
}
'@

$token = [CredMan]::ReadPass("GitHub - https://api.github.com/Wuhealthy")
if (-not $token) { Write-Output "NO_TOKEN"; exit 1 }
Write-Output ("token ok (len " + $token.Length + ", prefix " + $token.Substring(0,4) + ")")

$workspace = "C:\Users\Administrator\Documents\GitHub\CFRU-expansion"
$siteSrc = Join-Path $workspace "pokedex_site"
$deploy = Join-Path $env:TEMP "cfru-pokedex-deploy"
$remote = "https://Wuhealthy:$token@github.com/Wuhealthy/CFRU-expansion.git"

# 临时克隆不存在则重建 gh-pages 工作树 (只含站点文件, 不触碰主工作区)
if (-not (Test-Path (Join-Path $deploy ".git"))) {
  Write-Output "重建部署克隆…"
  if (Test-Path $deploy) { Remove-Item -Recurse -Force $deploy }
  cmd /c "git clone --quiet `"$workspace`" `"$deploy`""
  cmd /c "git -C `"$deploy`" checkout --quiet --orphan gh-pages"
  cmd /c "git -C `"$deploy`" rm -rq --cached . 2>nul"
  Get-ChildItem $deploy -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  Copy-Item (Join-Path $siteSrc "index.html"), (Join-Path $siteSrc "style.css"), (Join-Path $siteSrc "app.js"), (Join-Path $siteSrc "data"), (Join-Path $siteSrc "sprites"), (Join-Path $siteSrc "README.md") $deploy -Recurse -Force
  New-Item -ItemType File (Join-Path $deploy ".nojekyll") -Force | Out-Null
  cmd /c "git -C `"$deploy`" add -A"
  cmd /c "git -C `"$deploy`" commit -qm ""横版物语图鉴站点更新 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"""
  Write-Output "克隆已重建并提交"
} else {
  # 已有克隆: 同步最新站点文件
  Copy-Item (Join-Path $siteSrc "index.html"), (Join-Path $siteSrc "style.css"), (Join-Path $siteSrc "app.js") $deploy -Force
  Copy-Item (Join-Path $siteSrc "data\*") (Join-Path $deploy "data") -Recurse -Force
  Copy-Item (Join-Path $siteSrc "sprites\*") (Join-Path $deploy "sprites") -Recurse -Force
  cmd /c "git -C `"$deploy`" add -A"
  $hasChanges = cmd /c "git -C `"$deploy`" status --porcelain"
  if ($hasChanges) {
    cmd /c "git -C `"$deploy`" commit -qm ""横版物语图鉴站点更新 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"""
    Write-Output "检测到站点更新, 已提交"
  } else { Write-Output "站点无变化" }
}

# push 带重试 (github.com 连接间歇被重置)
$pushed = $false
for ($i = 1; $i -le 8; $i++) {
  Write-Output "== push 尝试 $i =="
  $out = cmd /c "git -C `"$deploy`" push $remote gh-pages 2>&1"
  if ($LASTEXITCODE -eq 0) { Write-Output "PUSH_OK"; $pushed = $true; break }
  Write-Output (($out -join " ").Trim().Substring(0, [Math]::Min(160, ($out -join " ").Trim().Length)))
  Start-Sleep -Seconds 4
}
if (-not $pushed) { Write-Output "PUSH_FAILED"; exit 1 }

# 开启 Pages (gh-pages 分支 / 根目录)
$headers = @{ Authorization = "token $token"; Accept = "application/vnd.github+json" }
$body = '{"source":{"branch":"gh-pages","path":"/"}}'
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/Wuhealthy/CFRU-expansion/pages" -Headers $headers -Body $body -ContentType "application/json"
  Write-Output ("PAGES_ENABLED: " + $r.html_url)
} catch {
  $msg = $_.ErrorDetails.Message
  if ($msg -match "already exists") { Write-Output "PAGES_ALREADY_ENABLED" }
  else { Write-Output ("PAGES_API_ERR: " + $msg) }
}
