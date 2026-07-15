const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    // ── 1. CEK APAKAH QUERY ADALAH LINK YOUTUBE ──
    const ytMatch = query.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    let videoId = ytMatch ? ytMatch[1] : null;
    let parsedTitle = query;

    if (videoId) {
        try {
            const oembedRes = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            const title = oembedRes.data.title;
            const author = oembedRes.data.author_name;

            console.log(`🎵 YouTube title: ${title}`);
            console.log(`👤 Channel: ${author}`);

            parsedTitle = cleanVideoTitle(title);
            console.log(`📝 Parsed: ${parsedTitle}`);
        } catch (e) {
            console.log('⚠️ YouTube oEmbed failed, using raw query');
        }
    }

    // ── 2. COBA PAKAI LRCLIB ──
    try {
        const lrcRes = await axios.get('https://lrclib.net/api/search', {
            params: { q: parsedTitle },
            timeout: 10000
        });

        const results = lrcRes.data;
        if (results && results.length > 0) {
            // ── PRIORITAS: SYNCED DULU ──
            let sorted = results.sort((a, b) => {
                // 1. Prioritaskan yang punya syncedLyrics
                const aSynced = a.syncedLyrics && a.syncedLyrics.trim().length > 0;
                const bSynced = b.syncedLyrics && b.syncedLyrics.trim().length > 0;
                if (aSynced && !bSynced) return -1;
                if (!aSynced && bSynced) return 1;

                // 2. Prioritaskan duration lebih panjang (lagu utuh)
                if (a.duration && b.duration) {
                    return b.duration - a.duration;
                }

                // 3. Prioritaskan yang judulnya lebih mirip dengan query
                const aScore = getTitleSimilarity(a.trackName || '', parsedTitle);
                const bScore = getTitleSimilarity(b.trackName || '', parsedTitle);
                return bScore - aScore;
            });

            // ── AMBIL YANG TERBAIK ──
            const song = sorted[0];
            const lyrics = song.syncedLyrics || song.plainLyrics;

            if (lyrics) {
                console.log(`✅ Found: ${song.trackName} - ${song.artistName} (${song.syncedLyrics ? 'SYNCED' : 'plain'})`);
                return res.json({
                    success: true,
                    lyrics: lyrics,
                    synced: !!song.syncedLyrics,
                    title: song.trackName || 'Unknown',
                    artist: song.artistName || 'Unknown',
                    duration: song.duration || 0
                });
            }
        }
    } catch (e) {
        console.log('⚠️ LRCLIB failed:', e.message);
    }

    // ── 3. FALLBACK: lyrics.ovh ──
    try {
        const parts = parsedTitle.split(/ - | – | \| /);
        let artist = '';
        let title = parsedTitle;
        if (parts.length >= 2) {
            if (parts[0].length < parts[1].length || parts[0].includes(' ')) {
                artist = parts[0].trim();
                title = parts[1].trim();
            } else {
                artist = parts[1].trim();
                title = parts[0].trim();
            }
        }

        title = cleanSongTitle(title);

        console.log(`🔍 Fallback searching: ${title} - ${artist || 'unknown'}`);

        const fallbackRes = await axios.get(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
            { timeout: 10000 }
        );

        if (fallbackRes.data && fallbackRes.data.lyrics) {
            const lines = fallbackRes.data.lyrics.split('\n');
            let lrc = '';
            let time = 0;
            for (const line of lines) {
                if (line.trim()) {
                    const min = Math.floor(time / 60);
                    const sec = Math.floor(time % 60);
                    const cs = Math.floor((time % 1) * 100);
                    lrc += `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}] ${line}\n`;
                    time += 3;
                }
            }
            return res.json({
                success: true,
                lyrics: lrc,
                synced: false,
                title: title || 'Unknown',
                artist: artist || 'Unknown'
            });
        }
    } catch (e) {
        console.log('❌ Fallback failed:', e.message);
    }

    res.status(404).json({ success: false, error: 'Lyrics not found' });
};

// ══════════════════════════════════════════
//  HELPER FUNCTIONS
// ══════════════════════════════════════════

function getTitleSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(' ');
    const words2 = str2.toLowerCase().split(' ');
    let match = 0;
    for (const w of words1) {
        if (w.length > 2 && words2.includes(w)) match++;
    }
    return match;
}

function cleanVideoTitle(title) {
    let cleaned = title
        .replace(/\(Official (?:Music )?Video\)/gi, '')
        .replace(/\(Official MV\)/gi, '')
        .replace(/\(MV\)/gi, '')
        .replace(/\(Audio\)/gi, '')
        .replace(/\[(?:Official|MV|Audio|4K|HD)\]/gi, '')
        .replace(/Official (?:Music )?Video/gi, '')
        .replace(/Official MV/gi, '')
        .replace(/MV/gi, '')
        .replace(/\[(?:4K|HD)\]/gi, '')
        .replace(/(Cover|Remix) \(.*?\)/gi, '')
        .trim();

    cleaned = cleaned.replace(/\s*(Official|Music Video|MV|4K|HD|Lyrics|Color Coded|Easy Lyrics).*$/i, '').trim();

    return cleaned;
}

function cleanSongTitle(title) {
    return title
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/feat\..*$/i, '')
        .replace(/ft\..*$/i, '')
        .trim();
}
