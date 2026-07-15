const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    const GENIUS_API_KEY = process.env.GENIUS_API_KEY;
    if (!GENIUS_API_KEY) {
        return res.status(500).json({ success: false, error: 'API key not configured' });
    }

    try {
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
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const $ = cheerio.load(pageRes.data);
        let lyrics = '';
        $('[data-lyrics-container="true"]').each(function() {
            let text = $(this).html();
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/<[^>]*>/g, '');
            lyrics += text + '\n\n';
        });

        if (!lyrics) {
            $('.Lyrics__Container').each(function() {
                let text = $(this).html();
                text = text.replace(/<br\s*\/?>/gi, '\n');
                text = text.replace(/<[^>]*>/g, '');
                lyrics += text + '\n\n';
            });
        }

        lyrics = lyrics.trim();
        if (!lyrics) {
            return res.status(404).json({ success: false, error: 'Lyrics not found' });
        }

        } catch (error) {
    console.error('🔴 Error detail:', error.message);
    console.error('🔴 Full error:', error);
    res.status(500).json({ 
        success: false, 
        error: error.message,
        detail: error.response?.data || 'No additional details'
    });
}

        res.json({ success: true, lyrics: lyrics });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to fetch lyrics' });
    }
};
