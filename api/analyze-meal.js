export default async function handler(req, res) {
  // POSTメソッド以外を弾く
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageUrl, memo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!imageUrl) return res.status(400).json({ error: 'Image URL is missing' });
    if (!apiKey) return res.status(500).json({ error: 'Gemini API Key is not set in Vercel' });

    // 1. Supabaseから画像を高速取得
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
       return res.status(500).json({ error: 'Failed to fetch image from Supabase' });
    }
    
    // 超高速かつ安定した標準の画像データ変換
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // 2. プロンプトの構築
    const prompt = `この食事の画像から、以下の2点を推測して厳密なJSON形式のみで返してください。
1. calories: 推定される合計カロリー（数値のみ）
2. analysis: 含まれる主要な栄養素（PFCバランスなど）や健康への影響に関するプロフェッショナルな一言コメント（日本語で100文字程度）。ユーザーが入力したメモ「${memo || ''}」がある場合は、それも考慮してください。
出力フォーマット: {"calories": 500, "analysis": "..."}`;

    // ★唯一にして最大の修正箇所：シャットダウンされた1.5から、最新の「gemini-2.0-flash」へURLを変更
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    // 3. Gemini APIへ送信
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    });

    const geminiData = await geminiRes.json();
    
    // エラーハンドリング
    if (!geminiRes.ok || geminiData.error) {
        return res.status(500).json({ 
            error: 'Gemini API Error', 
            details: geminiData.error ? geminiData.error.message : 'Unknown Error' 
        });
    }

    // 4. 解析結果の抽出
    let aiText = geminiData.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(aiText);

    // 成功としてフロントエンドに返す
    return res.status(200).json(result);

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
