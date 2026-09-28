// ══════════════════════════════════════════
//  LYRICS MODUL — SYNC DENGAN HOLD MEMBER + TAB "ALL"
// ══════════════════════════════════════════

function renderLyrics() {
    var container = document.getElementById('lyricsContainer');
    if (!container) return;

    var activeMembers = getActiveMembers();
    var activeDisplay = document.getElementById('activeMemberDisplay');
    var activeAvatar = document.getElementById('activeMemberAvatar');
    var activeName = document.getElementById('activeMemberName');
    var activeLyrics = document.getElementById('activeMemberLyrics');

    if (_isAllMembersActive) {
        activeDisplay.style.display = 'flex';
        activeDisplay.style.borderLeftColor = '#fbbf24';
        activeAvatar.style.display = 'none';
        activeName.textContent = '🎤 ALL';
        activeName.style.color = '#fbbf24';
        activeLyrics.textContent = 'All members singing together';
        activeLyrics.style.color = '#fbbf24';
        activeLyrics.style.fontWeight = 'bold';
        activeLyrics.style.fontStyle = 'italic';
    } else if (activeMembers.length > 0 && _lyricsActiveIndex >= 0 && _lyricsActiveIndex < _lyricsData.length) {
        activeAvatar.style.display = 'block';
        var firstMember = activeMembers[0];
        var color = memberColors[firstMember] || '#a78bfa';
        var currentLyric = _lyricsData[_lyricsActiveIndex]?.text || '';

        activeDisplay.style.display = 'flex';
        activeDisplay.style.borderLeftColor = color;
        activeAvatar.src = memberPhotos[firstMember] || 'https://ui-avatars.com' + encodeURIComponent(firstMember) + '&background=random';
        activeAvatar.style.borderColor = color;
        activeName.textContent = firstMember;
        activeName.style.color = color;
        activeLyrics.textContent = currentLyric;
        activeLyrics.style.color = 'var(--text2)';
        activeLyrics.style.fontWeight = 'normal';
        activeLyrics.style.fontStyle = 'normal';

        if (activeMembers.length >= 2) {
            activeName.textContent = activeMembers.join(' + ');
            var avgCol = getAverageColor(activeMembers.map(function(n) { return memberColors[n] || '#a78bfa'; }));
            activeName.style.color = avgCol;
        }
    } else {
        activeDisplay.style.display = 'none';
    }

    if (_lyricsData.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:30px 0;font-size:12px;">No lyrics loaded.<br>Upload a .lrc file or click 🔍 Search to fetch from online.</div>';
        return;
    }

    var activeColors = activeMembers.map(function(n) { return memberColors[n] || '#a78bfa'; });
    var isDuet = activeMembers.length >= 2;
    var avgColor = isDuet ? getAverageColor(activeColors) : (activeColors[0] || '#ffffff');
    var isActive = activeMembers.length > 0 || _isAllMembersActive;

    var html = '';
    for (var i = 0; i < _lyricsData.length; i++) {
        var l = _lyricsData[i];
        var isCurrent = (i === _lyricsActiveIndex);
        var cls = 'lyric-line';
        var style = '';

        if (isCurrent && isActive) {
            cls += ' active';
            var allLabel = _isAllMembersActive ? ' <span class="all-badge">ALL</span>' : '';
            style = 'padding:6px 12px; margin:4px 0; border-radius:4px;';
            html += '<div class="' + cls + '" style="' + style + '" data-index="' + i + '">' + l.text + allLabel + '</div>';
        } else if (isCurrent && !isActive) {
            cls += ' active';
            style = 'padding:4px 10px;';
            html += '<div class="' + cls + '" style="' + style + '" data-index="' + i + '">' + l.text + '</div>';
        } else if (i < _lyricsActiveIndex) {
            cls += ' past';
            html += '<div class="' + cls + '" data-index="' + i + '">' + l.text + '</div>';
        } else {
            html += '<div class="' + cls + '" data-index="' + i + '">' + l.text + '</div>';
        }
    }
    container.innerHTML = html;
}

function updateLyricsOnHold() {
    if (_lyricsData.length === 0) return;

    var hasActive = false;
    for (var n in memberIntervals) {
        if (memberIntervals[n]) { hasActive = true; break; }
    }

    if (!hasActive && !_isAllMembersActive) return;

    var current = getCurrentPlayerTime();
    var newIndex = -1;
    for (var i = 0; i < _lyricsData.length; i++) {
        if (current >= _lyricsData[i].time) {
            newIndex = i;
        } else {
            break;
        }
    }

    if (newIndex !== _lyricsActiveIndex) {
        _lyricsActiveIndex = newIndex;
        renderLyrics();
        scrollToActiveLyric();
    }
}

function scrollToActiveLyric() {
    var container = document.getElementById('lyricsContainer');
    if (!container) return;
    var activeEl = container.querySelector('.lyric-line.active');
    if (activeEl) {
        var containerRect = container.getBoundingClientRect();
        var activeRect = activeEl.getBoundingClientRect();
        var isVisible = (activeRect.top >= containerRect.top && activeRect.bottom <= containerRect.bottom);

        if (!isVisible) {
            activeEl.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }
}

function startLyricsSync() {
    if (_lyricsUpdateInterval) clearInterval(_lyricsUpdateInterval);
    _lyricsUpdateInterval = setInterval(updateLyricsOnHold, 200);
}

function stopLyricsSync() {
    if (_lyricsUpdateInterval) {
        clearInterval(_lyricsUpdateInterval);
        _lyricsUpdateInterval = null;
    }
}

function parseLRC(content) {
    var lines = content.split('\n');
    var parsed = [];
    var timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;

        var match = line.match(timeRegex);
        if (match) {
            var min = parseInt(match[1]);
            var sec = parseInt(match[2]);
            var millis = match[3] ? parseInt(match[3]) / (match[3].length === 2 ? 100 : 1000) : 0;
            var time = min * 60 + sec + millis;
            var text = line.replace(/\[.*?\]/g, '').trim();
            if (text) {
                parsed.push({ time: time, text: text });
            }
        }
    }

    parsed.sort(function(a, b) { return a.time - b.time; });
    _lyricsData = parsed;
    _lyricsActiveIndex = -1;
    renderLyrics();
    startLyricsSync();
}

function loadLRCFile(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        parseLRC(e.target.result);
        showToast('📝 Lyrics loaded: ' + file.name);
    };
    reader.readAsText(file);
}

function clearLyrics() {
    _lyricsData = [];
    _lyricsActiveIndex = -1;
    _isAllMembersActive = false;
    renderLyrics();
    document.getElementById('lrcUpload').value = '';
    stopLyricsSync();
    showToast('🗑 Lyrics cleared');
}

async function searchLyrics() {
    var titleInput = document.getElementById('songTitle');
    var query = titleInput.value.trim();
    if (!query) {
        showToast('⚠️ Please enter a song title first');
        return;
    }

    showToast('🔍 Searching lyrics...');
    var result = await fetchLyricsFromAPI(query);

    if (result) {
        var lines = result.lyrics.split('\n');
        var parsed = [];
        var time = 0;
        for (var i = 0; i < lines.length; i++) {
            var text = lines[i].trim();
            if (text) {
                parsed.push({ time: time, text: text });
                time += 3;
            }
        }
        _lyricsData = parsed;
        _lyricsActiveIndex = -1;
        _isAllMembersActive = false;
        renderLyrics();
        startLyricsSync();
        showToast('✅ Lyrics loaded from online!');
    } else {
        showToast('⚠️ Lyrics not found for this song');
    }
}

const LYRICS_API_URL = '/api/lyrics';

async function fetchLyricsFromAPI(query) {
    try {
        var res = await fetch(LYRICS_API_URL + '?q=' + encodeURIComponent(query));
        var data = await res.json();

        if (data.success && data.lyrics) {
            return {
                lyrics: data.lyrics,
                title: data.title || 'Unknown',
                artist: data.artist || 'Unknown'
            };
        }
        return null;
    } catch (e) {
        console.error('❌ Error fetching lyrics:', e);
        return null;
    }
}

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

        _lyricsData[index].time = currentTime;
        _lyricsData.sort(function(a, b) { return a.time - b.time; });

        _lyricsActiveIndex = -1;
        renderLyrics();
        showToast('✅ Timestamp set untuk baris ke-' + (index + 1));
    });
});