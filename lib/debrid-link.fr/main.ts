/**
 * A fetch handler for retrieving files through debrid-link.
 */

const BASE_URL = "https://debrid-link.com/api/v2";

type domain = string;
interface Host {
  name: string;
  type: string;
  status: 1 | 0;
  isFree: boolean;
  domains: domain[];
  regexs: string[];
}

const HOSTERS = await fetch(`${BASE_URL}/downloader/hosts`)
  .then((response) => response.json())
  .then(({ value }) => value.filter(({ status, type }: Host) => status === 1 && type === "host"))
  .then((hosts: Host[]) => hosts.reduce((hosts: string[], host: Host) => {
    hosts.push(...host.domains);
    return hosts;
  }, []));

const exports = {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { host, searchParams } = url;
    const password = searchParams.get("password") || "";
    const apiKey = searchParams.get("api_key") ||
      Deno.env.get("DEBRID_API_KEY") || "";

    if (!HOSTERS.includes(host)) {
      return new Response(null, {
        status: 400,
      });
    }

    const response = await fetch(`${BASE_URL}/downloader/add`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        password,
      }),
    });

    const { success, error, value } = await response.json();
    if (!success) {
      return new Response(`Can't fetch with error: ${error}`, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const {
      // id,
      // expired,
      // chunk,
      // host,
      // size,
      // created,
      // url,
      downloadUrl,
      // name
    } = value;

    return fetch(downloadUrl);
  }
}

export default exports;

if (import.meta.main) {
  Deno.serve((request: Request) => {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url") || "";

    return exports.fetch(new Request(url));
  });
}
