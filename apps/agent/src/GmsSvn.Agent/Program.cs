using GmsSvn.Agent.Commands;
using GmsSvn.Agent.Contracts;
using GmsSvn.Agent.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "GmsSvnServerAgent";
});

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddSingleton(sp =>
{
    var options = new AgentOptions();
    builder.Configuration.GetSection("Agent").Bind(options);
    return options;
});
builder.Services.AddSingleton<CommandDispatcher>();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "GMS SVN SERVER Agent",
    timestamp = DateTime.UtcNow,
}));

app.MapPost("/commands", async (AgentCommandRequest request, AgentOptions options, CommandDispatcher dispatcher, ILogger<Program> logger) =>
{
    if (!AgentCommandTypes.Allowlist.Contains(request.Type))
        return Results.BadRequest(new { error = "Command not allowed" });

    if (!HmacValidator.Verify(
            options.HmacSecret,
            request.CommandId,
            request.Type,
            request.Timestamp,
            request.Payload,
            request.Signature))
    {
        logger.LogWarning("Rejected unsigned/invalid agent request {CommandId}", request.CommandId);
        return Results.Unauthorized(new { error = "Invalid signature or timestamp" });
    }

    var result = await dispatcher.DispatchAsync(request, CancellationToken.None);
    return Results.Json(result);
});

var listenUrl = builder.Configuration["Agent:ListenUrl"] ?? "http://0.0.0.0:8443";
app.Run(listenUrl);
