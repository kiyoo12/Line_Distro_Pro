const { getLyrics } = require('genius-lyrics-api');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
    if (!GENIUS_API_KEY) {
        return res.status(500).json({ success: false, error: 'API key not configured' });
    }

    try {
        // Pisahkan judul dan artis
        const parts = query.split(/ - | by | feat\. /i);
        const title = parts[0].trim();
        const artist = parts.length > 1 ? parts[1].trim() : '';

        const options = {
            apiKey: GENIUS_API_KEY,
            title: title,
            artist: artist || undefined,
            optimizeQuery: true
        };

        const lyrics = await getLyrics(options);

        if (!lyrics) {
            return res.status(404).json({ success: false, error: 'Lyrics not found' });
        }

        res.json({ success: true, lyrics: lyrics });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch lyrics'
        });
    }
};
