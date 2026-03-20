export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageUrl, memo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!imageUrl) return res.status(400).json({ error: 'Image URL is missing' });
    if (!apiKey) return res.status(500).json({ error: 'Gemini API Key is not set in Vercel' });

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return res.status(500).json({ error: 'Failed to fetch image' });
    
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `この食事の画像から、以下の2点を推測して厳密なJSON形式のみで返してください。
1. calories: 推定される合計カロリー（数値のみ）
2. analysis: 栄養素や健康への影響に関するコメント（日本語100文字程度）。メモ「${memo || ''}」も考慮してください。
出力フォーマット: {"calories": 500, "analysis": "..."}`;

    // 安定性の高い 1.5-flash を使用
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
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
    
    if (!geminiRes.ok) {
        return res.status(500).json({ 
            error: 'Gemini API Error', 
            details: geminiData.error ? geminiData.error.message : 'Unknown Error',
            key_used: apiKey.substring(0, 8) + "..." // どの鍵が使われているか確認用
        });
    }

    let aiText = geminiData.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    return res.status(200).json(JSON.parse(aiText));

  } catch (error) {
    return res.status(500).json({ error: 'Server Error', message: error.message });
  }
}
