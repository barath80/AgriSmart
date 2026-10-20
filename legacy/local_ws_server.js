// Simple WebSocket relay server for local testing
// Usage: node local_ws_server.js [port]
// Install dependency: npm install ws
const WebSocket = require('ws');
const port = parseInt(process.argv[2], 10) || 8080;
const wss = new WebSocket.Server({ port });
console.log(`WebSocket relay server listening on ws://0.0.0.0:${port}`);

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).slice(2, 9);
  ws.clientId = clientId;
  console.log('Client connected', clientId, req.socket.remoteAddress);

  ws.on('message', (data) => {
    try {
      const msg = typeof data === 'string' ? data : data.toString('utf8');
      console.log('Received from', clientId, msg);
      // broadcast to all other clients
      wss.clients.forEach((c) => {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          c.send(msg);
        }
      });
    } catch (err) {
      console.error('Error handling message', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected', clientId);
  });
});
