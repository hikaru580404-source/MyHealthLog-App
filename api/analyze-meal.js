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
    
    // エッジ環境用の安全なBase64変換
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

    // ★大反省と改善：現在OpenRouterで「最も安定して動く無料モデル」の精鋭リスト
    const models = [
      "meta-llama/llama-3.2-90b-vision-instruct:free", // 第1候補: Meta社の超高性能AI
      "meta-llama/llama-3.2-11b-vision-instruct:free", // 第2候補: Meta社の軽量・高速AI
      "qwen/qwen2.5-vl-72b-instruct:free"              // 第3候補: アジア圏で最強のQwen最新版
    ];

    let finalResult = null;
    let lastError = null;
    let usedModel = null;

    // 滝のように順番にAIにアタックをかける（カスケード接続）
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
        
        // 解析成功した場合
        if (response.ok && data.choices && data.choices.length > 0) {
          let aiText = data.choices[0].message.content;
          
          // JSON抽出フィルター
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

          finalResult = parsed;
          usedModel = model;
          break; // 成功したらループを脱出
        } else {
          lastError = data.error ? data.error.message : 'Unknown AI API Error';
          continue; // 失敗したら次のAIへ
        }
      } catch (err) {
        lastError = err.message;
        continue; 
      }
    }

    if (finalResult) {
      finalResult.debug_model = usedModel; // どのAIが成功したか記録
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
