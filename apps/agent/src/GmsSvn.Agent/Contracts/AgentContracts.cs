namespace GmsSvn.Agent.Contracts;

public sealed class AgentCommandRequest
{
    public required Guid CommandId { get; init; }
    public required Guid CorrelationId { get; init; }
    public required string IdempotencyKey { get; init; }
    public required string Type { get; init; }
    public required Dictionary<string, object?> Payload { get; init; }
    public required string Timestamp { get; init; }
    public required string Signature { get; init; }
}

public sealed class AgentCommandResult
{
    public required Guid CommandId { get; init; }
    public required bool Success { get; init; }
    public string? Stdout { get; init; }
    public string? Stderr { get; init; }
    public int? ExitCode { get; init; }
    public required int DurationMs { get; init; }
    public Dictionary<string, object?>? Data { get; init; }
}

public static class AgentCommandTypes
{
    public const string CreateRepository = "CreateRepository";
    public const string SetAccessRule = "SetAccessRule";
    public const string RemoveAccessRule = "RemoveAccessRule";
    public const string GetRepositoryStatus = "GetRepositoryStatus";
    public const string ListRepositories = "ListRepositories";
    public const string ExecuteBackup = "ExecuteBackup";
    public const string InstallHook = "InstallHook";
    public const string ListPath = "ListPath";
    public const string GetLog = "GetLog";
    public const string GetDiff = "GetDiff";

    public static readonly HashSet<string> Allowlist = new(StringComparer.Ordinal)
    {
        CreateRepository,
        SetAccessRule,
        RemoveAccessRule,
        GetRepositoryStatus,
        ListRepositories,
        ExecuteBackup,
        InstallHook,
        ListPath,
        GetLog,
        GetDiff,
    };
}
