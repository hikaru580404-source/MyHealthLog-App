export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageUrl, memo } = req.body;

    // ★Google AIへの接続を完全に遮断し、ダミーデータを生成します★
    
    // 300〜800のランダムなカロリーを生成
    const mockCalories = Math.floor(Math.random() * (800 - 300) + 300); 
    
    // ダミーのプロフェッショナル解説を作成
    const mockAnalysis = `[システムテスト稼働中] これはGoogle AIの代わりにシステムが自動生成したテスト用のテキストです。入力されたメモ「${memo || 'なし'}」を受け取りました。PFCバランスが取れた素晴らしい食事です。`;

    // 意図的に1.5秒待機させ、AIが考えているようなローディングを再現する
    await new Promise(resolve => setTimeout(resolve, 1500));

    // フロントエンド（アプリ）にダミー結果を返す
    return res.status(200).json({
        calories: mockCalories,
        analysis: mockAnalysis
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}