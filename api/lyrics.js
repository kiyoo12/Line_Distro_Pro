const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    // Ambil dari Environment Variable
    const MUSIXMATCH_API_KEY = process.env.MUSIXMATCH_API_KEY;
    if (!MUSIXMATCH_API_KEY) {
        return res.status(500).json({ 
            success: false, 
            error: 'Musixmatch API Key not configured. Please add MUSIXMATCH_API_KEY to environment variables.' 
        });
    }

    try {
        // 1. Cari lagu
        const searchRes = await axios.get('https://api.musixmatch.com/ws/1.1/track.search', {
            params: {
                q: query,
                apikey: MUSIXMATCH_API_KEY,
                page_size: 1,
                s_track_rating: 'desc',
                f_has_lyrics: 1
            }
        });

        const tracks = searchRes.data.message.body.track_list;
        if (!tracks || tracks.length === 0) {
            return res.status(404).json({ success: false, error: 'Song not found' });
        }

        const trackId = tracks[0].track.track_id;
        const title = tracks[0].track.track_name;
        const artist = tracks[0].track.artist_name;

        console.log(`🎵 Found: ${title} - ${artist}`);

        // 2. Ambil lirik
        const lyricRes = await axios.get('https://api.musixmatch.com/ws/1.1/track.lyrics.get', {
            params: {
                track_id: trackId,
                apikey: MUSIXMATCH_API_KEY
            }
        });

        const lyrics = lyricRes.data.message.body.lyrics.lyrics_body;
        if (!lyrics) {
            return res.status(404).json({ success: false, error: 'Lyrics not found' });
        }

        res.json({
            success: true,
            lyrics: lyrics,
            title: title,
            artist: artist
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch lyrics'
        });
    }
};
