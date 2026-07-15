const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    try {
        // Pisahkan artis dan judul
        let artist = '';
        let title = query;
        const parts = query.split(/ - | by | feat\. /i);
        if (parts.length > 1) {
            title = parts[0].trim();
            artist = parts[1].trim();
        }

        console.log(`🔍 Searching: ${title} - ${artist || 'unknown'}`);

        // ── PAKAI lyrics.ovh (GRATIS, NO API KEY) ──
        const url = artist 
            ? `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
            : `https://api.lyrics.ovh/v1//${encodeURIComponent(title)}`;

        const response = await axios.get(url, { timeout: 10000 });

        if (response.data && response.data.lyrics) {
            let lyrics = response.data.lyrics;
            lyrics = lyrics
                .replace(/\[[^\]]*\]/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            if (lyrics.length > 10) {
                return res.json({
                    success: true,
                    lyrics: lyrics,
                    artist: artist || 'Unknown',
                    title: title
                });
            }
        }

        // ── FALLBACK: COBA TANPA ARTIS ──
        const fallbackRes = await axios.get(`https://api.lyrics.ovh/v1//${encodeURIComponent(query)}`, { timeout: 10000 });
        if (fallbackRes.data && fallbackRes.data.lyrics) {
            let lyrics = fallbackRes.data.lyrics;
            lyrics = lyrics
                .replace(/\[[^\]]*\]/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            if (lyrics.length > 10) {
                return res.json({
                    success: true,
                    lyrics: lyrics,
                    title: query
                });
            }
        }

        res.status(404).json({ success: false, error: 'Lyrics not found' });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📦 Status:', error.response.status);
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch lyrics'
        });
    }
};
