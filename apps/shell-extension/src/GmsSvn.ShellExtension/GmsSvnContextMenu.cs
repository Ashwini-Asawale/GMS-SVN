using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using SharpShell.Attributes;
using SharpShell.SharpContextMenu;
using SharpShell.Interop;

namespace GmsSvn.ShellExtension;

/// <summary>
/// Explorer context menu — TortoiseSVN-style operations via GMS SVN CLIENT.
/// </summary>
[ComVisible(true)]
[Guid("f4e8b2a1-6c3d-4e5f-9a8b-1c2d3e4f5a6b")]
[DisplayName("GMS SVN CLIENT")]
[COMServerAssociation(AssociationType.Directory)]
[COMServerAssociation(AssociationType.DirectoryBackground)]
public class GmsSvnContextMenu : SharpContextMenu
{
    private const string BridgeExeName = "GmsSvn.ShellBridge.exe";
    private const string InstallRegKey = @"Software\GMS SVN\CLIENT";

    protected override bool CanShowMenu()
    {
        var path = GetSelectedPath();
        return !string.IsNullOrWhiteSpace(path);
    }

    protected override ContextMenuStrip CreateMenu()
    {
        var menu = new ContextMenuStrip();
        var path = GetSelectedPath() ?? string.Empty;
        var inWorkingCopy = WorkingCopyDetector.IsInsideWorkingCopy(path);

        var checkout = CreateItem("SVN Checkout", "checkout", path);
        checkout.Enabled = !inWorkingCopy;
        menu.Items.Add(checkout);

        menu.Items.Add(new ToolStripSeparator());

        AddWcItem(menu, "SVN Update", "update", path, inWorkingCopy);
        AddWcItem(menu, "SVN Commit", "commit", path, inWorkingCopy);
        AddWcItem(menu, "Check for Modifications", "status", path, inWorkingCopy);
        AddWcItem(menu, "SVN Revert", "revert", path, inWorkingCopy);
        AddWcItem(menu, "SVN Diff", "diff", path, inWorkingCopy);
        AddWcItem(menu, "SVN Show Log", "log", path, inWorkingCopy);
        AddWcItem(menu, "SVN Blame", "blame", path, inWorkingCopy);

        menu.Items.Add(new ToolStripSeparator());

        AddWcItem(menu, "SVN Add", "add", path, inWorkingCopy);
        AddWcItem(menu, "SVN Delete", "delete", path, inWorkingCopy);
        AddWcItem(menu, "SVN Cleanup", "cleanup", path, inWorkingCopy);
        AddWcItem(menu, "SVN Resolve", "resolve", path, inWorkingCopy);
        AddWcItem(menu, "SVN Lock", "lock", path, inWorkingCopy);
        AddWcItem(menu, "SVN Unlock", "unlock", path, inWorkingCopy);

        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(CreateItem("Open in GMS SVN CLIENT", "open", path));
        return menu;
    }

    private static void AddWcItem(ContextMenuStrip menu, string label, string action, string path, bool inWorkingCopy)
    {
        var item = CreateItem(label, action, path);
        item.Enabled = inWorkingCopy;
        menu.Items.Add(item);
    }

    private static ToolStripMenuItem CreateItem(string label, string action, string path)
    {
        var item = new ToolStripMenuItem(label);
        item.Click += (_, _) => LaunchBridge(action, path);
        return item;
    }

    private string? GetSelectedPath()
    {
        if (SelectedItemPaths is not null)
        {
            foreach (var path in SelectedItemPaths)
            {
                if (!string.IsNullOrWhiteSpace(path))
                {
                    return path;
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(FolderPath))
        {
            return FolderPath;
        }

        return null;
    }

    private static void LaunchBridge(string action, string path)
    {
        var bridge = ResolveBridgeExe();
        if (bridge is null)
        {
            MessageBox(IntPtr.Zero, "GMS SVN Shell Bridge is not installed.", "GMS SVN", 0x00000010);
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = bridge,
                Arguments = $"\"{action}\" \"{path}\"",
                UseShellExecute = false,
                CreateNoWindow = action != "open" && action != "commit",
            });
        }
        catch (Exception ex)
        {
            MessageBox(IntPtr.Zero, ex.Message, "GMS SVN", 0x00000010);
        }
    }

    private static string? ResolveBridgeExe()
    {
        var fromEnv = Environment.GetEnvironmentVariable("GMS_SVN_SHELL_BRIDGE_EXE");
        if (!string.IsNullOrWhiteSpace(fromEnv) && File.Exists(fromEnv))
        {
            return fromEnv;
        }

        using var key = Registry.LocalMachine.OpenSubKey(InstallRegKey);
        var installDir = key?.GetValue("InstallPath") as string;
        if (!string.IsNullOrWhiteSpace(installDir))
        {
            var inExplorer = Path.Combine(installDir, "explorer", BridgeExeName);
            if (File.Exists(inExplorer))
            {
                return inExplorer;
            }

            var candidate = Path.Combine(installDir, BridgeExeName);
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        var devPath = Path.GetFullPath(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "shell-extension", "src", "GmsSvn.ShellBridge", "bin", "Debug", "net48"));
        var devExe = Path.Combine(devPath, BridgeExeName);
        return File.Exists(devExe) ? devExe : null;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
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
