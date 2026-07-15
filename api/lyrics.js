module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Test sederhana
    res.json({
        success: true,
        message: 'API is working!',
        query: req.query.q || 'no query'
    });
};
