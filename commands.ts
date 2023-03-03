#!/usr/bin/env -S deno run --allow-all

/**
 * A CLI helper to manage Discord commands.
 * 
 * USAGE:
 *     # Retrieves all global command registered by the application
 *     ./commands GET
 * 
 *     # Retrieves all guild commands registered by the application.
 *     ./commands GET <guildId>
 * 
 *     # Deletes all global command registered by the application
 *     ./commands DELETE
 * 
 *     # Deletes all guild commands registered by the application.
 *     ./commands DELETE <guildId>
 */

const options: Record<string, string> = {};
const DISCORD_BASE_URL = "https://discord.com/api/v10";

const [method = "GET", guildId] = Deno.args;

const {
  applicationId = Deno.env.get("DISCORD_APPLICATION_ID") || "",
  authToken = Deno.env.get("DISCORD_BOT_TOKEN") || "",
  tokenPrefix,
} = options;

const endpoint = guildId
  ? `applications/${applicationId}/guilds/${guildId}/commands`
  : `applications/${applicationId}/commands`;
const headers = {
  "Authorization": `${(tokenPrefix || "Bot")} ${authToken}`,
  "Content-Type": "application/json",
};

const response = await fetch(`${DISCORD_BASE_URL}/${endpoint}`, {
  method: method === "DELETE" ? "GET" : method,
  headers,
})

if (!response.ok) {
  console.error(`Failed to execute: ${response.statusText}`);
  Deno.exit();
}

if (response.body) {
  const commands = await response.json();

  if (method !== "DELETE") {
    console.log(commands);
    Deno.exit();
  }

  for await (const command of commands) {
    const response = await fetch(
      `${DISCORD_BASE_URL}/applications/${applicationId}/commands/${command.id}`,
      {
        method,
        headers,
      },
    );

    if (!response.ok) {
      console.error(`Failed to execute: ${response.statusText}`);
      Deno.exit();
    }
  }
}
