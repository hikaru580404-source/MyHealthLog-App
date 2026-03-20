export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    const { imageUrl, memo } = body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!imageUrl) return new Response(JSON.stringify({ error: 'Image URL is missing' }), { status: 400 });
    if (!apiKey) return new Response(JSON.stringify({ error: 'OpenRouter API Key is missing' }), { status: 500 });

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return new Response(JSON.stringify({ error: 'Failed to fetch image' }), { status: 500 });
    
    const arrayBuffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64Image = btoa(binary);
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const prompt = `この食事の画像から、以下の2点を推測して厳密なJSON形式のみで返してください。前置きや解説の文章は一切不要です。
1. calories: 推定される合計カロリー（数値のみ）
2. analysis: 栄養素や健康への影響に関するコメント（日本語100文字程度）。メモ「${memo || ''}」も考慮してください。
出力フォーマット: {"calories": 500, "analysis": "..."}`;

    // ★原因究明のため「滝」を止め、最強のGemini 2.0 一本に絞ります
    const model = "google/gemini-2.0-flash:free";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://meal-ai-log.vercel.app",
        "X-Title": "MyHealthLog"
      },
      body: JSON.stringify({
        "model": model,
        "messages": [{
          "role": "user",
          "content": [
            { "type": "text", "text": prompt },
            { "type": "image_url", "image_url": { "url": dataUrl } }
          ]
        }]
      })
    });

    const data = await response.json();
    
    // ★通信成功時
    if (response.ok && data.choices && data.choices.length > 0) {
      let aiText = data.choices[0].message.content;
      
      aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) { aiText = jsonMatch[0]; }
      
      let parsed = JSON.parse(aiText);

      if (typeof parsed.calories === 'string') {
        const match = parsed.calories.match(/\d+/);
        parsed.calories = match ? parseInt(match[0], 10) : 0;
      } else if (typeof parsed.calories === 'number') {
        parsed.calories = Math.round(parsed.calories);
      }

      parsed.debug_model = model;
      return new Response(JSON.stringify(parsed), { status: 200, headers: { 'Content-Type': 'application/json' } });
      
    } else {
      // ★エラーの真犯人（Geminiが嫌がった理由）をそのまま画面に表示させます
      return new Response(JSON.stringify({ error: 'Gemini Failed', details: data }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server Error', message: error.message }), { status: 500 });
  }
}
