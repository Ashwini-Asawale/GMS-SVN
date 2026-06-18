using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using GmsSvn.Agent.Contracts;

namespace GmsSvn.Agent.Commands;

public partial class CommandDispatcher
{
    private static readonly Regex RepoNameRegex = MyRegex();
    private readonly AgentOptions _options;
    private readonly ILogger<CommandDispatcher> _logger;

    public CommandDispatcher(AgentOptions options, ILogger<CommandDispatcher> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<AgentCommandResult> DispatchAsync(AgentCommandRequest request, CancellationToken ct)
    {
        if (!AgentCommandTypes.Allowlist.Contains(request.Type))
        {
            return Fail(request.CommandId, $"Command type not allowed: {request.Type}", 0);
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var result = request.Type switch
            {
                AgentCommandTypes.CreateRepository => await CreateRepositoryAsync(request, ct),
                AgentCommandTypes.SetAccessRule => await SetAccessRuleAsync(request, ct),
                AgentCommandTypes.RemoveAccessRule => await RemoveAccessRuleAsync(request, ct),
                AgentCommandTypes.GetRepositoryStatus => await GetRepositoryStatusAsync(request, ct),
                AgentCommandTypes.ListRepositories => await ListRepositoriesAsync(request, ct),
                AgentCommandTypes.ExecuteBackup => await ExecuteBackupAsync(request, ct),
                AgentCommandTypes.InstallHook => await InstallHookAsync(request, ct),
                AgentCommandTypes.ListPath => await ListPathAsync(request, ct),
                AgentCommandTypes.GetLog => await GetLogAsync(request, ct),
                AgentCommandTypes.GetDiff => await GetDiffAsync(request, ct),
                _ => Fail(request.CommandId, "Unhandled command", sw.ElapsedMilliseconds),
            };
            result = result with { DurationMs = (int)sw.ElapsedMilliseconds };
            _logger.LogInformation(
                "Agent command {Type} {CommandId} success={Success} duration={DurationMs}ms",
                request.Type,
                request.CorrelationId,
                result.Success,
                result.DurationMs);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Agent command {Type} failed", request.Type);
            return Fail(request.CommandId, ex.Message, sw.ElapsedMilliseconds);
        }
    }

    private async Task<AgentCommandResult> CreateRepositoryAsync(AgentCommandRequest request, CancellationToken ct)
    {
        var name = GetString(request.Payload, "name");
        if (!RepoNameRegex.IsMatch(name))
            return Fail(request.CommandId, "Invalid repository name", 0);

        if (_options.MockMode)
        {
            return Ok(request.CommandId, $"Mock created repository {name}", new Dictionary<string, object?> { ["name"] = name });
        }

        var repoPath = Path.Combine(_options.RepoRoot, name);
        if (Directory.Exists(repoPath))
            return Fail(request.CommandId, $"Repository already exists: {name}", 0);

        var ps = _options.VisualSvnPsModule;
        var script = $"New-SvnRepository -Name '{name}' -Path '{_options.RepoRoot}'";
        var (exitCode, stdout, stderr) = await RunPowerShellAsync(script, ct);
        if (exitCode != 0)
            return Fail(request.CommandId, stderr ?? stdout, exitCode);

        return Ok(request.CommandId, stdout, new Dictionary<string, object?> { ["name"] = name, ["path"] = repoPath });
    }

    private Task<AgentCommandResult> SetAccessRuleAsync(AgentCommandRequest request, CancellationToken ct)
    {
        ValidateRepoPayload(request.Payload);
        if (_options.MockMode)
            return Task.FromResult(Ok(request.CommandId, "Mock SetAccessRule applied", null));

        return Task.FromResult(Fail(request.CommandId, "SetAccessRule requires VisualSVN PowerShell module", 1));
    }

    private Task<AgentCommandResult> RemoveAccessRuleAsync(AgentCommandRequest request, CancellationToken ct)
    {
        ValidateRepoPayload(request.Payload);
        if (_options.MockMode)
            return Task.FromResult(Ok(request.CommandId, "Mock RemoveAccessRule applied", null));

        return Task.FromResult(Fail(request.CommandId, "RemoveAccessRule requires VisualSVN PowerShell module", 1));
    }

    private Task<AgentCommandResult> GetRepositoryStatusAsync(AgentCommandRequest request, CancellationToken ct)
    {
        var name = GetString(request.Payload, "repositoryName");
        if (!RepoNameRegex.IsMatch(name))
            return Task.FromResult(Fail(request.CommandId, "Invalid repository name", 0));

        if (_options.MockMode)
        {
            return Task.FromResult(Ok(request.CommandId, "Mock status", new Dictionary<string, object?>
            {
                ["name"] = name,
                ["latestRevision"] = 0,
                ["sizeBytes"] = "0",
                ["lockCount"] = 0,
            }));
        }

        return Task.FromResult(Fail(request.CommandId, "GetRepositoryStatus requires svnlook", 1));
    }

    private Task<AgentCommandResult> ListRepositoriesAsync(AgentCommandRequest request, CancellationToken ct)
    {
        if (_options.MockMode || !Directory.Exists(_options.RepoRoot))
        {
            return Task.FromResult(Ok(request.CommandId, "Listed repositories", new Dictionary<string, object?>
            {
                ["repositories"] = Array.Empty<object>(),
            }));
        }

        var repos = Directory.GetDirectories(_options.RepoRoot)
            .Select(d => new DirectoryInfo(d))
            .Where(d => File.Exists(Path.Combine(d.FullName, "format")))
            .Select(d => new Dictionary<string, object?>
            {
                ["name"] = d.Name,
                ["latestRevision"] = null,
                ["sizeBytes"] = null,
            })
            .ToList();

        return Task.FromResult(Ok(request.CommandId, $"Found {repos.Count} repositories", new Dictionary<string, object?>
        {
            ["repositories"] = repos,
        }));
    }

    private async Task<AgentCommandResult> ExecuteBackupAsync(AgentCommandRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.BackupScriptPath))
            return Fail(request.CommandId, "BackupScriptPath not configured", 1);

        if (_options.MockMode)
            return Ok(request.CommandId, "Mock backup completed", null);

        var (exitCode, stdout, stderr) = await RunProcessAsync("powershell.exe", $"-File \"{_options.BackupScriptPath}\"", ct);
        return exitCode == 0
            ? Ok(request.CommandId, stdout, null)
            : Fail(request.CommandId, stderr ?? stdout, exitCode);
    }

    private Task<AgentCommandResult> InstallHookAsync(AgentCommandRequest request, CancellationToken ct)
    {
        var name = GetString(request.Payload, "repositoryName");
        if (!RepoNameRegex.IsMatch(name))
            return Task.FromResult(Fail(request.CommandId, "Invalid repository name", 0));

        if (_options.MockMode)
            return Task.FromResult(Ok(request.CommandId, "Mock hook installed", null));

        return Task.FromResult(Fail(request.CommandId, "InstallHook requires repo hooks path access", 1));
    }

    private Task<AgentCommandResult> ListPathAsync(AgentCommandRequest request, CancellationToken ct)
    {
        var name = GetString(request.Payload, "repositoryName");
        var path = GetString(request.Payload, "path", required: false);
        if (string.IsNullOrEmpty(path)) path = "/";
        if (!RepoNameRegex.IsMatch(name))
            return Task.FromResult(Fail(request.CommandId, "Invalid repository name", 0));

        if (_options.MockMode)
        {
            var entries = path == "/"
                ? new object[] { new { name = "trunk", kind = "dir" }, new { name = "branches", kind = "dir" }, new { name = "tags", kind = "dir" } }
                : Array.Empty<object>();
            return Task.FromResult(Ok(request.CommandId, "Mock list", new Dictionary<string, object?> { ["path"] = path, ["entries"] = entries }));
        }

        return Task.FromResult(Fail(request.CommandId, "ListPath requires svn executable", 1));
    }

    private Task<AgentCommandResult> GetLogAsync(AgentCommandRequest request, CancellationToken ct)
    {
        if (_options.MockMode)
            return Task.FromResult(Ok(request.CommandId, "Mock log", new Dictionary<string, object?> { ["entries"] = Array.Empty<object>() }));

        return Task.FromResult(Fail(request.CommandId, "GetLog requires svn executable", 1));
    }

    private Task<AgentCommandResult> GetDiffAsync(AgentCommandRequest request, CancellationToken ct)
    {
        if (_options.MockMode)
            return Task.FromResult(Ok(request.CommandId, "Mock diff", new Dictionary<string, object?> { ["diff"] = string.Empty }));

        return Task.FromResult(Fail(request.CommandId, "GetDiff requires svn executable", 1));
    }

    private static void ValidateRepoPayload(Dictionary<string, object?> payload)
    {
        var repo = GetString(payload, "repositoryName");
        if (!RepoNameRegex.IsMatch(repo))
            throw new InvalidOperationException("Invalid repository name");

        var path = GetString(payload, "path", required: false);
        if (!string.IsNullOrEmpty(path) && (path.Contains("..") || !path.StartsWith('/')))
            throw new InvalidOperationException("Invalid path");
    }

    private static string GetString(Dictionary<string, object?> payload, string key, bool required = true)
    {
        if (!payload.TryGetValue(key, out var value) || value is null)
        {
            if (required) throw new InvalidOperationException($"Missing payload field: {key}");
            return string.Empty;
        }

        return value switch
        {
            string s => s,
            JsonElement el when el.ValueKind == JsonValueKind.String => el.GetString() ?? string.Empty,
            _ => value.ToString() ?? string.Empty,
        };
    }

    private async Task<(int ExitCode, string Stdout, string Stderr)> RunPowerShellAsync(string script, CancellationToken ct)
    {
        return await RunProcessAsync(
            "powershell.exe",
            $"-NoProfile -ExecutionPolicy Bypass -Command \"Import-Module '{_options.VisualSvnPsModule}'; {script}\"",
            ct);
    }

    private static async Task<(int ExitCode, string Stdout, string Stderr)> RunProcessAsync(
        string fileName,
        string arguments,
        CancellationToken ct)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            },
        };
        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        var stderr = await process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        return (process.ExitCode, stdout, stderr);
    }

    private static AgentCommandResult Ok(Guid commandId, string stdout, Dictionary<string, object?>? data) =>
        new()
        {
            CommandId = commandId,
            Success = true,
            Stdout = stdout,
            ExitCode = 0,
            DurationMs = 0,
            Data = data,
        };

    private static AgentCommandResult Fail(Guid commandId, string stderr, long durationMs) =>
        new()
        {
            CommandId = commandId,
            Success = false,
            Stderr = stderr,
            ExitCode = 1,
            DurationMs = (int)durationMs,
        };

    [GeneratedRegex("^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$")]
    private static partial Regex MyRegex();
}
