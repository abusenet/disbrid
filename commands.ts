const DISCORD_BASE_URL = "https://discord.com/api/v10";

export function request(request: Request) {
  const { method, body } = request;
  const { pathname, searchParams } = new URL(request.url);

  const applicationId = searchParams.get("applicationId") || Deno.env.get("DISCORD_APPLICATION_ID") || "";
  const authToken = searchParams.get("token") || Deno.env.get("DISCORD_BOT_TOKEN") || "";
  const tokenPrefix = searchParams.get("prefix");
  const guildId = searchParams.get("guildId");

  const endpoint = guildId
    ? `applications/${applicationId}/guilds/${guildId}/commands`
    : `applications/${applicationId}/commands`;
  const headers = {
    "Authorization": `${(tokenPrefix || "Bot")} ${authToken}`,
    "Content-Type": "application/json",
  };

  const url = new URL(`${DISCORD_BASE_URL}/${endpoint}${pathname === "/" ? "" : pathname}`);

  return fetch(url, {
    method,
    headers,
    body,
  });
}

if (import.meta.main) {
  const [method = "GET", guildId = ""] = Deno.args;
  const searchParams = new URLSearchParams({ guildId });
  const response = await request(new Request(`discord:/?${searchParams}`, {
    method: method === "DELETE" ? "GET" : method,
  }));

  if (!response.ok) {
    console.error(`Failed to execute: ${response.statusText}`);
    Deno.exit();
  }

  if (response.body) {
    const commands = await response.json();

    if (method === "GET") {
      console.log(commands);
      Deno.exit();
    }

    if (method === "DELETE") {
      for await (const command of commands) {
        const response = await request(new Request(`discord:/${command.id}?${searchParams}`, { method }));

        if (!response.ok) {
          console.error(`Failed to execute: ${response.statusText}`);
          Deno.exit();
        }
      }
    }

    if (method === "PUT") {
      const response = await request(new Request(`discord:/?${searchParams}`, {
        method,
        body: Deno.stdin.readable,
      }));

      if (!response.ok) {
        console.error(`Failed to execute: ${response.statusText}`);
        Deno.exit();
      }
    }
  }
}
