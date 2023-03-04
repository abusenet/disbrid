#!/usr/bin/env -S deno run --allow-all

import { 
  router,
  fetch,
  Progress,
  Rclone,
} from "./deps.ts";

import { fetch as debrid } from "./plugins/debrid-link.fr/main.ts";

const encoder = new TextEncoder();
// Rclone remote to upload files to, default to current directory.
const TARGET = Deno.env.get("RCLONE_TARGET") || Deno.cwd();

function help(_request: Request): Response {
  return new Response(
    `\rDiscord-based Debrid Application.\r\n\r\n

    \rUSAGE:\r\n
    \r    /[COMMAND] [OPTIONS]\r\n\r\n

    \rCOMMANDS:\r\n
    \r    fetch:\r\n
    \r        Fetches a resource from its "url" and optional "password"\r\n
    \r    help:\r\n
    \r        Displays this message.\r\n\r\n

    \rOPTIONS:\r\n
    \r    url:\r\n
    \r        Link of the remote URL\r\n
    \r    password:\r\n
    \r        Password of the file if any.\r\n`,
  );
}

function handleFetch(request: Request): Response | Promise<Response> {
  const authorization = request.headers.get("Authorization")!;
  const [_user] = atob(authorization.split(" ")[1]).split(":");

  const { searchParams } = new URL(request.url);
  let source: string | URL = searchParams.get("url") || "";
  const password = searchParams.get("password") || "";

  let reply: BodyInit = "";

  try {
    source = new URL(source);
  } catch (_error) {
    return new Response(`Invalid URL`);
  }

  //#region AbortSignal
  const handlerAbortController = new AbortController();
  const signal = handlerAbortController.signal;
  // Discord only allows 15 minutes for an interaction.
  const abortTimeoutId = setTimeout(() => {
    handlerAbortController.abort();
  }, 15 * 60 * 1000); // 15 minutes
  // Abort the request when the interaction is over.
  request.signal?.addEventListener("abort", () => {
    clearTimeout(abortTimeoutId);
    handlerAbortController.abort();
  });
  //#endregion AbortSignal

  // @TODO: Use Rclone's `--progress` instead when it's available.
  reply = new ReadableStream({
    async start(controller) { // When the stream starts
      console.time(`${source}`);

      source = new URL(source);
      source.searchParams.set("password", password);

      // Tries plugins until we get a successful response.
      let response = await debrid(source);
      if (!response.ok) {
        response = await Rclone.backend(
          "download",
          ":fshare:",
          `${source}`,
          {},
        );
      }
      if (!response.ok) {
        source.searchParams.delete("password");
        response = await Rclone.cat(`${source}`);
      }

      const { ok, status, statusText, headers, body, url } = response;

      let { pathname } = new URL(url);
      pathname = decodeURIComponent(pathname);
      const filename = pathname.substring(pathname.lastIndexOf("/") + 1);

      const fileSize = Number(headers.get("Content-Length"));

      if (!ok) {
        controller.enqueue(
          encoder.encode(`\r**Error**: ${status} ${statusText}`),
        );
        return;
      }

      //#region Progress
      function onProgress({
        completedh,
        done,
        etah,
        totalh,
        percent,
        rateh,
        timeh,
      }: Progress) {
        let message = "\f"; // Clears previous message.
        message +=
          `\r\nTransferred:    ${completedh} / ${totalh}, ${percent}%, ${rateh}/s`;
        if (!done) {
          message += `, ETA ${etah}`;
        }
        message += `\r\nElapsed time:   ${timeh}`;
        message += `\r\nTransferring:`;
        message += `\r\n* ${filename}: ${percent}% /${totalh}, ${rateh}/s`;
        if (!done) {
          message += `, ${etah}`;
        }

        if (done) {
          console.timeEnd(`${source}`);
        }
        controller.enqueue(encoder.encode(message));
      }
      //#endregion Progress

      // Calls Rclone's `fetch` directly instead of `rcat` since it expects `Deno.stdin`.
      fetch(`${TARGET}/${filename}`, {
        method: "PUT",
        // Hooks into the file stream and sends progress to reply stream.
        body: body!
          // Uses a `TransformStream` to terminate the stream when abort signal received.
          .pipeThrough(
            new TransformStream({
              start(controller) {
                signal.addEventListener("abort", () => {
                  controller.terminate();
                });
              },
            }),
          )
          .pipeThrough(new Progress(fileSize, onProgress)),
      });
    },
  });

  // @TODO: sends a "direct" link in the response for media to stream there.

  return new Response(reply, {
    headers: {
      "Link": `</retry>; title="Retry"`,
    },
  });
}
handleFetch.displayName =
  "Fetches a file from a remote `url`, with optional `password`.";

export const routes = {
  "/fetch?url=&password=": handleFetch,
  "/help": help,
};

export const handler = (options = {}) => router(routes, options);

if (import.meta.main) {
  const { serve } = await import(
    "https://deno.land/std@0.178.0/http/server.ts"
  );

  const controller = new AbortController();
  const route = handler({
    serveOnly: false,
  });

  serve((request, connInfo) => {
    const { method, url } = request;

    // POST requests are from Discord's interaction.
    if (method === "POST") {
      return route(request, connInfo);
    }

    const { pathname } = new URL(url);

    if (pathname === "/") {
      return new Response("Hello");
    }

    return new Response(null, {
      status: 404,
    });
  }, {
    port: Number(Deno.env.get("PORT")) || 9000,
    signal: controller.signal,
  });
}
