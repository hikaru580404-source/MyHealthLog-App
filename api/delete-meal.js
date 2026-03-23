// ============================================================
// api/delete-meal.js  |  AsirLabo OS  -  JWA Wellness
// MIGRATED: meal_logs → universal_logs
// NOTE: フロントエンド(meals.js)が直接 supabaseClient.delete() を
//       呼ぶように変更したため、このAPIは現在使用されていません。
//       将来的にサーバーサイド削除が必要になった場合のために残します。
// ============================================================

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { meal_id } = body;

    if (!meal_id) {
      return new Response(JSON.stringify({ error: 'Meal ID is missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // MIGRATED: universal_logs テーブルから削除
    const response = await fetch(
      `${supabaseUrl}/rest/v1/universal_logs?id=eq.${meal_id}&log_type=eq.meal`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

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
    return new Response(JSON.stringify({ error: 'Server Error', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
