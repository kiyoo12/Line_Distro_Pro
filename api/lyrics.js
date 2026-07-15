const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CX = process.env.GOOGLE_CX || 'f765b9e46ccd04679';

    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ 
            success: false, 
            error: 'Google API Key not configured. Please add GOOGLE_API_KEY to environment variables.' 
        });
    }

    try {
        // ── 1. Cari di Google Custom Search ──
        const searchQuery = `${query} lyrics`;
        console.log(`🔍 Searching: ${searchQuery}`);

        const searchRes = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: GOOGLE_API_KEY,
                cx: GOOGLE_CX,
                q: searchQuery,
                num: 3
            }
        });

        const items = searchRes.data.items || [];
        console.log(`📊 Found ${items.length} results`);

        if (items.length === 0) {
            return res.status(404).json({ success: false, error: 'Song not found' });
        }

        // ── 2. Coba ambil lirik dari setiap hasil ──
        for (let i = 0; i < items.length; i++) {
            const url = items[i].link;
            console.log(`🌐 Trying: ${url}`);

            try {
                const pageRes = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 10000
                });

                const html = pageRes.data;
                let lyrics = extractLyrics(html, url);
                
                if (lyrics && lyrics.length > 50) {
                    lyrics = lyrics
                        .replace(/\[[^\]]*\]/g, '')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();

                    if (lyrics.length > 20) {
                        console.log(`✅ Success from: ${url}`);
                        return res.json({ 
                            success: true, 
                            lyrics: lyrics,
                            source: url
                        });
                    }
                }
            } catch (e) {
                console.log(`❌ Failed to fetch ${url}:`, e.message);
            }
        }

        res.status(404).json({ success: false, error: 'Lyrics not found on any site' });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📦 Response status:', error.response.status);
            console.error('📦 Response data:', error.response.data);
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch lyrics'
        });
    }
};

// ══════════════════════════════════════════
//  EKSTRAK LIRIK DARI HTML (Multi-Site)
// ══════════════════════════════════════════
function extractLyrics(html, url) {
    let lyrics = '';

    // ── GENIUS ──
    if (url.includes('genius.com')) {
        const regex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
        let match, matches = [];
        while ((match = regex.exec(html)) !== null) matches.push(match[1]);
        if (matches.length > 0) {
            lyrics = matches
                .map(m => m.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim())
                .filter(m => m.length > 0)
                .join('\n\n');
        }
    }

    // ── AZLYRICS ──
    if (url.includes('azlyrics.com')) {
        const match = html.match(/<!-- Usage of azlyrics\.com.*?-->([\s\S]*?)<!--/i);
        if (match) {
            lyrics = match[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .trim();
        }
        if (!lyrics || lyrics.length < 20) {
            const match2 = html.match(/<div[^>]*class="[^"]*lyric"*[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (match2) {
                lyrics = match2[1]
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]*>/g, '')
                    .trim();
            }
        }
    }

    // ── METROLYRICS ──
    if (url.includes('metrolyrics.com')) {
        const match = html.match(/<div[^>]*id="lyrics-body"[^>]*>([\s\S]*?)<\/div>/i);
        if (match) {
            lyrics = match[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .trim();
        }
    }

    // ── SONG LYRICS ──
    if (url.includes('songlyrics.com')) {
        const match = html.match(/<p[^>]*id="songLyricsDiv"[^>]*>([\s\S]*?)<\/p>/i);
        if (match) {
            lyrics = match[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .trim();
        }
    }

    // ── FALLBACK: cari div dengan class "lyrics" ──
    if (!lyrics || lyrics.length < 20) {
        const regex = /<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        let match, matches = [];
        while ((match = regex.exec(html)) !== null) matches.push(match[1]);
        if (matches.length > 0) {
            lyrics = matches
                .map(m => m.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim())
                .filter(m => m.length > 0)
                .join('\n\n');
        }
    }

    // ── FALLBACK 2: ambil semua teks body (brute force) ──
    if (!lyrics || lyrics.length < 50) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            let text = bodyMatch[1]
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]*>/g, '\n')
                .replace(/&nbsp;/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            
            const lines = text.split('\n').filter(l => l.trim().length > 5);
            if (lines.length > 3) {
                lyrics = lines.join('\n');
            }
        }
    }

    return lyrics;
}
