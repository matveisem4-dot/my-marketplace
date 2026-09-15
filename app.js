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
  alert('Настройки сохранены');
  checkState();
}

function checkState() {
  if (config.owner) document.getElementById('gh-owner').value = config.owner;
  if (config.repo) document.getElementById('gh-repo').value = config.repo;
  if (config.token) document.getElementById('gh-token').value = config.token;
  if (config.adminEmail) document.getElementById('admin-email-input').value = config.adminEmail;

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
    
    document.getElementById('user-email-display').innerText = `${currentUser.email} (${currentUser.role === 'admin' ? 'Админ' : 'Клиент'})`;

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
  const email = document.getElementById('auth-email').value.trim();
  if (!email) return alert('Введите email');

  const btn = document.getElementById('btn-request');
  btn.disabled = true;
  btn.innerText = 'Запуск GitHub Actions...';

  currentSentToken = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/dispatches`;
    const response = await fetch(url, {
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

    if (response.status === 204) {
      alert('Запрос успешно отправлен! Проверьте вкладку Actions в GitHub.');
      document.getElementById('step-1').classList.add('hidden');
      document.getElementById('step-2').classList.remove('hidden');
    } else {
      const err = await response.json().catch(() => ({ message: 'Ошибка сети / Доступ запрещен' }));
      alert(`Ошибка GitHub API [Код ${response.status}]: ${err.message}`);
    }
  } catch (e) {
    alert(`Ошибка отправки: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Получить код в письме';
  }
}

function verifyToken() {
  const email = document.getElementById('auth-email').value.trim();
  const token = document.getElementById('auth-token').value.trim();

  if (token === currentSentToken) {
    const role = (email.toLowerCase() === config.adminEmail.toLowerCase()) ? 'admin' : 'user';
    currentUser = { email, role };
    localStorage.setItem('user', JSON.stringify(currentUser));
    checkState();
  } else {
    alert('Неверный код из письма');
  }
}

async function createOrder() {
  const title = document.getElementById('order-title').value.trim();
  const description = document.getElementById('order-desc').value.trim();

  if (!title || !description) return alert('Заполните все поля');

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
  } else {
    const err = await response.json();
    alert(`Ошибка создания заказа: ${err.message}`);
  }
}

async function loadOrders() {
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues?labels=order&state=all`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!response.ok) return;

  const issues = await response.json();
  const container = document.getElementById('orders-list');
  container.innerHTML = '';

  if (issues.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Заказов пока нет</p>';
    return;
  }

  issues.forEach(issue => {
    const isClientOrder = issue.body.includes(`**Клиент:** ${currentUser.email}`);
    if (currentUser.role === 'admin' || isClientOrder) {
      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `
        <div class="order-info">
          <h4>${issue.title} <small style="color:var(--text-muted)">#${issue.number}</small></h4>
          <p>${issue.body.split('\n')[0]}</p>
        </div>
        <button onclick="openChat(${issue.number})" class="btn btn-secondary btn-sm">Открыть чат</button>
      `;
      container.appendChild(card);
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
    const isAdmin = c.body.includes('[ADMIN]');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isAdmin ? 'chat-bubble-admin' : 'chat-bubble-user'}`;
    bubble.innerText = c.body;
    msgBox.appendChild(bubble);
  });

  msgBox.scrollTop = msgBox.scrollHeight;
}

async function sendMessage() {
  const text = document.getElementById('chat-input').value.trim();
  if (!text || !activeIssueNumber) return;

  const formattedText = `[${currentUser.role.toUpperCase()}] ${currentUser.email}: ${text}`;

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
