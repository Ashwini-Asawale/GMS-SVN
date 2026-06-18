namespace GmsSvn.Agent;

public sealed class AgentOptions
{
    public string ListenUrl { get; set; } = "http://0.0.0.0:8443";
    public string HmacSecret { get; set; } = "change-me-agent-hmac-secret-min-32-chars";
    public string RepoRoot { get; set; } = @"D:\SVN\Repositories";
    public string BackupScriptPath { get; set; } = @"D:\GMS-SVN\infra\scripts\gms-svn-backup.ps1";
    public string VisualSvnPsModule { get; set; } = @"C:\Program Files\VisualSVN Server\PowerShellModules\VisualSVN";
    public bool MockMode { get; set; }
}
