export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    const { meal_id } = body;

    if (!meal_id) return new Response(JSON.stringify({ error: 'Meal ID is missing' }), { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // ★修正：専用ツール（ライブラリ）を使わず、標準の通信機能で直接削除命令を送る最強の書き方
    const response = await fetch(`${supabaseUrl}/rest/v1/meal_logs?id=eq.${meal_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
        const errText = await response.text();
        return new Response(JSON.stringify({ error: 'Supabase Delete Error', details: errText }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ success: true, message: 'Meal deleted successfully' }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server Error', message: error.message }), { status: 500 });
  }
}