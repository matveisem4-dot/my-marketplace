const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@master.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // Формат: "owner/repo"

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Хранилище файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// База данных в памяти
const users = {}; 
const orders = []; 

// Запуск GitHub Actions для отправки Email
async function sendEmailViaGitHubActions(email, token) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.log(`[DEV MODE] GitHub Token/Repo не указаны. Код для ${email}: ${token}`);
    return;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NodeJS-Server'
      },
      body: JSON.stringify({
        event_type: 'send_verification',
        client_payload: {
          to_email: email,
          token: token
        }
      })
    });

    if (!response.ok) {
      console.error('Ошибка отправки события в GitHub Actions:', await response.text());
    }
  } catch (err) {
    console.error('Ошибка при обращении к GitHub API:', err);
  }
}

// 1. Запрос кода авторизации
app.post('/api/auth/register', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Укажите email' });

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const role = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'user';

  users[email] = {
    email,
    verified: false,
    token,
    role
  };

  await sendEmailViaGitHubActions(email, token);

  res.json({ message: 'Код подтверждения отправлен на вашу почту через GitHub Actions', email });
});

// 2. Проверка кода и вход
app.post('/api/auth/verify', (req, res) => {
  const { email, token } = req.body;
  const user = users[email];

  if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
  if (user.token !== token) return res.status(400).json({ error: 'Неверный код' });

  user.verified = true;
  res.json({
    message: 'Успешный вход',
    email: user.email,
    role: user.role
  });
});

// 3. Получение списка заказов
app.get('/api/orders', (req, res) => {
  const { email } = req.query;
  const user = users[email];

  if (!user || !user.verified) {
    return res.status(401).json({ error: 'Авторизуйтесь' });
  }

  // Если Админ — отдает все заказы, если обычный юзер — только его заказы
  if (user.role === 'admin') {
    return res.json(orders);
  } else {
    const userOrders = orders.filter(o => o.clientEmail === email);
    return res.json(userOrders);
  }
});

// 4. Создание заказа (Клиент)
app.post('/api/orders', (req, res) => {
  const { email, title, description } = req.body;
  const user = users[email];

  if (!user || !user.verified) {
    return res.status(401).json({ error: 'Авторизуйтесь' });
  }

  const newOrder = {
    id: Date.now().toString(),
    clientEmail: email,
    title,
    description,
    status: 'В процессе',
    messages: [],
    fileUrl: null
  };

  orders.push(newOrder);
  res.json(newOrder);
});

// 5. Отправка сообщений в чате
app.post('/api/orders/:id/messages', (req, res) => {
  const { id } = req.params;
  const { email, text } = req.body;
  const user = users[email];

  if (!user || !user.verified) {
    return res.status(401).json({ error: 'Авторизуйтесь' });
  }

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (user.role !== 'admin' && order.clientEmail !== email) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const msg = {
    sender: user.role === 'admin' ? 'Администратор' : email,
    role: user.role,
    text,
    timestamp: new Date().toLocaleTimeString()
  };

  order.messages.push(msg);
  res.json(msg);
});

// 6. Загрузка готового файла и завершение заказа (Только Админ)
app.post('/api/orders/:id/upload', upload.single('file'), (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  const user = users[email];

  if (!user || !user.verified || user.role !== 'admin') {
    return res.status(403).json({ error: 'Только администратор может отправлять файлы' });
  }

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

  order.fileUrl = `/uploads/${req.file.filename}`;
  order.status = 'Завершен';

  order.messages.push({
    sender: 'Система',
    role: 'system',
    text: `Файл проекта успешно отправлен: ${req.file.originalname}`,
    timestamp: new Date().toLocaleTimeString()
  });

  res.json({ message: 'Файл успешно отправлен клиенту', fileUrl: order.fileUrl });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
