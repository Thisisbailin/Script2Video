
export const onRequest = async ({ request }) => {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, x-proxy-url",
            },
        });
    }

    const proxyUrl = request.headers.get("x-proxy-url") || new URL(request.url).searchParams.get("url");

    if (!proxyUrl) {
        return new Response("Missing x-proxy-url header or url param", { status: 400 });
    }

    try {
        const method = request.method;
        const headers = new Headers(request.headers);

        // Clean up headers that shouldn't be forwarded to the target
        headers.delete("host");
        headers.delete("x-proxy-url");
        headers.delete("cf-connecting-ip");
        headers.delete("cf-ray");
        headers.delete("cf-visitor");
        headers.delete("cf-ipcountry");
        headers.delete("x-real-ip");
        headers.delete("content-length"); // Fetch will recalculate

        const body = method !== "GET" && method !== "HEAD" ? await request.arrayBuffer() : null;

        console.log(`[Proxy] Forwarding ${method} to ${proxyUrl}`);

        const response = await fetch(proxyUrl, {
            method,
            headers,
            body,
            redirect: "follow",
        });

        const responseHeaders = new Headers(response.headers);
        // Allow the browser to read the response
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (err: any) {
        return new Response(`Proxy Error: ${err.message}`, { status: 500 });
    }
};
