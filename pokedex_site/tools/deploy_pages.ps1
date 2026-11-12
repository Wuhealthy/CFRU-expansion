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
Write-Output "GitHub token found in Windows Credential Manager"

# 站点目录 = 本脚本所在 tools/ 的上级, 换机器/换路径无需修改
$siteSrc = Split-Path -Parent $PSScriptRoot
$deploy = Join-Path $env:TEMP "cfru-pokedex-deploy"
$remote = "https://Wuhealthy:$token@github.com/Wuhealthy/CFRU-expansion.git"
# 用 $env:ComSpec 调 cmd.exe: PATH 里 devkitPro msys2 的 cmd 脚本排在 system32 前, 直接写 cmd 会解析错

# 部署仓库 (只含站点文件, 不触碰主工作区): 每次先对齐远端 gh-pages 最新提交再同步,
# 保证 push 可快进 (多台机器交替部署也不会被拒)
if (-not (Test-Path (Join-Path $deploy ".git"))) {
  Write-Output "初始化部署仓库…"
  if (Test-Path $deploy) { Remove-Item -Recurse -Force $deploy }
  New-Item -ItemType Directory $deploy | Out-Null
  & $env:ComSpec /c "git -C `"$deploy`" init -q"
}
$fetched = $false; $noBranch = $false
for ($i = 1; $i -le 8; $i++) {
  & $env:ComSpec /c "git -C `"$deploy`" fetch -q $remote gh-pages 2>&1" | Out-Null
  if ($LASTEXITCODE -eq 0) { $fetched = $true; break }
  & $env:ComSpec /c "git ls-remote --exit-code $remote gh-pages 2>&1" | Out-Null
  if ($LASTEXITCODE -eq 2) { $noBranch = $true; break }  # 连接正常但远端无 gh-pages: 首次部署
  Write-Output "== fetch 失败, 重试 $i =="
  Start-Sleep -Seconds 4
}
if ($fetched) { & $env:ComSpec /c "git -C `"$deploy`" checkout -q -f -B gh-pages FETCH_HEAD" }
elseif ($noBranch) { & $env:ComSpec /c "git -C `"$deploy`" checkout -q --orphan gh-pages" }
else { Write-Output "FETCH_FAILED"; exit 1 }

# 镜像同步站点文件 (先清空工作树, 站点中已删除的文件不会残留)
Get-ChildItem $deploy -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
Copy-Item (Join-Path $siteSrc "index.html"), (Join-Path $siteSrc "style.css"), (Join-Path $siteSrc "app.js"), (Join-Path $siteSrc "pwa.js"), (Join-Path $siteSrc "sw.js"), (Join-Path $siteSrc "manifest.webmanifest"), (Join-Path $siteSrc "icons"), (Join-Path $siteSrc "data"), (Join-Path $siteSrc "sprites"), (Join-Path $siteSrc "assets"), (Join-Path $siteSrc "README.md") $deploy -Recurse -Force
New-Item -ItemType File (Join-Path $deploy ".nojekyll") -Force | Out-Null
# Give every content update its own cache so the old app stays intact during installation.
$cacheInputs = "index.html", "style.css", "app.js", "pwa.js", "sw.js", "manifest.webmanifest", "data/data.js", "icons/icon-192.png", "icons/icon-512.png"
$cacheSeed = ($cacheInputs | ForEach-Object { (Get-FileHash (Join-Path $siteSrc $_) -Algorithm SHA1).Hash }) -join ""
$spriteHashes = Get-ChildItem (Join-Path $siteSrc "sprites") -File -Recurse | Sort-Object FullName | ForEach-Object { (Get-FileHash $_.FullName -Algorithm SHA1).Hash }
$cacheSeed += ($spriteHashes -join "")
$cacheVersion = ([System.Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($cacheSeed)) |
  ForEach-Object { $_.ToString("x2") }) -join ""
# Content-version every asset; changing the worker URL forces mobile browsers to check for its update.
$indexPath = Join-Path $deploy "index.html"
$html = [IO.File]::ReadAllText($indexPath)
foreach ($f in "style.css", "app.js", "data/data.js") {
  $v = (Get-FileHash (Join-Path $siteSrc $f) -Algorithm SHA1).Hash.Substring(0, 8).ToLower()
  $pattern = "(?<=[`"'])$([regex]::Escape($f))(\?v=[^`"']*)?(?=[`"'])"
  $html = [regex]::Replace($html, $pattern, "${f}?v=$v")
}
$pattern = "(?<=[`"'])pwa\.js(\?v=[^`"']*)?(?=[`"'])"
$html = [regex]::Replace($html, $pattern, "pwa.js?v=$($cacheVersion.Substring(0, 12))")
[IO.File]::WriteAllText($indexPath, $html, (New-Object Text.UTF8Encoding($false)))
$swPath = Join-Path $deploy "sw.js"
$sw = [IO.File]::ReadAllText($swPath).Replace("__BUILD_VERSION__", $cacheVersion.Substring(0, 12))
[IO.File]::WriteAllText($swPath, $sw, (New-Object Text.UTF8Encoding($false)))
& $env:ComSpec /c "git -C `"$deploy`" add -A"
$hasChanges = & $env:ComSpec /c "git -C `"$deploy`" status --porcelain"
if ($hasChanges) {
  & $env:ComSpec /c "git -C `"$deploy`" commit -qm ""火红物语图鉴站点更新 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"""
  Write-Output "检测到站点更新, 已提交"
} else { Write-Output "站点无变化" }

# push 带重试 (github.com 连接间歇被重置)
$pushed = $false
for ($i = 1; $i -le 8; $i++) {
  Write-Output "== push 尝试 $i =="
  $out = & $env:ComSpec /c "git -C `"$deploy`" push $remote gh-pages 2>&1"
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
  if ($msg -match "already (exists|enabled)") { Write-Output "PAGES_ALREADY_ENABLED" }
  else { Write-Output ("PAGES_API_ERR: " + $msg) }
}
