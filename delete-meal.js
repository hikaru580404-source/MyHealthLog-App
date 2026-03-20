import { createClient } from '@supabase/supabase-js'

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ★修正：テーブル名を正しく meal_logs に変更しました
    const { error } = await supabase
      .from('meal_logs')
      .delete()
      .eq('id', meal_id);

    if (error) {
        return new Response(JSON.stringify({ error: 'Supabase Delete Error', details: error.message }), { 
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