const { getLyrics } = require('genius-lyrics-api');
const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query. Example: ?q=Heat Waves Glass Animals' });
    }

    const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
    if (!GENIUS_API_KEY) {
        return res.status(500).json({ success: false, error: 'API key not configured' });
    }

    try {
        // ── COBA PAKAI LIBRARY ──
        let lyrics = null;

        // Coba parsing judul & artis dari query
        let title = query;
        let artist = '';
        const parts = query.split(/ - | by | feat\. /i);
        if (parts.length > 1) {
            title = parts[0].trim();
            artist = parts.slice(1).join(' ').trim();
        }

        const options = {
            apiKey: GENIUS_API_KEY,
            title: title,
            artist: artist || undefined,
            optimizeQuery: true
        };

        console.log('🔍 Searching:', title, 'by', artist || 'unknown');

        try {
            lyrics = await getLyrics(options);
            console.log('✅ Lyrics found via library');
        } catch (libError) {
            console.log('⚠️ Library failed, trying fallback...', libError.message);

            // ── FALLBACK: PAKAI AXIOS MANUAL ──
            const searchRes = await axios.get('https://api.genius.com/search', {
                params: { q: query },
                headers: { 'Authorization': 'Bearer ' + GENIUS_API_KEY }
            });

            const hit = searchRes.data.response.hits[0];
            if (!hit) {
                return res.status(404).json({ success: false, error: 'Song not found' });
            }

            const songUrl = hit.result.url;
            const pageRes = await axios.get(songUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                }
            });

            const html = pageRes.data;
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

            if (!lyrics) {
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
        }

        // Bersihkan
        if (lyrics) {
            lyrics = lyrics
                .replace(/\[[^\]]*\]/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        if (!lyrics || lyrics.length < 10) {
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
