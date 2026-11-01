# 查询 Pages 配置与最近构建状态
$ErrorActionPreference = "Continue"
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CredMan2 {
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
$token = [CredMan2]::ReadPass("GitHub - https://api.github.com/Wuhealthy")
$headers = @{ Authorization = "token $token"; Accept = "application/vnd.github+json" }

$pages = Invoke-RestMethod -Uri "https://api.github.com/repos/Wuhealthy/CFRU-expansion/pages" -Headers $headers
Write-Output ("source: " + $pages.source.branch + " / " + $pages.source.path)
Write-Output ("url: " + $pages.html_url)
Write-Output ("status: " + $pages.status)

try {
  $b = Invoke-RestMethod -Uri "https://api.github.com/repos/Wuhealthy/CFRU-expansion/pages/builds/latest" -Headers $headers
  Write-Output ("build: " + $b.status + " @ " + $b.created_at)
} catch { Write-Output ("build query err: " + $_.Exception.Message) }
