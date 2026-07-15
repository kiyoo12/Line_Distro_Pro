const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    try {
        // ── PAKAI API DARI SAWO (GRATIS, STABIL, TANPA SSL ISSUE) ──
        // API ini dari project open-source, jalan di Vercel juga
        const response = await axios.get('https://api.sawo.ai/lyrics', {
            params: { q: query },
            timeout: 10000
        });

        const data = response.data;
        if (!data || !data.lyrics) {
            return res.status(404).json({ success: false, error: 'Lyrics not found' });
        }

        res.json({
            success: true,
            lyrics: data.lyrics,
            title: data.title || 'Unknown',
            artist: data.artist || 'Unknown'
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // ── FALLBACK: PAKAI API LAIN ──
        try {
            // API Lirik dari Vercel sendiri (gratis, open-source)
            const fallbackRes = await axios.get('https://lyrics-api-psi.vercel.app/api/lyrics', {
                params: { q: query },
                timeout: 10000
            });
            
            const fallbackData = fallbackRes.data;
            if (fallbackData && fallbackData.lyrics) {
                return res.json({
                    success: true,
                    lyrics: fallbackData.lyrics,
                    title: fallbackData.title || 'Unknown',
                    artist: fallbackData.artist || 'Unknown'
                });
            }
        } catch (fallbackErr) {
            console.error('❌ Fallback failed:', fallbackErr.message);
        }

        res.status(500).json({
            success: false,
            error: 'Failed to fetch lyrics from all sources'
        });
    }
};
