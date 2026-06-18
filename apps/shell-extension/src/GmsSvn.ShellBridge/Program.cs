using System.Diagnostics;

namespace GmsSvn.ShellBridge;

internal static class Program
{
    private const string ClientExeName = "GMS SVN CLIENT.exe";
    private const string InstallRegKey = @"Software\GMS SVN\CLIENT";

    public static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: GmsSvn.ShellBridge.exe <action> <path>");
            return 1;
        }

        var action = args[0].Trim().ToLowerInvariant();
        var targetPath = args[1].Trim().Trim('"');

        if (string.IsNullOrWhiteSpace(targetPath) || !Directory.Exists(targetPath) && !File.Exists(targetPath))
        {
            MessageBox(IntPtr.Zero, "Could not resolve the selected path.", "GMS SVN CLIENT", 0x00000010);
            return 1;
        }

        if (action != "open" && action != "checkout" && !WorkingCopyDetector.IsInsideWorkingCopy(targetPath))
        {
            MessageBox(IntPtr.Zero,
                "This is not an SVN working copy.\n\nUse SVN Checkout first, or right-click inside a checked-out folder.",
                "GMS SVN CLIENT", 0x00000010);
            return 1;
        }

        var clientExe = ResolveClientExe();
        if (clientExe is null)
        {
            MessageBox(IntPtr.Zero, "GMS SVN CLIENT is not installed.", "GMS SVN", 0x00000010);
            return 1;
        }

        var argParts = new List<string> { "--", "--action", action, "--path", targetPath };

        if (action == "commit")
        {
            var repoInfo = ResolveRepoInfo(targetPath);
            var prompt = string.IsNullOrWhiteSpace(repoInfo)
                ? "Enter commit message:"
                : $"{repoInfo}\n\nEnter commit message:";
            var message = PromptInput("GMS SVN Commit", prompt);
            if (string.IsNullOrWhiteSpace(message)) return 0;
            argParts.Add("--message");
            argParts.Add(message);

            var svnPassword = PromptInput(
                "GMS SVN credentials",
                "Enter SVN password (same as GMS SVN CLIENT sign-in):");
            if (string.IsNullOrWhiteSpace(svnPassword)) return 0;
            argParts.Add("--svn-password");
            argParts.Add(svnPassword);
        }
        else if (action == "update-revision")
        {
            var rev = PromptInput("Update to Revision", "Enter revision number:");
            if (string.IsNullOrWhiteSpace(rev)) return 0;
            argParts.Add("--revision");
            argParts.Add(rev);
        }
        else if (action == "switch" || action == "merge")
        {
            var url = PromptInput($"SVN {action}", "Enter URL:");
            if (string.IsNullOrWhiteSpace(url)) return 0;
            argParts.Add("--url");
            argParts.Add(url);
        }
        else if (action == "branchtag")
        {
            var dest = PromptInput("Branch/Tag", "Destination URL:");
            if (string.IsNullOrWhiteSpace(dest)) return 0;
            var msg = PromptInput("Branch/Tag", "Log message:");
            if (string.IsNullOrWhiteSpace(msg)) return 0;
            argParts.Add("--url");
            argParts.Add(dest);
            argParts.Add("--message");
            argParts.Add(msg);
        }
        else if (action == "relocate")
        {
            var from = PromptInput("SVN Relocate", "From URL:");
            if (string.IsNullOrWhiteSpace(from)) return 0;
            var to = PromptInput("SVN Relocate", "To URL:");
            if (string.IsNullOrWhiteSpace(to)) return 0;
            argParts.Add("--url");
            argParts.Add(from);
            argParts.Add("--dest-path");
            argParts.Add(to);
        }
        else if (action == "rename")
        {
            var dest = PromptInput("SVN Rename", "New name (relative path):");
            if (string.IsNullOrWhiteSpace(dest)) return 0;
            argParts.Add("--dest-path");
            argParts.Add(dest);
        }

        if (IsQuietAction(action))
        {
            argParts.Add("--quiet");
        }

        var showWindow = action is "open" or "checkout" or "add" or "commit" or "repobrowser";

        var psi = new ProcessStartInfo
        {
            FileName = clientExe,
            Arguments = string.Join(" ", argParts.Select(QuoteArg)),
            UseShellExecute = false,
            CreateNoWindow = !showWindow,
        };

        try
        {
            using var proc = Process.Start(psi);
            if (proc is null)
            {
                MessageBox(IntPtr.Zero, "Could not start GMS SVN CLIENT.", "GMS SVN", 0x00000010);
                return 1;
            }
            proc.WaitForExit();
            return proc.ExitCode;
        }
        catch (Exception ex)
        {
            MessageBox(IntPtr.Zero, ex.Message, "GMS SVN", 0x00000010);
            return 1;
        }
    }

    private static bool IsQuietAction(string action) =>
        action is "copyurl";

    private static string? ResolveClientExe()
    {
        var fromEnv = Environment.GetEnvironmentVariable("GMS_SVN_CLIENT_EXE");
        if (!string.IsNullOrWhiteSpace(fromEnv) && File.Exists(fromEnv))
        {
            return fromEnv;
        }

        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(InstallRegKey);
            var installDir = key?.GetValue("InstallPath") as string;
            if (!string.IsNullOrWhiteSpace(installDir))
            {
                var candidate = Path.Combine(installDir, ClientExeName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
        }
        catch
        {
            // fall through
        }

        var devPath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "..", "client"));
        var devExe = Path.Combine(devPath, "out", "main", ClientExeName);
        return File.Exists(devExe) ? devExe : null;
    }

    private static string? PromptInput(string title, string message)
    {
        var script = $"""
            Add-Type -AssemblyName Microsoft.VisualBasic
            [Microsoft.VisualBasic.Interaction]::InputBox('{message.Replace("'", "''")}', '{title.Replace("'", "''")}')
            """;

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -STA -Command " + Quote(script),
            UseShellExecute = false,
            RedirectStandardOutput = true,
            CreateNoWindow = true,
        };

        using var proc = Process.Start(psi);
        if (proc is null) return null;
        var output = proc.StandardOutput.ReadToEnd().Trim();
        proc.WaitForExit();
        return string.IsNullOrWhiteSpace(output) ? null : output;
    }

    private static string Quote(string value) => "\"" + value.Replace("\"", "\\\"") + "\"";

    private static string QuoteArg(string value) =>
        value.Contains(' ') || value.Contains('"') ? Quote(value) : value;

    private static string? ResolveRepoInfo(string inputPath)
    {
        var wcRoot = ResolveWorkingCopyRoot(inputPath);
        if (wcRoot is null) return null;

        var svnExe = ResolveSvnExe();
        if (svnExe is null) return $"Local path: {wcRoot}";

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = svnExe,
                Arguments = $"info \"{wcRoot}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            };
            using var proc = Process.Start(psi);
            if (proc is null) return $"Local path: {wcRoot}";
            var output = proc.StandardOutput.ReadToEnd();
            proc.WaitForExit();
            string? url = null;
            string? rev = null;
            foreach (var line in output.Split('\n'))
            {
                if (line.StartsWith("URL: ", StringComparison.Ordinal)) url = line.Substring(5).Trim();
                if (line.StartsWith("Revision: ", StringComparison.Ordinal)) rev = line.Substring(10).Trim();
            }
            if (url is null) return $"Local path: {wcRoot}";
            return rev is null
                ? $"URL: {url}\nLocal path: {wcRoot}"
                : $"URL: {url}\nRevision: {rev}\nLocal path: {wcRoot}";
        }
        catch
        {
            return $"Local path: {wcRoot}";
        }
    }

    private static string? ResolveWorkingCopyRoot(string inputPath)
    {
        var current = File.Exists(inputPath) ? Path.GetDirectoryName(inputPath)! : inputPath;
        current = Path.GetFullPath(current);

        while (true)
        {
            if (Directory.Exists(Path.Combine(current, ".svn"))) return current;
            var parent = Directory.GetParent(current);
            if (parent is null) return null;
            current = parent.FullName;
        }
    }

    private static string? ResolveSvnExe()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(InstallRegKey);
            var installDir = key?.GetValue("InstallPath") as string;
            if (!string.IsNullOrWhiteSpace(installDir))
            {
                var bundled = Path.Combine(installDir, "svn", "svn.exe");
                if (File.Exists(bundled)) return bundled;
            }
        }
        catch
        {
            // fall through
        }

        return File.Exists(@"C:\Program Files\GMS SVN CLIENT\svn\svn.exe")
            ? @"C:\Program Files\GMS SVN CLIENT\svn\svn.exe"
            : null;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);
}

internal static class WorkingCopyDetector
{
    public static bool IsInsideWorkingCopy(string inputPath)
    {
        var current = File.Exists(inputPath) ? Path.GetDirectoryName(inputPath)! : inputPath;
        current = Path.GetFullPath(current);

        while (true)
        {
            if (Directory.Exists(Path.Combine(current, ".svn")))
            {
                return true;
            }

            var parent = Directory.GetParent(current);
            if (parent is null)
            {
                return false;
            }

            current = parent.FullName;
        }
    }
}
