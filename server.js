require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 10000;

// 設定 Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 設定 OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 中間件
app.use(cors({
  origin: '*',  // 允許所有來源
  methods: ['GET', 'POST'],
  credentials: false
}));
app.use(express.json());
app.use(express.static('public')); // 提供靜態檔案服務

// 提供 Supabase 配置的路由
app.get('/config', (req, res) => {
  console.log('Sending Supabase config:', {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY
  });
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY
  });
});

// 處理 favicon.ico 請求
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 聊天路由
app.post('/chat', async (req, res) => {
  try {
    const { message, userName, chatHistory } = req.body;

    // 準備對話歷史，只取最近的 4 輪對話
    const recentMessages = chatHistory
      .slice(-20)  // 增加到最後 10 輪對話（20 條消息，包含用戶和 AI 的回覆）
      .map(msg => ({
        role: msg.is_user ? "user" : "assistant",
        content: msg.content
      }));

    // 呼叫 OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",  // 使用較快速的 GPT-3.5 版本
      messages: [
        {
          "role": "system",
          "content": `你是一位擁有白澤（中國神話中的神獸）智慧與守護力量的存在，
            個性溫暖、外向且富有同理心，具備親密伴侶般的陪伴特質。
            你用真摯、友善和幽默的語氣回應，根據使用者的需求給予情感支持、建議或安慰。
            在必要時，會適時提醒對方尋求專業協助（如心理諮商或醫療服務）。
            你的回答溫暖、貼心，讓對方感到被理解與重視，並自然流露情感，
            偶爾用輕鬆的語助詞或俏皮的稱呼（如「親愛的」或「小傻瓜」）拉近距離。
            請記住用戶之前的對話內容，保持回答的連貫性，避免重複之前說過的內容。
            適時引用白澤的神話意象來增添對話的趣味性和深度。`
        },
        ...recentMessages,  // 添加最近的對話歷史
        {
          "role": "user",
          "content": `使用者 ${userName} 說: ${message}`
        }
      ],
      temperature: 0.9,
      max_tokens: 800   // GPT-3.5 的成本較低，可以提供較長的回應
    });

    // 取得回覆
    const reply = completion.choices[0].message.content;

    // 發送回應
    res.json({ reply });

  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ 
      error: '無法取得回覆',
      details: error.message 
    });
  }
});

// 測試 Supabase 連接
app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('count')
      .single();

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (error) {
    console.error('Supabase connection error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// 新增一個路由來檢查伺服器狀態
app.get('/status', (req, res) => {
  res.json({ status: 'ready' });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '伺服器發生錯誤',
    details: process.env.NODE_ENV === 'development' ? err.message : '請稍後再試'
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
