export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // CORSエラーを未然に防ぐための事前通信(OPTIONS)対応
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  // POSTメソッド以外は弾く
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { meal_id } = body;

    // IDが送られてこなかった場合のエラーハンドリング
    if (!meal_id) {
      return new Response(JSON.stringify({ error: 'Meal ID is missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 環境変数からSupabaseの接続情報を取得
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // SupabaseのREST APIを直接叩いて削除命令を送る
    const response = await fetch(`${supabaseUrl}/rest/v1/meal_logs?id=eq.${meal_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    // Supabase側で削除に失敗した場合
    if (!response.ok) {
        const errText = await response.text();
        return new Response(JSON.stringify({ error: 'Supabase Delete Error', details: errText }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 成功レスポンス
    return new Response(JSON.stringify({ success: true, message: 'Meal deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // サーバー内部の予期せぬエラー
    return new Response(JSON.stringify({ error: 'Server Error', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}