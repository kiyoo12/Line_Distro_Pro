// ── MANUAL SYNC: KLIK LIRIK UNTUK SET TIMESTAMP ──
document.addEventListener('DOMContentLoaded', function() {
    var container = document.getElementById('lyricsContainer');
    if (!container) return;

    container.addEventListener('click', function(e) {
        var line = e.target.closest('.lyric-line');
        if (!line) return;
        var index = parseInt(line.dataset.index);
        if (isNaN(index)) return;

        var currentTime = getCurrentPlayerTime();
        if (!currentTime || currentTime === 0) {
            showToast('⚠️ Putar lagu dulu sebelum set timestamp');
            return;
        }

        // Update timestamp di data
        _lyricsData[index].time = currentTime;
        _lyricsData.sort(function(a, b) { return a.time - b.time; });

        // Update active index
        _lyricsActiveIndex = -1;

        // Re-render
        renderLyrics();
        showToast('✅ Timestamp set untuk baris ke-' + (index + 1));
    });
});
