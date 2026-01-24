
export const onRequest = async ({ request }) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
        return new Response('Missing token', { status: 400 });
    }

    // Cloudflare Workers WebSocket proxy logic
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Rewrite the URL to DashScope
    const dashscopeUrl = new URL('wss://dashscope.aliyuncs.com' + url.pathname.replace('/api/qwen-ws', '/api-ws') + url.search);

    // Set up the Authorization header
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);

    try {
        // Fetch with upgrade: 'websocket'
        const response = await fetch(dashscopeUrl.toString(), {
            headers: headers,
            webSocket: true as any, // This is a special CF property
        } as any);

        const clientWS = response.webSocket;
        if (!clientWS) {
            return new Response('Failed to establish WebSocket connection to DashScope', { status: 1011 });
        }

        // Pair the client and server WebSockets
        const [client, server] = new WebSocketPair();

        (server as any).accept();

        // Relay messages
        server.addEventListener('message', event => {
            clientWS.send(event.data);
        });

        clientWS.addEventListener('message', event => {
            server.send(event.data);
        });

        server.addEventListener('close', () => {
            clientWS.close();
        });

        clientWS.addEventListener('close', () => {
            server.close();
        });

        // Also handle errors
        server.addEventListener('error', () => {
            clientWS.close();
        });

        clientWS.addEventListener('error', () => {
            server.close();
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    } catch (err) {
        return new Response(`WebSocket Error: ${err.message}`, { status: 500 });
    }
};
