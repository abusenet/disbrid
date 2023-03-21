#!/usr/bin/env -S deno run --allow-all

import { router } from "./deps.ts";
import { TransferStream } from "./lib/TransferStream.ts";

export const commands = {
  "/fetch/:url?password="(
    request: Request,
    _info: unknown,
    params: Record<string, string>,
  ) {
    const authorization = request.headers.get("Authorization")!;
    const [_user] = atob(authorization.split(" ")[1]).split(":");

    let source: string | URL = params.url;
    const { searchParams } = new URL(request.url);
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

    source.searchParams.set("password", password);

    // @TODO: Use Rclone's `--progress` instead when it's available.
    reply = new TransferStream(
      new Request(source, {
        signal,
      }),
    );

    // @TODO: sends a "direct" link in the response for media to stream there.

    return new Response(reply);
  },
  "/help"(request: Request) {
    const languages = request.headers.get("Accept-Language")?.split(",") || [];

    let message = "";

    if (languages.some((language) => language.includes("vi"))) {
      message = `\rỨng dụng Debrid trên nền tảng Discord.\r\n\r\n

      \rCÁCH SỬ DỤNG:\r\n
      \r    /[LỆNH] [TÙY CHỌN]\r\n\r\n

      \rLỆNH:\r\n
      \r    fetch:\r\n
      \r        Tải tài nguyên từ "url" và "password" tùy chọn\r\n
      \r    help:\r\n
      \r        Hiển thị thông báo này.\r\n\r\n

      \rTÙY CHỌN:\r\n
      \r    url:\r\n
      \r        Liên kết của URL từ xa\r\n
      \r    password:\r\n
      \r        Mật khẩu của tệp nếu có.\r\n`;
    } else {
      message = `\rDiscord-based Debrid Application.\r\n\r\n

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
      \r        Password of the file if any.\r\n`;
    }

    return new Response(message);
  },
};

"/fetch/:url?password=".displayName =
  "Fetches a file from a remote `url`, with optional `password`.";

export const handler = (options = {}) => router(commands, options);

if (import.meta.main) {
  const { serve } = await import(
    "https://deno.land/std@0.178.0/http/server.ts"
  );

  const controller = new AbortController();
  const handleInteraction = handler({
    serveOnly: false,
  });

  serve(async (request, connInfo) => {
    const { method, url } = request;
    const { pathname } = new URL(url);

    // POST requests are from Discord's interaction.
    if (method === "POST") {
      return handleInteraction(request, connInfo);
    }

    if (pathname === "/") {
      const response = await commands["/help"](request);
      const help = await response.text();
      return new Response(help.replace(/\r\n\n/g, ""));
    }

    return new Response(null, {
      status: 404,
    });
  }, {
    port: Number(Deno.env.get("PORT")) || 9000,
    signal: controller.signal,
  });
}
