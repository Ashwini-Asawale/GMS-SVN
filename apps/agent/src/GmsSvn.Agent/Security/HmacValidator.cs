using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace GmsSvn.Agent.Security;

public static class HmacValidator
{
    private static readonly TimeSpan MaxSkew = TimeSpan.FromMinutes(5);

    public static bool Verify(
        string secret,
        Guid commandId,
        string type,
        string timestamp,
        Dictionary<string, object?> payload,
        string signature)
    {
        if (!IsTimestampValid(timestamp))
            return false;

        var expected = Sign(secret, commandId, type, timestamp, payload);
        try
        {
            return CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(expected),
                Convert.FromHexString(signature));
        }
        catch
        {
            return false;
        }
    }

    public static string Sign(
        string secret,
        Guid commandId,
        string type,
        string timestamp,
        Dictionary<string, object?> payload)
    {
        var body = BuildPayload(commandId, type, timestamp, payload);
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string BuildPayload(
        Guid commandId,
        string type,
        string timestamp,
        Dictionary<string, object?> payload)
    {
        var json = JsonSerializer.Serialize(payload);
        return $"{commandId}\n{type}\n{timestamp}\n{json}";
    }

    private static bool IsTimestampValid(string timestamp)
    {
        if (!DateTimeOffset.TryParse(timestamp, out var ts))
            return false;
        return Math.Abs((DateTimeOffset.UtcNow - ts).TotalMilliseconds) <= MaxSkew.TotalMilliseconds;
    }
}
