
export const onRequest = async ({ request }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    console.log(`[Qwen Proxy] Incoming request: ${url.pathname}`);

    if (!token) {
        return new Response('Missing token', { status: 400 });
    }

    // Handle WebSocket upgrade check
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Calculate the target path
    // If the request is /api/qwen-ws/v1/realtime, we change it to /api-ws/v1/realtime
    const targetPath = url.pathname.replace('/api/qwen-ws', '/api-ws');
    const dashscopeUrl = new URL(`wss://dashscope.aliyuncs.com${targetPath}${url.search}`);

    console.log(`[Qwen Proxy] Rewriting to DashScope: ${dashscopeUrl.toString()}`);

    try {
        // Explicitly set headers for outbound WS connection
        const headers = new Headers();
        headers.set('Upgrade', 'websocket');
        headers.set('Connection', 'Upgrade');
        headers.set('Authorization', `Bearer ${token}`);

        const response = await fetch(dashscopeUrl.toString(), {
            headers,
            webSocket: true as any,
        } as any);

        const dsWS = response.webSocket;
        if (!dsWS) {
            console.error('[Qwen Proxy] DashScope did not return a WebSocket');
            return new Response('Failed to establish WebSocket connection to DashScope', { status: 502 });
        }

        // Pair the client and server WebSockets for CF Worker lifecycle
        const [client, server] = new WebSocketPair();
        (server as any).accept();
        dsWS.accept();

        // Bidirectional message relay
        server.addEventListener('message', event => {
            dsWS.send(event.data);
        });
        dsWS.addEventListener('message', event => {
            server.send(event.data);
        });

        server.addEventListener('close', () => {
            dsWS.close();
            server.close();
        });
        dsWS.addEventListener('close', () => {
            server.close();
            dsWS.close();
        });

        server.addEventListener('error', e => {
            console.error('[Qwen Proxy] Client WebSocket error:', e);
            dsWS.close();
        });
        dsWS.addEventListener('error', e => {
            console.error('[Qwen Proxy] DashScope WebSocket error:', e);
            server.close();
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    } catch (err: any) {
        console.error(`[Qwen Proxy] Exception: ${err.message}`);
        return new Response(`WebSocket Proxy Error: ${err.message}`, { status: 500 });
    }
};
