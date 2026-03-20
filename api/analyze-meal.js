// ★ Vercel Edge Runtime を明示的に指定することでエラーを防ぎ、超高速化します
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS対策とPOSTメソッド以外のブロック
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { imageUrl, memo } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!imageUrl) {
        return new Response(JSON.stringify({ error: 'Image URL is required' }), { status: 400 });
    }
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API Key not set' }), { status: 500 });
    }

    // 1. 画像の取得とBase64変換（Edge環境で絶対に動く書き方）
    const imageResponse = await fetch(imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    // Bufferを使わず、標準のbtoa関数を使用
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 2. プロンプトの構築
    const prompt = `この食事の画像から、以下の2点を推測して厳密なJSON形式のみで返してください。
1. calories: 推定される合計カロリー（数値のみ）
2. analysis: 含まれる主要な栄養素（PFCバランスなど）や健康への影響に関するプロフェッショナルな一言コメント（日本語で100文字程度）。ユーザーが入力したメモ「${memo || ''}」がある場合は、それも考慮してください。
出力フォーマット: {"calories": 500, "analysis": "..."}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    // 3. Gemini API呼び出し
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
    
    if (geminiData.error) {
        console.error("Gemini Error:", geminiData.error);
        return new Response(JSON.stringify({ error: 'AI API Error' }), { status: 500 });
    }

    // 4. 解析と返却
    let aiText = geminiData.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(aiText);

    return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Server Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
