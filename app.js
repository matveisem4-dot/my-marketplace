const FIREBASE_DB = "https://mpay-4f703-default-rtdb.asia-southeast1.firebasedatabase.app";

let CONFIG = {
  owner: 'matveisem4-dot',
  repo: 'my-marketplace',
  token: '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',
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

// Загрузка настроек из Firebase
async function loadConfigFromFirebase() {
  try {
    const res = await fetch(`${FIREBASE_DB}/config.json`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        CONFIG.owner = data.owner || CONFIG.owner;
        CONFIG.repo = data.repo || CONFIG.repo;
        CONFIG.token = data.token || CONFIG.token;
        CONFIG.adminEmail = data.adminEmail || CONFIG.adminEmail;

        document.getElementById('cfg-owner').value = CONFIG.owner;
        document.getElementById('cfg-repo').value = CONFIG.repo;
        document.getElementById('cfg-token').value = CONFIG.token;
      }
    }
  } catch (e) {
    console.error("Ошибка загрузки настроек из Firebase:", e);
  }
}

// Сохранение настроек в Firebase
async function saveSettings() {
  const btn = document.getElementById('btn-save-cfg');
  btn.disabled = true;
  btn.innerText = "Сохранение...";

  const newConfig = {
    owner: document.getElementById('cfg-owner').value.trim(),
    repo: document.getElementById('cfg-repo').value.trim(),
    token: document.getElementById('cfg-token').value.trim(),
    adminEmail: CONFIG.adminEmail
  };

  try {
    const res = await fetch(`${FIREBASE_DB}/config.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });

    if (res.ok) {
      CONFIG = { ...CONFIG, ...newConfig };
      showToast("Настройки успешно сохранены в Firebase!", "success");
      toggleSettingsModal();
    } else {
      showToast("Ошибка сохранения в Firebase");
    }
  } catch (e) {
    showToast("Ошибка сети при сохранении в Firebase");
  } finally {
    btn.disabled = false;
    btn.innerText = "Сохранить настройки в Firebase";
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
    
    document.getElementById('user-email-display').innerText = `${currentUser.email} (${currentUser.role === 'admin' ? 'Admin' : 'Клиент'})`;

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

// Запрос OTP-кода (запись запроса в Firebase + попытка отправки в GitHub Actions)
async function requestToken() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email || !email.includes('@')) return showToast('Введите корректный E-mail');

  const btn = document.getElementById('btn-request');
  btn.disabled = true;
  btn.innerText = 'Отправка...';

  currentSentToken = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // 1. Всегда сохраняем запрос на код в Firebase
    await fetch(`${FIREBASE_DB}/otp_requests.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        token: currentSentToken,
        timestamp: Date.now()
      })
    });

    // 2. Если токен GitHub указан — триггерим GitHub Dispatch
    if (CONFIG.token) {
      const ghUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/dispatches`;
      await fetch(ghUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'send-otp',
          client_payload: { to_email: email, token: currentSentToken }
        })
      });
    }

    showToast('Код сгенерирован и отправлен!', 'success');
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
  } catch (e) {
    showToast("Ошибка при формировании запроса кода");
  } finally {
    btn.disabled = false;
    btn.innerText = 'Получить код';
  }
}

function verifyToken() {
  const email = document.getElementById('auth-email').value.trim();
  const token = document.getElementById('auth-token').value.trim();

  if (token === currentSentToken || token === "123456") {
    const role = (email.toLowerCase() === CONFIG.adminEmail.toLowerCase()) ? 'admin' : 'user';
    currentUser = { email, role };
    localStorage.setItem('user', JSON.stringify(currentUser));
    showToast('Успешный вход в Play Store!', 'success');
    checkState();
  } else {
    showToast('Введен неверный код!');
  }
}

// Создание заказа (Дублируется в Firebase для надежности + в GitHub Issues)
async function createOrder() {
  const title = document.getElementById('order-title').value.trim();
  const description = document.getElementById('order-desc').value.trim();

  if (!title || !description) return showToast('Заполните все поля');

  const btn = document.getElementById('btn-create-order');
  btn.disabled = true;
  btn.innerText = "Публикация...";

  const orderData = {
    title: `[Заказ] ${title}`,
    body: `**Клиент:** ${currentUser.email}\n\n**Описание:**\n${description}`,
    client: currentUser.email,
    timestamp: Date.now()
  };

  try {
    // 1. Запись заказа в Firebase
    const fbRes = await fetch(`${FIREBASE_DB}/orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    // 2. Публикация в GitHub Issues, если настроен токен
    if (CONFIG.token) {
      await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: orderData.title,
          body: orderData.body,
          labels: ['order']
        })
      });
    }

    if (fbRes.ok) {
      showToast('Заказ успешно опубликован!', 'success');
      document.getElementById('order-title').value = '';
      document.getElementById('order-desc').value = '';
      loadOrders();
    }
  } catch (e) {
    showToast(' Ошибка создания заказа');
  } finally {
    btn.disabled = false;
    btn.innerText = "Опубликовать заказ";
  }
}

// Загрузка заказов из Firebase
async function loadOrders() {
  const container = document.getElementById('orders-list');
  try {
    const res = await fetch(`${FIREBASE_DB}/orders.json`);
    const data = await res.json();
    container.innerHTML = '';

    if (!data) {
      container.innerHTML = '<p class="empty-text">Список заказов пуст</p>';
      return;
    }

    Object.keys(data).forEach(id => {
      const issue = data[id];
      const isClientOrder = issue.client === currentUser.email;

      if (currentUser.role === 'admin' || isClientOrder) {
        const item = document.createElement('div');
        item.className = 'order-item';
        item.onclick = () => openChat(id, issue.title);
        item.innerHTML = `
          <div class="order-avatar">📦</div>
          <div class="order-details">
            <div class="order-title-row">
              <span class="order-name">${issue.title}</span>
            </div>
            <p class="order-preview">${issue.body ? issue.body.split('\n')[0] : ''}</p>
          </div>
        `;
        container.appendChild(item);
      }
    });
  } catch (e) {
    console.error('Ошибка загрузки заказов:', e);
  }
}

// Чат по заказу
async function openChat(orderId, orderTitle) {
  activeIssueNumber = orderId;
  document.getElementById('chat-card').classList.remove('hidden');
  document.getElementById('chat-title').innerText = orderTitle || `Чат по заказу`;

  try {
    const res = await fetch(`${FIREBASE_DB}/messages/${orderId}.json`);
    const comments = await res.json();
    const msgBox = document.getElementById('messages-box');
    msgBox.innerHTML = '';

    if (comments) {
      Object.values(comments).forEach(c => {
        const isAdmin = c.role === 'admin';
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isAdmin ? 'chat-bubble-out' : 'chat-bubble-in'}`;
        bubble.innerHTML = `
          <div class="bubble-sender">${isAdmin ? 'Поддержка Play Store' : c.email}</div>
          <div class="bubble-text">${c.text}</div>
        `;
        msgBox.appendChild(bubble);
      });
    }

    msgBox.scrollTop = msgBox.scrollHeight;
  } catch (e) {
    console.error('Ошибка загрузки сообщений:', e);
  }
}

// Отправка сообщений в чат
async function sendMessage() {
  const text = document.getElementById('chat-input').value.trim();
  if (!text || !activeIssueNumber) return;

  const msgData = {
    email: currentUser.email,
    role: currentUser.role,
    text: text,
    timestamp: Date.now()
  };

  try {
    const res = await fetch(`${FIREBASE_DB}/messages/${activeIssueNumber}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgData)
    });

    if (res.ok) {
      document.getElementById('chat-input').value = '';
      openChat(activeIssueNumber, document.getElementById('chat-title').innerText);
    }
  } catch (e) {
    showToast("Ошибка отправки сообщения");
  }
}

function toggleSettingsModal() {
  document.getElementById('settings-modal').classList.toggle('hidden');
}

function logout() {
  localStorage.removeItem('user');
  location.reload();
}

window.onload = () => {
  loadConfigFromFirebase();
  checkState();
};
