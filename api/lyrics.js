const axios = require('axios');
const cheerio = require('cheerio');

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
        // 1. Cari lagu
        const searchRes = await axios.get('https://api.genius.com/search', {
            params: { q: query },
            headers: { 'Authorization': 'Bearer ' + GENIUS_API_KEY }
        });

        const hit = searchRes.data.response.hits[0];
        if (!hit) {
            return res.status(404).json({ success: false, error: 'Song not found' });
        }

        const songUrl = hit.result.url;
        console.log('🎵 Song URL:', songUrl);

        // 2. Ambil halaman Genius
        const pageRes = await axios.get(songUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        const html = pageRes.data;
        const $ = cheerio.load(html);

        // ── AMBIL LIRIK DENGAN 3 METODE ──
        let lyrics = '';

        // Metode 1: data-lyrics-container
        $('[data-lyrics-container="true"]').each(function() {
            let text = $(this).html();
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/<[^>]*>/g, '');
            lyrics += text + '\n\n';
        });

        // Metode 2: class Lyrics__Container
        if (!lyrics.trim()) {
            $('.Lyrics__Container').each(function() {
                let text = $(this).html();
                text = text.replace(/<br\s*\/?>/gi, '\n');
                text = text.replace(/<[^>]*>/g, '');
                lyrics += text + '\n\n';
            });
        }

        // Metode 3: fallback - ambil semua div dengan class yang mengandung "Lyrics"
        if (!lyrics.trim()) {
            $('div[class*="Lyrics"]').each(function() {
                let text = $(this).text();
                if (text.length > 50) {
                    lyrics += text + '\n\n';
                }
            });
        }

        // Bersihkan lirik
        lyrics = lyrics
            .replace(/\[.*?\]/g, '') // hapus [Verse 1], [Chorus], dll
            .replace(/\n{3,}/g, '\n\n') // hapus spasi berlebih
            .trim();

        if (!lyrics) {
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
