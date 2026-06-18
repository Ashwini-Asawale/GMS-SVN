using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace GmsSvn.ShellExtension;

/// <summary>
/// Ensures RegAsm writes shell handler keys reliably on client PCs.
/// </summary>
internal static class ShellComRegistration
{
    private const string HandlerName = "GMS SVN CLIENT";
    private static readonly string[] HandlerPaths =
    {
        @"*\shellex\ContextMenuHandlers\" + HandlerName,
        @"Directory\shellex\ContextMenuHandlers\" + HandlerName,
        @"Directory\Background\shellex\ContextMenuHandlers\" + HandlerName,
    };

    [ComRegisterFunction]
    public static void Register(Type type)
    {
        var guid = type.GUID.ToString("B");
        foreach (var path in HandlerPaths)
        {
            using var key = Registry.ClassesRoot.CreateSubKey(path);
            key?.SetValue(null, guid);
        }

        using (var approved = Registry.LocalMachine.OpenSubKey(
                   @"Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved", writable: true)
               ?? Registry.LocalMachine.CreateSubKey(
                   @"Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved"))
        {
            approved?.SetValue(guid, HandlerName);
        }
    }

    [ComUnregisterFunction]
    public static void Unregister(Type type)
    {
        var guid = type.GUID.ToString("B");
        foreach (var path in HandlerPaths)
        {
            try
            {
                Registry.ClassesRoot.DeleteSubKeyTree(path, throwOnMissingSubKey: false);
            }
            catch
            {
                // ignore
            }
        }

        try
        {
            using var approved = Registry.LocalMachine.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved", writable: true);
            approved?.DeleteValue(guid, throwOnMissingValue: false);
        }
        catch
        {
            // ignore
        }
    }
}
