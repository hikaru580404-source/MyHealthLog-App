// ★防弾1: Vercelの10秒タイムアウトを破壊するEdge Runtime
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
    if (!apiKey) return new Response(JSON.stringify({ error: 'OpenRouter API Key is missing in Vercel' }), { status: 500 });

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return new Response(JSON.stringify({ error: 'Failed to fetch image' }), { status: 500 });
    
    // ★防弾2: メモリ超過（500エラー）を防ぐ、Edge専用の安全で高速なBase64変換
    const arrayBuffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64Image = btoa(binary);
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const prompt = `この食事の画像から、以下の2点を推測して厳密なJSON形式のみで返してください。
1. calories: 推定される合計カロリー（数値のみ）
2. analysis: 栄養素や健康への影響に関するコメント（日本語100文字程度）。メモ「${memo || ''}」も考慮してください。
出力フォーマット: {"calories": 500, "analysis": "..."}`;

    // ★防弾3: 無料AIの全滅を防ぐカスケード（滝型）ルーティング
    const models = [
      "google/gemini-2.0-flash:free",           // 第1候補: 本命
      "meta-llama/llama-3.2-90b-vision-instruct:free", // 第2候補: Metaの天才AI
      "google/gemini-1.5-pro:free"              // 第3候補: 予備
    ];

    let finalResult = null;
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // ★防弾4: OpenRouterの身元確認フィルターを正面突破
            "HTTP-Referer": "https://meal-ai-log.vercel.app", // アプリのURL（ダミーでも可）
            "X-Title": "MyHealthLog" // アプリ名
          },
          body: JSON.stringify({
            "model": model,
            "response_format": { "type": "json_object" },
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
          aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          let parsed = JSON.parse(aiText);

          // ★防弾5: AIの「約500kcal」といった文字化けから、数字だけを強制抽出
          if (typeof parsed.calories === 'string') {
            const match = parsed.calories.match(/\d+/);
            parsed.calories = match ? parseInt(match[0], 10) : 0;
          } else if (typeof parsed.calories === 'number') {
            parsed.calories = Math.round(parsed.calories);
          }

          finalResult = parsed;
          break; // 成功したらループを脱出
        } else {
          lastError = data.error ? data.error.message : 'Unknown AI Error';
          continue; // 失敗したら次のAIへ
        }
      } catch (err) {
        lastError = err.message;
        continue; // ネットワークエラーでも次のAIへ
      }
    }

    if (finalResult) {
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
