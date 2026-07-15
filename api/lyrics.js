const axios = require('axios');

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
        // 1. Cari lagu di Genius API
        const searchRes = await axios.get('https://api.genius.com/search', {
            params: { q: query },
            headers: { 'Authorization': 'Bearer ' + GENIUS_API_KEY }
        });

        const hit = searchRes.data.response.hits[0];
        if (!hit) {
            return res.status(404).json({ success: false, error: 'Song not found' });
        }

        const songUrl = hit.result.url;
        console.log('🎵 Found:', hit.result.full_title);

        // 2. Ambil halaman Genius dengan User-Agent seperti browser
        const pageRes = await axios.get(songUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = pageRes.data;

        // 3. Ekstrak lirik pake Regex (tanpa Cheerio)
        let lyrics = '';

        // Cari div dengan data-lyrics-container="true"
        const regex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
        let match;
        let matches = [];
        while ((match = regex.exec(html)) !== null) {
            matches.push(match[1]);
        }

        if (matches.length > 0) {
            lyrics = matches
                .map(m => m.replace(/<br\s*\/?>/gi, '\n')
                           .replace(/<[^>]*>/g, '')
                           .trim())
                .filter(m => m.length > 0)
                .join('\n\n');
        }

        // Fallback: cari class Lyrics__Container
        if (!lyrics || lyrics.length < 20) {
            const regex2 = /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            matches = [];
            while ((match = regex2.exec(html)) !== null) {
                matches.push(match[1]);
            }
            if (matches.length > 0) {
                lyrics = matches
                    .map(m => m.replace(/<br\s*\/?>/gi, '\n')
                               .replace(/<[^>]*>/g, '')
                               .trim())
                    .filter(m => m.length > 0)
                    .join('\n\n');
            }
        }

        // Bersihkan
        lyrics = lyrics
            .replace(/\[[^\]]*\]/g, '') // hapus [Verse], [Chorus]
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (!lyrics || lyrics.length < 10) {
            return res.status(404).json({ success: false, error: 'Lyrics not found on page' });
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
