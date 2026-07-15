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

        const songId = hit.result.id;
        const songTitle = hit.result.title;
        const artistName = hit.result.primary_artist.name;

        console.log(`🎵 Found: ${songTitle} - ${artistName}`);

        // ── PAKAI API GENIUS UNTUK AMBIL LIRIK (LEGAL) ──
        // Gunakan endpoint /songs/{id} untuk dapatkan data lebih lengkap
        // Tapi Genius API tidak menyediakan lirik mentah via API resmi.
        // Jadi kita pakai metode alternatif: ambil dari halaman dengan proxy.

        const pageRes = await axios.get(hit.result.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.google.com/',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });

        const html = pageRes.data;
        
        // ── EKSTRAK LIRIK DARI HTML ──
        // Cari div dengan data-lyrics-container atau class Lyrics__Container
        let lyrics = '';
        
        // Method 1: Regex langsung dari HTML (lebih cepat)
        const lyricRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
        let match;
        let matches = [];
        while ((match = lyricRegex.exec(html)) !== null) {
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

        // Method 2: Cari class Lyrics__Container
        if (!lyrics || lyrics.length < 20) {
            const lyricRegex2 = /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            matches = [];
            while ((match = lyricRegex2.exec(html)) !== null) {
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

        // Method 3: Cari JSON-LD yang mengandung lyrics
        if (!lyrics || lyrics.length < 20) {
            const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
            while ((match = jsonLdRegex.exec(html)) !== null) {
                try {
                    const data = JSON.parse(match[1]);
                    if (data && data.tracks && data.tracks[0] && data.tracks[0].lyrics) {
                        lyrics = data.tracks[0].lyrics;
                        break;
                    }
                } catch (e) {}
            }
        }

        // Bersihkan lirik
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
        if (error.response) {
            console.error('📦 Status:', error.response.status);
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch lyrics'
        });
    }
};
