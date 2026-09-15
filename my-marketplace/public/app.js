let currentUser = null;
let activeOrderId = null;

async function requestToken() {
  const email = document.getElementById('auth-email').value;
  if (!email) return alert('Введите email');

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();

  if (res.ok) {
    alert(data.message);
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
  } else {
    alert(data.error);
  }
}

async function verifyToken() {
  const email = document.getElementById('auth-email').value;
  const token = document.getElementById('auth-token').value;

  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token })
  });
  const data = await res.json();

  if (res.ok) {
    currentUser = { email: data.email, role: data.role };
    localStorage.setItem('user', JSON.stringify(currentUser));
    initApp();
  } else {
    alert(data.error);
  }
}

function initApp() {
  const saved = localStorage.getItem('user');
  if (saved) currentUser = JSON.parse(saved);

  if (!currentUser) return;

  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('user-email-display').innerText = `${currentUser.email} [Роль: ${currentUser.role.toUpperCase()}]`;

  if (currentUser.role === 'admin') {
    document.getElementById('admin-banner').classList.remove('hidden');
    document.getElementById('client-controls').classList.add('hidden');
  } else {
    document.getElementById('client-controls').classList.remove('hidden');
    document.getElementById('admin-banner').classList.add('hidden');
  }

  loadOrders();
}

async function loadOrders() {
  const res = await fetch(`/api/orders?email=${encodeURIComponent(currentUser.email)}`);
  const orders = await res.json();

  const container = document.getElementById('orders-list');
  container.innerHTML = '';

  if (orders.length === 0) {
    container.innerHTML = '<p>Заказов не найдено.</p>';
    return;
  }

  orders.forEach(order => {
    const item = document.createElement('div');
    item.className = 'order-item';
    item.innerHTML = `
      <div>
        <strong>${order.title}</strong> [Статус: ${order.status}]
        <br><small>Клиент: ${order.clientEmail}</small>
        <p>${order.description}</p>
      </div>
      <button onclick="openChat('${order.id}')">Открыть чат</button>
    `;
    container.appendChild(item);
  });
}

async function createOrder() {
  const title = document.getElementById('order-title').value;
  const description = document.getElementById('order-desc').value;

  if (!title || !description) return alert('Заполните все поля');

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentUser.email, title, description })
  });

  if (res.ok) {
    document.getElementById('order-title').value = '';
    document.getElementById('order-desc').value = '';
    loadOrders();
  }
}

async function openChat(orderId) {
  activeOrderId = orderId;
  const res = await fetch(`/api/orders?email=${encodeURIComponent(currentUser.email)}`);
  const orders = await res.json();
  const order = orders.find(o => o.id === orderId);

  if (!order) return;

  document.getElementById('chat-card').classList.remove('hidden');
  document.getElementById('chat-title').innerText = `Чат по заказу: "${order.title}"`;
  document.getElementById('chat-status').innerText = `Клиент: ${order.clientEmail} | Статус: ${order.status}`;

  const msgBox = document.getElementById('messages-box');
  msgBox.innerHTML = '';
  order.messages.forEach(m => {
    const d = document.createElement('div');
    d.className = `msg ${m.role === 'admin' ? 'admin-msg' : m.role === 'system' ? 'system-msg' : 'user-msg'}`;
    d.innerText = `[${m.timestamp}] ${m.sender}: ${m.text}`;
    msgBox.appendChild(d);
  });

  if (currentUser.role === 'admin') {
    document.getElementById('admin-file-upload').classList.remove('hidden');
  } else {
    document.getElementById('admin-file-upload').classList.add('hidden');
  }

  if (order.fileUrl) {
    document.getElementById('client-file-download').classList.remove('hidden');
    document.getElementById('download-link').href = order.fileUrl;
  } else {
    document.getElementById('client-file-download').classList.add('hidden');
  }
}

async function sendMessage() {
  const text = document.getElementById('chat-input').value;
  if (!text || !activeOrderId) return;

  const res = await fetch(`/api/orders/${activeOrderId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentUser.email, text })
  });

  if (res.ok) {
    document.getElementById('chat-input').value = '';
    openChat(activeOrderId);
  }
}

async function uploadProjectFile() {
  const fileInput = document.getElementById('project-file');
  if (!fileInput.files[0] || !activeOrderId) return alert('Выберите файл');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('email', currentUser.email);

  const res = await fetch(`/api/orders/${activeOrderId}/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (res.ok) {
    alert('Файл передан клиенту!');
    openChat(activeOrderId);
    loadOrders();
  } else {
    alert(data.error);
  }
}

function logout() {
  localStorage.removeItem('user');
  location.reload();
}

window.onload = () => {
  if (localStorage.getItem('user')) initApp();
};
