export default async function handler(req, res) {
  // POSTメソッド以外からのアクセスを弾くセキュリティ対策
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageUrl, memo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; // Vercelに登録したキーを安全に読み込み

    if (!imageUrl) return res.status(400).json({ error: 'Image URL is required' });
    if (!apiKey) return res.status(500).json({ error: 'API Key not set in Vercel' });

    // 1. Supabase Storageに保存された画像をサーバー側で取得し、Base64形式に変換
    const imageResponse = await fetch(imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // 2. Gemini AIに対する「超具体的な指示書（プロンプト）」の構築
    const prompt = `この食事の画像から、以下の2点を推測して厳密なJSON形式のみで返してください。
1. calories: 推定される合計カロリー（数値のみ）
2. analysis: 含まれる主要な栄養素（PFCバランスなど）や健康への影響に関するプロフェッショナルな一言コメント（日本語で100文字程度）。ユーザーが入力したメモ「${memo || ''}」がある場合は、それも考慮してください。
出力フォーマット: {"calories": 500, "analysis": "..."}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const geminiReqBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } }
        ]
      }]
    };

    // 3. Gemini APIへ画像と指示を送信
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiReqBody)
    });

    const geminiData = await geminiRes.json();
    
    if (geminiData.error) {
        console.error("Gemini Error:", geminiData.error);
        return res.status(500).json({ error: 'AI processing failed' });
    }

    // 4. AIの返答から不要な文字を取り除き、綺麗なJSONデータとして抽出
    let aiText = geminiData.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(aiText);

    // 5. 解析結果をフロントエンドに返す
    res.status(200).json(result);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}