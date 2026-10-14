const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const MAX_HISTORY = 50;
const history = []; // the last 50 messages, so new people can see what they missed

// Send a message to every connected client
function broadcast(data) {
  const text = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(text);
  });
}

function sendUserList() {
  const users = [...wss.clients].filter((c) => c.username).map((c) => c.username);
  broadcast({ type: 'users', users });
}

// Tell each person who ELSE is typing (not themselves)
function sendTyping() {
  wss.clients.forEach((client) => {
    if (client.readyState !== 1 || !client.username) return;
    const others = [...wss.clients]
      .filter((c) => c.typing && c.username !== client.username)
      .map((c) => c.username);
    client.send(JSON.stringify({ type: 'typing', users: others }));
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.type === 'join') {
      const name = String(data.username || '').trim().slice(0, 20);
      const taken = [...wss.clients].some(
        (c) => c.username && c.username.toLowerCase() === name.toLowerCase()
      );

      if (!name) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Please enter a name.' }));
      }
      if (taken) {
        return ws.send(JSON.stringify({ type: 'error', message: 'That name is already taken.' }));
      }

      ws.username = name;
      ws.send(JSON.stringify({ type: 'joined', username: name, history }));
      broadcast({ type: 'system', text: `${name} joined the chat` });
      sendUserList();
    }

    if (data.type === 'typing' && ws.username) {
      ws.typing = data.isTyping === true;
      sendTyping();
    }

    if (data.type === 'message' && ws.username) {
      const text = String(data.text || '').trim().slice(0, 500);
      if (text) {
        const message = { type: 'message', username: ws.username, text, time: Date.now() };
        history.push(message);
        if (history.length > MAX_HISTORY) history.shift();

        ws.typing = false;
        broadcast(message);
        sendTyping();
      }
    }
  });

  ws.on('close', () => {
    if (ws.username) {
      broadcast({ type: 'system', text: `${ws.username} left the chat` });
      sendUserList();
      sendTyping();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));