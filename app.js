let config = JSON.parse(localStorage.getItem('gh_config') || '{}');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let currentSentToken = null;
let activeIssueNumber = null;

function saveConfig() {
  config = {
    owner: document.getElementById('gh-owner').value.trim(),
    repo: document.getElementById('gh-repo').value.trim(),
    token: document.getElementById('gh-token').value.trim(),
    adminEmail: document.getElementById('admin-email-input').value.trim()
  };
  localStorage.setItem('gh_config', JSON.stringify(config));
  alert('Конфигурация сохранена');
  checkState();
}

function checkState() {
  if (!config.token || !config.owner || !config.repo) {
    document.getElementById('config-section').classList.remove('hidden');
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    return;
  }
  document.getElementById('config-section').classList.add('hidden');

  if (!currentUser) {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
  } else {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('user-email-display').innerText = `${currentUser.email} [${currentUser.role.toUpperCase()}]`;

    if (currentUser.role === 'admin') {
      document.getElementById('admin-banner').classList.remove('hidden');
      document.getElementById('client-controls').classList.add('hidden');
    } else {
      document.getElementById('admin-banner').classList.add('hidden');
      document.getElementById('client-controls').classList.remove('hidden');
    }
    loadOrders();
  }
}

async function requestToken() {
  const email = document.getElementById('auth-email').value;
  if (!email) return alert('Введите email');

  currentSentToken = Math.floor(100000 + Math.random() * 900000).toString();

  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event_type: 'send_verification',
      client_payload: { to_email: email, token: currentSentToken }
    })
  });

  if (response.ok) {
    alert('GitHub Actions запущен для отправки письма!');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
  } else {
    alert('Ошибка вызова GitHub Actions API');
  }
}

function verifyToken() {
  const email = document.getElementById('auth-email').value;
  const token = document.getElementById('auth-token').value;

  if (token === currentSentToken) {
    const role = (email.toLowerCase() === config.adminEmail.toLowerCase()) ? 'admin' : 'user';
    currentUser = { email, role };
    localStorage.setItem('user', JSON.stringify(currentUser));
    checkState();
  } else {
    alert('Неверный код');
  }
}

async function createOrder() {
  const title = document.getElementById('order-title').value;
  const description = document.getElementById('order-desc').value;

  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `[Заказ] ${title}`,
      body: `**Клиент:** ${currentUser.email}\n\n**Описание:**\n${description}`,
      labels: ['order']
    })
  });

  if (response.ok) {
    document.getElementById('order-title').value = '';
    document.getElementById('order-desc').value = '';
    loadOrders();
  }
}

async function loadOrders() {
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues?labels=order&state=all`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  const issues = await response.json();
  const container = document.getElementById('orders-list');
  container.innerHTML = '';

  issues.forEach(issue => {
    const isClientOrder = issue.body.includes(`**Клиент:** ${currentUser.email}`);
    if (currentUser.role === 'admin' || isClientOrder) {
      const item = document.createElement('div');
      item.className = 'order-item';
      item.innerHTML = `
        <div>
          <strong>${issue.title}</strong> (#${issue.number})
          <p>${issue.body.replace(/\n/g, '<br>')}</p>
        </div>
        <button onclick="openChat(${issue.number})">Открыть чат</button>
      `;
      container.appendChild(item);
    }
  });
}

async function openChat(issueNumber) {
  activeIssueNumber = issueNumber;
  document.getElementById('chat-card').classList.remove('hidden');
  document.getElementById('chat-title').innerText = `Чат по заказу #${issueNumber}`;

  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  const comments = await response.json();

  const msgBox = document.getElementById('messages-box');
  msgBox.innerHTML = '';
  comments.forEach(c => {
    const d = document.createElement('div');
    d.className = 'msg user-msg';
    d.innerText = `[${new Date(c.created_at).toLocaleTimeString()}] ${c.body}`;
    msgBox.appendChild(d);
  });
}

async function sendMessage() {
  const text = document.getElementById('chat-input').value;
  if (!text || !activeIssueNumber) return;

  const formattedText = `**[${currentUser.role.toUpperCase()}] ${currentUser.email}:** ${text}`;

  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues/${activeIssueNumber}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ body: formattedText })
  });

  if (response.ok) {
    document.getElementById('chat-input').value = '';
    openChat(activeIssueNumber);
  }
}

function logout() {
  localStorage.removeItem('user');
  location.reload();
}

window.onload = checkState;
