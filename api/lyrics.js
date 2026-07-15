const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    try {
        // ── 1. Cari di MusicBrainz ──
        const mbRes = await axios.get('https://musicbrainz.org/ws/2/recording', {
            params: {
                query: query,
                fmt: 'json',
                limit: 1
            },
            headers: { 'User-Agent': 'LineDistro/1.0 (https://linedistro.vercel.app)' }
        });

        const recordings = mbRes.data.recordings || [];
        if (recordings.length === 0) {
            return res.status(404).json({ success: false, error: 'Song not found' });
        }

        const title = recordings[0].title;
        const artist = recordings[0]?.['artist-credit']?.[0]?.name || '';

        console.log(`🎵 Found: ${title} - ${artist}`);

        // ── 2. Ambil lirik dari ChartLyrics ──
        const clRes = await axios.get('https://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect', {
            params: {
                artist: artist,
                song: title
            }
        });

        const xml = clRes.data;
        // Parse XML sederhana (ambil antara <Lyric> dan </Lyric>)
        const lyricMatch = xml.match(/<Lyric>([\s\S]*?)<\/Lyric>/i);
        let lyrics = lyricMatch ? lyricMatch[1].trim() : null;

        if (!lyrics || lyrics === 'Not Found') {
            return res.status(404).json({ success: false, error: 'Lyrics not found' });
        }

        // Bersihkan
        lyrics = lyrics
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        res.json({ success: true, lyrics: lyrics });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch lyrics'
        });
    }
};
