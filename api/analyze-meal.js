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

    // ★修正1：OpenRouterで現在確実に動く「完全無料の画像認識AI」に厳選しました
    const models = [
      "google/gemini-2.0-flash:free",
      "google/gemini-2.0-flash-lite-preview-02-05:free",
      "qwen/qwen-2-vl-7b-instruct:free" 
    ];

    let finalResult = null;
    let lastError = null;
    let usedModel = null;

    for (const model of models) {
      try {
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
            // ★修正2：一部の無料AIが嫌がる「JSON強制モード」を削除（プロンプトで制御します）
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
        
        if (response.ok && data.choices && data.choices.length > 0) {
          let aiText = data.choices[0].message.content;
          
          // ★修正3：AIが余計な文字を混ぜてきても、{ から } までを強制的に抜き出してJSON化する最強のフィルター
          aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
          const jsonMatch = aiText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
              aiText = jsonMatch[0];
          }
          
          let parsed = JSON.parse(aiText);

          if (typeof parsed.calories === 'string') {
            const match = parsed.calories.match(/\d+/);
            parsed.calories = match ? parseInt(match[0], 10) : 0;
          } else if (typeof parsed.calories === 'number') {
            parsed.calories = Math.round(parsed.calories);
          }

          finalResult = parsed;
          usedModel = model;
          break; // 成功したらループ脱出
        } else {
          lastError = data.error ? data.error.message : 'Unknown AI Error';
          continue; 
        }
      } catch (err) {
        lastError = err.message;
        continue; 
      }
    }

    if (finalResult) {
      finalResult.debug_model = usedModel; 
      return new Response(JSON.stringify(finalResult), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    } else {
      return new Response(JSON.stringify({ error: 'All models failed', details: lastError }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server Error', message: error.message }), { status: 500 });
  }
}