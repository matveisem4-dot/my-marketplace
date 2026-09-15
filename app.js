const CONFIG = {
  owner: 'matveisem4-dot',
  repo: 'my-marketplace',
  // Убедитесь, что токен не публикуется открыто в репозитории, иначе GitHub автоматически аннулирует его
  token: 'github_pat_ВАШ_АКТУАЛЬНЫЙ_ТОКЕН', 
  adminEmail: 'admin@domain.com'
};

let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let currentSentToken = null;
let activeIssueNumber = null;

function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 10000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа от сервера');
    }
    throw new Error('Ошибка сети или доступа к GitHub API');
  }
}

function checkState() {
  if (!currentUser) {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
  } else {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('user-info').classList.remove('hidden');
    
    document.getElementById('user-email-display').innerText = `${currentUser.email} (${currentUser.role === 'admin' ? 'Admin' : 'Пользователь'})`;

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
  if (!email || !email.includes('@')) return showToast('Введите корректный E-mail');

  const btn = document.getElementById('btn-request');
  btn.disabled = true;
  btn.innerText = 'Отправка...';

  currentSentToken = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/dispatches`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: 'send-otp',
        client_payload: {
          to_email: email,
          token: currentSentToken
        }
      })
    });

    if (response.status === 204 || response.ok) {
      showToast('Код успешно отправлен на почту!', 'success');
      document.getElementById('step-1').classList.add('hidden');
      document.getElementById('step-2').classList.remove('hidden');
    } else {
      const err = await response.json().catch(() => ({}));
      showToast(`Ошибка запуска Actions [${response.status}]: ${err.message || 'Проверьте токен и доступ'}`);
    }
  } catch (e) {
    showToast(e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Получить код';
  }
}

function verifyToken() {
  const email = document.getElementById('auth-email').value.trim();
  const token = document.getElementById('auth-token').value.trim();

  if (token === currentSentToken) {
    const role = (email.toLowerCase() === CONFIG.adminEmail.toLowerCase()) ? 'admin' : 'user';
    currentUser = { email, role };
    localStorage.setItem('user', JSON.stringify(currentUser));
    showToast('Добро пожаловать в Play Store!', 'success');
    checkState();
  } else {
    showToast('Введен неверный код из письма');
  }
}

async function createOrder() {
  const title = document.getElementById('order-title').value.trim();
  const description = document.getElementById('order-desc').value.trim();

  if (!title || !description) return showToast('Заполните все поля');

  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
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
      showToast('Заказ успешно опубликован!', 'success');
      document.getElementById('order-title').value = '';
      document.getElementById('order-desc').value = '';
      loadOrders();
    } else {
      const err = await response.json();
      showToast(`Ошибка отправки заказа: ${err.message}`);
    }
  } catch (e) {
    showToast(e.message);
  }
}

async function loadOrders() {
  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/issues?labels=order&state=all`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) return;

    const issues = await response.json();
    const container = document.getElementById('orders-list');
    container.innerHTML = '';

    if (issues.length === 0) {
      container.innerHTML = '<p class="empty-text">Список заказов пуст</p>';
      return;
    }

    issues.forEach(issue => {
      const isClientOrder = issue.body.includes(`**Клиент:** ${currentUser.email}`);
      if (currentUser.role === 'admin' || isClientOrder) {
        const item = document.createElement('div');
        item.className = 'order-item';
        item.onclick = () => openChat(issue.number);
        item.innerHTML = `
          <div class="order-avatar">📦</div>
          <div class="order-details">
            <div class="order-title-row">
              <span class="order-name">${issue.title}</span>
              <span class="order-id">#${issue.number}</span>
            </div>
            <p class="order-preview">${issue.body.split('\n')[0]}</p>
          </div>
        `;
        container.appendChild(item);
      }
    });
  } catch (e) {
    console.error('Ошибка загрузки заказов:', e);
  }
}

async function openChat(issueNumber) {
  activeIssueNumber = issueNumber;
  document.getElementById('chat-card').classList.remove('hidden');
  document.getElementById('chat-title').innerText = `Чат по заказу #${issueNumber}`;

  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${issueNumber}/comments`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const comments = await response.json();
    const msgBox = document.getElementById('messages-box');
    msgBox.innerHTML = '';

    comments.forEach(c => {
      const isAdmin = c.body.includes('[ADMIN]');
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${isAdmin ? 'chat-bubble-out' : 'chat-bubble-in'}`;
      
      // Форматирование отображения
      const textContent = c.body.replace(/^\[(ADMIN|USER)\]\s*[^:]+:\s*/, '');
      bubble.innerHTML = `
        <div class="bubble-sender">${isAdmin ? 'Поддержка Play Store' : 'Заказчик'}</div>
        <div class="bubble-text">${textContent}</div>
      `;
      msgBox.appendChild(bubble);
    });

    msgBox.scrollTop = msgBox.scrollHeight;
  } catch (e) {
    console.error('Ошибка при загрузке сообщений:', e);
  }
}

async function sendMessage() {
  const text = document.getElementById('chat-input').value.trim();
  if (!text || !activeIssueNumber) return;

  const formattedText = `[${currentUser.role.toUpperCase()}] ${currentUser.email}: ${text}`;

  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${activeIssueNumber}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: formattedText })
    });

    if (response.ok) {
      document.getElementById('chat-input').value = '';
      openChat(activeIssueNumber);
    }
  } catch (e) {
    showToast(e.message);
  }
}

function logout() {
  localStorage.removeItem('user');
  location.reload();
}

window.onload = checkState;
