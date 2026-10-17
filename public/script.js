const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const SOCKET_URL = `${protocol}://${location.host}`;

const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username');
const joinError = document.getElementById('join-error');
const usersList = document.getElementById('users');
const messagesList = document.getElementById('messages');
const typingLine = document.getElementById('typing');
const statusLabel = document.getElementById('status');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

const COLORS = ['#c2410c', '#0f766e', '#7c3aed', '#be185d', '#1d4ed8', '#4d7c0f'];

let socket;
let myName = '';
let typing = false;
let typingTimer;

function colorFor(name) {
  let sum = 0;
  for (const letter of name) sum += letter.charCodeAt(0);
  return COLORS[sum % COLORS.length];
}

function send(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function setOnline(isOnline) {
  statusLabel.textContent = isOnline ? 'Connected' : 'Reconnecting…';
  statusLabel.className = isOnline ? '' : 'offline';
  messageInput.disabled = !isOnline;
  sendButton.disabled = !isOnline;
}

function connect() {
  socket = new WebSocket(SOCKET_URL);

  socket.addEventListener('open', () => {
    send({ type: 'join', username: myName || usernameInput.value });
  });

  socket.addEventListener('message', handleMessage);

  socket.addEventListener('error', () => {
    if (!myName) joinError.textContent = 'Could not connect to the server.';
  });

  socket.addEventListener('close', () => {
    if (!myName) return;
    setOnline(false);
    typingLine.textContent = '';
    setTimeout(connect, 2000);
  });
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  joinError.textContent = '';
  connect();
});

function handleMessage(event) {
  const data = JSON.parse(event.data);

  if (data.type === 'joined') {
    myName = data.username;
    messagesList.innerHTML = '';
    data.history.forEach(addMessage);
    joinScreen.hidden = true;
    chatScreen.hidden = false;
    setOnline(true);
    messageInput.focus();
  } else if (data.type === 'error') {
    joinError.textContent = data.message;
    socket.close();
  } else if (data.type === 'users') {
    showUsers(data.users);
  } else if (data.type === 'typing') {
    showTyping(data.users);
  } else if (data.type === 'system') {
    addSystem(data.text);
  } else if (data.type === 'message') {
    addMessage(data);
  }
}

function showUsers(users) {
  usersList.innerHTML = '';
  users.forEach((name) => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = colorFor(name);
    li.append(dot, name === myName ? `${name} (you)` : name);
    usersList.append(li);
  });
}

function showTyping(names) {
  if (names.length === 0) typingLine.textContent = '';
  else if (names.length === 1) typingLine.textContent = `${names[0]} is typing…`;
  else if (names.length === 2) typingLine.textContent = `${names[0]} and ${names[1]} are typing…`;
  else typingLine.textContent = 'Several people are typing…';
}

function addSystem(text) {
  const li = document.createElement('li');
  li.className = 'system';
  li.textContent = text;
  messagesList.append(li);
  scrollToBottom();
}

function addMessage({ username, text, time }) {
  const mine = username === myName;
  const li = document.createElement('li');
  li.className = mine ? 'message mine' : 'message';

  const who = document.createElement('strong');
  who.textContent = mine ? 'You' : username;
  if (!mine) who.style.color = colorFor(username);

  const clock = new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.append(who, ` · ${clock}`);

  const body = document.createElement('p');
  body.textContent = text;

  li.append(meta, body);
  messagesList.append(li);
  scrollToBottom();
}

function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

function stopTyping() {
  clearTimeout(typingTimer);
  if (typing) {
    typing = false;
    send({ type: 'typing', isTyping: false });
  }
}

messageInput.addEventListener('input', () => {
  if (messageInput.value === '') return stopTyping();
  if (!typing) {
    typing = true;
    send({ type: 'typing', isTyping: true });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 2000);
});

messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  send({ type: 'message', text });
  messageInput.value = '';
  stopTyping();
});