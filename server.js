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
    const { message, userName, chatHistory, personality } = req.body;
    console.log('Received request:', {
      message,
      userName,
      chatHistoryLength: chatHistory?.length,
      personality: personality?.substring(0, 100) + '...' // 只記錄前100個字元
    });

    // 檢查必要參數
    if (!message || !userName || !personality) {
      throw new Error('Missing required parameters');
    }

    // 準備對話歷史
    const recentMessages = chatHistory
      .slice(-20)
      .map(msg => ({
        role: msg.is_user ? "user" : "assistant",
        content: msg.content
      }));

    // 記錄實際發送給 OpenAI 的訊息
    console.log('Sending to OpenAI:', {
      model: "gpt-3.5-turbo",
      systemMessage: personality,
      messageCount: recentMessages.length + 2 // +2 for system and user message
    });

    // 呼叫 OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          "role": "system",
          "content": personality
        },
        ...recentMessages,
        {
          "role": "user",
          "content": `使用者 ${userName} 說: ${message}`
        }
      ],
      temperature: 0.9,
      max_tokens: 800
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
