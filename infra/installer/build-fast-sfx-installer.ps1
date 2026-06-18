#Requires -Version 5.1
<#
.SYNOPSIS
  Build a fast one-file installer: uncompressed payload + self-extracting launcher.

  Faster than NSIS on client PCs (parallel robocopy, no heavy decompression).
#>
param(
  [string]$UnpackedDir = '',
  [string]$OutputExe = '',
  [string]$Version = '0.1.0',
  [switch]$SignStub
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$clientDir = Join-Path $repoRoot 'apps\client'
$vendorDir = Join-Path $PSScriptRoot 'vendor'

if (-not $UnpackedDir) {
  $UnpackedDir = Join-Path $clientDir 'release\win-unpacked'
}
if (-not $OutputExe) {
  $OutputExe = Join-Path $clientDir "release\GMS-SVN-CLIENT-Setup-$Version.exe"
}
if (-not (Test-Path (Join-Path $UnpackedDir 'GMS SVN CLIENT.exe'))) {
  throw "Unpacked app not found. Run electron-builder --dir first: $UnpackedDir"
}

function Get-7zaPath {
  $p = Join-Path $repoRoot 'node_modules\7zip-bin\win\x64\7za.exe'
  if (-not (Test-Path $p)) { throw "7za not found: $p" }
  return $p
}

function Get-7zSfxPath {
  $cached = Join-Path $vendorDir '7z.sfx'
  if (Test-Path $cached) { return $cached }

  foreach ($p in @(
    "${env:ProgramFiles}\7-Zip\7z.sfx",
    "${env:ProgramFiles(x86)}\7-Zip\7z.sfx"
  )) {
    if (Test-Path $p) {
      New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
      Copy-Item $p $cached -Force
      return $cached
    }
  }

  $extraUrls = @(
    'https://www.7-zip.org/a/7z2301-extra.7z',
    'https://www.7-zip.org/a/7z2601-extra.7z'
  )
  New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
  $extra7z = Join-Path $vendorDir '7z-extra.7z'
  $seven = Get-7zaPath
  $downloaded = $false
  foreach ($url in $extraUrls) {
    try {
      Write-Host "Downloading 7-Zip SFX module from $url ..."
      Invoke-WebRequest -Uri $url -OutFile $extra7z -UseBasicParsing
      $downloaded = $true
      break
    } catch {
      Write-Host "Download failed: $url"
    }
  }
  if (-not $downloaded) { return $null }

  $extractDir = Join-Path $vendorDir 'extra'
  if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
  & $seven x $extra7z "-o$extractDir" -y | Out-Null
  $found = Get-ChildItem $extractDir -Recurse -Filter '7z.sfx' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $found) { return $null }
  Copy-Item $found.FullName $cached -Force
  return $cached
}

function New-FastZipPayload {
  param([string]$StagingDir, [string]$ZipPath)
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $StagingDir,
    $ZipPath,
    [System.IO.Compression.CompressionLevel]::NoCompression,
    $false
  )
}

function New-SelfExtractingExe {
  param(
    [string]$ZipPath,
    [string]$OutPath,
    [switch]$SignStub
  )
  $launcherCs = @'
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Principal;
using System.Windows.Forms;

public static class GmsClientSetup {
  const int FooterSize = 8;

  public static int Main() {
    try {
      var self = Assembly.GetExecutingAssembly().Location;
      if (string.IsNullOrEmpty(self)) self = Process.GetCurrentProcess().MainModule.FileName;

      if (!IsAdmin()) {
        Process.Start(new ProcessStartInfo(self) { Verb = "runas", UseShellExecute = true });
        return 0;
      }

      Console.Title = "GMS SVN CLIENT Setup";
      Console.WriteLine("GMS SVN CLIENT Setup");
      Console.WriteLine("======================");
      Console.WriteLine();

      var destDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "GMS SVN CLIENT");
      var tempZip = Path.Combine(Path.GetTempPath(), "gms-client-" + Guid.NewGuid().ToString("N") + ".zip");

      Console.WriteLine("Extracting files...");
      ExtractPayload(self, tempZip);

      var tempExtract = Path.Combine(Path.GetTempPath(), "gms-client-extract-" + Guid.NewGuid().ToString("N"));
      Directory.CreateDirectory(tempExtract);
      try {
        ZipFile.ExtractToDirectory(tempZip, tempExtract);
      } finally {
        try { File.Delete(tempZip); } catch { }
      }

      try { StopClientProcesses(); } catch { }

      var stagingDir = Path.Combine(Path.GetTempPath(), "gms-client-stage-" + Guid.NewGuid().ToString("N"));
      Directory.CreateDirectory(stagingDir);

      Console.WriteLine("Copying to " + destDir + " ...");
      var stageCode = RunRobocopy(tempExtract, stagingDir, "/E /IS /IT /R:3 /W:1");
      if (stageCode >= 8) {
        Fail("Failed to stage installer files (robocopy " + stageCode + ").");
        return 1;
      }

      if (Directory.Exists(destDir)) {
        Console.WriteLine("Updating existing install...");
        UnregisterShellExtension(destDir);
        StopClientProcesses();
        RestartExplorer();
      } else {
        Directory.CreateDirectory(destDir);
      }

      var copyCode = RunRobocopy(stagingDir, destDir, "/E /IS /IT /PURGE /ZB /R:5 /W:2");
      if (copyCode >= 8) {
        Console.WriteLine("Direct update blocked (code " + copyCode + "). Refreshing Explorer and retrying...");
        RestartExplorer();
        copyCode = RunRobocopy(stagingDir, destDir, "/E /IS /IT /PURGE /ZB /R:5 /W:2");
      }
      if (copyCode >= 8) {
        Console.WriteLine("Direct update still blocked (code " + copyCode + "). Trying fresh folder swap...");
        var backupDir = destDir + ".previous";
        try {
          if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true);
        } catch { }
        try {
          if (Directory.Exists(destDir)) Directory.Move(destDir, backupDir);
        } catch {
          Fail("Could not replace " + destDir + ".\n\nClose GMS SVN CLIENT and File Explorer windows on that folder,\nthen run setup again as Administrator.");
          return 1;
        }
        try {
          Directory.Move(stagingDir, destDir);
          stagingDir = null;
          try { if (Directory.Exists(backupDir)) Directory.Delete(backupDir, true); } catch { }
        } catch (Exception ex) {
          Fail("Install swap failed: " + ex.Message);
          return 1;
        }
      }

      if (stagingDir != null) {
        try { Directory.Delete(stagingDir, true); } catch { }
      }
      try { Directory.Delete(tempExtract, true); } catch { }

      var ps1 = Path.Combine(destDir, "install-client.ps1");
      if (!File.Exists(ps1)) {
        Fail("Install script missing after extract.");
        return 1;
      }

      Console.WriteLine("Installing to " + destDir + " ...");
      var proc = Process.Start(new ProcessStartInfo("powershell.exe",
        "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\" -SkipCopy") {
        UseShellExecute = false
      });
      if (proc == null) {
        Fail("Could not start install script.");
        return 1;
      }
      proc.WaitForExit();
      if (proc.ExitCode != 0) {
        Fail("Install failed. See " + Path.Combine(destDir, "explorer-install.log"));
        return proc.ExitCode;
      }

      Console.WriteLine();
      Console.WriteLine("Install complete.");
      MessageBox.Show("GMS SVN CLIENT installed.\n\nWindows 11: right-click folder -> Show more options -> GMS SVN CLIENT\n\nUse SVN Checkout before Commit on a new folder.\n\nYou can use the app immediately.",
        "GMS SVN CLIENT", MessageBoxButtons.OK, MessageBoxIcon.Information);
      return 0;
    } catch (Exception ex) {
      Fail(ex.Message);
      return 1;
    }
  }

  static void Fail(string message) {
    Console.WriteLine("ERROR: " + message);
    MessageBox.Show(message, "GMS SVN CLIENT Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
  }

  static void StopClientProcesses() {
    foreach (var img in new[] { "GMS SVN CLIENT.exe", "GmsSvn.ShellBridge.exe" }) {
      try {
        var p = Process.Start(new ProcessStartInfo("taskkill", "/F /IM \"" + img + "\"") {
          CreateNoWindow = true,
          UseShellExecute = false
        });
        if (p != null) p.WaitForExit(5000);
      } catch { }
    }
  }

  static void RestartExplorer() {
    try {
      Console.WriteLine("Refreshing File Explorer...");
      var p = Process.Start(new ProcessStartInfo("taskkill", "/F /IM explorer.exe") {
        CreateNoWindow = true,
        UseShellExecute = false
      });
      if (p != null) p.WaitForExit(5000);
      System.Threading.Thread.Sleep(2000);
      Process.Start("explorer.exe");
      System.Threading.Thread.Sleep(2000);
    } catch { }
  }

  static void UnregisterShellExtension(string installDir) {
    var ps1 = Path.Combine(installDir, "register-shell.ps1");
    if (!File.Exists(ps1)) return;
    try {
      var p = Process.Start(new ProcessStartInfo("powershell.exe",
        "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\" -InstallDir \"" + installDir + "\" -Unregister") {
        UseShellExecute = false,
        CreateNoWindow = true
      });
      if (p != null) p.WaitForExit(60000);
    } catch { }
  }

  static int RunRobocopy(string source, string dest, string flags) {
    var args = "\"" + source + "\" \"" + dest + "\" " + flags + " /NFL /NDL /NJH /NJS /nc /ns /np";
    var p = Process.Start(new ProcessStartInfo("robocopy.exe", args) {
      UseShellExecute = false,
      CreateNoWindow = true
    });
    if (p == null) return 16;
    p.WaitForExit();
    return p.ExitCode;
  }

  static bool IsAdmin() {
    var id = WindowsIdentity.GetCurrent();
    var p = new WindowsPrincipal(id);
    return p.IsInRole(WindowsBuiltInRole.Administrator);
  }

  static void ExtractPayload(string exe, string zipOut) {
    using (var fs = File.OpenRead(exe)) {
      fs.Seek(-FooterSize, SeekOrigin.End);
      var footer = new byte[FooterSize];
      if (fs.Read(footer, 0, FooterSize) != FooterSize) throw new InvalidDataException("Invalid setup file. Re-copy from server or use Install-Setup.bat");
      long zipLen = BitConverter.ToInt64(footer, 0);
      if (zipLen <= 0 || zipLen > fs.Length) throw new InvalidDataException("Setup file is corrupt (signing after build breaks it). Rebuild with npm run pack:client");
      long zipStart = fs.Length - FooterSize - zipLen;
      fs.Seek(zipStart, SeekOrigin.Begin);
      using (var outFs = File.Create(zipOut)) {
        var buf = new byte[1024 * 1024];
        long left = zipLen;
        while (left > 0) {
          int read = fs.Read(buf, 0, (int)Math.Min(buf.Length, left));
          if (read <= 0) break;
          outFs.Write(buf, 0, read);
          left -= read;
        }
      }
    }
  }
}
'@

  $work = Join-Path $clientDir 'release\.launcher-build'
  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $work | Out-Null
  $stubExe = Join-Path $work 'stub.exe'
  Add-Type -TypeDefinition $launcherCs -OutputAssembly $stubExe -OutputType ConsoleApplication -ReferencedAssemblies @(
    'System.IO.Compression',
    'System.IO.Compression.FileSystem',
    'System.Windows.Forms'
  )
  if (-not (Test-Path $stubExe)) {
    throw 'Failed to compile setup launcher. Ensure .NET Framework 4.x is installed.'
  }

  if ($SignStub) {
    & (Join-Path $PSScriptRoot 'sign-client-installer.ps1') -SetupPath $stubExe | Out-Null
  }

  $zipBytes = [IO.File]::ReadAllBytes($ZipPath)
  $stubBytes = [IO.File]::ReadAllBytes($stubExe)
  $footer = [BitConverter]::GetBytes([int64]$zipBytes.Length)
  $all = New-Object byte[] ($stubBytes.Length + $zipBytes.Length + $footer.Length)
  [Array]::Copy($stubBytes, 0, $all, 0, $stubBytes.Length)
  [Array]::Copy($zipBytes, 0, $all, $stubBytes.Length, $zipBytes.Length)
  [Array]::Copy($footer, 0, $all, $stubBytes.Length + $zipBytes.Length, $footer.Length)
  [IO.File]::WriteAllBytes($OutPath, $all)
}

$staging = Join-Path $clientDir 'release\.sfx-staging'
$archive = Join-Path $clientDir 'release\.gms-client-app.7z'
$zipPath = Join-Path $clientDir 'release\.gms-client-app.zip'
$config = Join-Path $clientDir 'release\.sfx-config.txt'

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'install-client.ps1') (Join-Path $staging 'install-client.ps1') -Force
robocopy $UnpackedDir $staging /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Failed to stage app files' }

$sfx = Get-7zSfxPath
if ($sfx) {
  $seven = Get-7zaPath
  if (Test-Path $archive) { Remove-Item $archive -Force }
  Write-Host 'Creating 7-Zip SFX installer (store mode, fast extract)...'
  & $seven a -t7z -mx=0 -mmt=on $archive "$staging\*" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '7za archive failed' }
  @'
;!@Install@!UTF-8!
Title="GMS SVN CLIENT Setup"
BeginPrompt="Install GMS SVN CLIENT on this computer?"
Progress="yes"
GUIMode="1"
ExecuteFile="powershell.exe"
ExecuteParameters="-NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File install-client.ps1"
;!@InstallEnd@!
'@ | Set-Content -Path $config -Encoding UTF8
  if (Test-Path $OutputExe) { Remove-Item $OutputExe -Force }
  cmd /c "copy /b `"$sfx`" + `"$config`" + `"$archive`" `"$OutputExe`"" | Out-Null
  Remove-Item $archive -Force -ErrorAction SilentlyContinue
  Remove-Item $config -Force -ErrorAction SilentlyContinue
} else {
  Write-Host '7z.sfx unavailable - using built-in fast self-extracting launcher.'
  New-FastZipPayload -StagingDir $staging -ZipPath $zipPath
  if (Test-Path $OutputExe) { Remove-Item $OutputExe -Force }
  New-SelfExtractingExe -ZipPath $zipPath -OutPath $OutputExe -SignStub:$SignStub
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
}

Copy-Item (Join-Path $PSScriptRoot 'Install-Setup.bat') (Join-Path (Split-Path $OutputExe -Parent) 'Install-Setup.bat') -Force

Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue

$sizeMb = [math]::Round((Get-Item $OutputExe).Length / 1MB, 1)
Write-Host "Fast installer ready ($sizeMb MB): $OutputExe"
return $OutputExe
