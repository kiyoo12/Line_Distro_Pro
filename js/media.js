// ══════════════════════════════════════════
//  MEDIA MODUL — UTILS UTK PLAYER, YOUTUBE & PROGRESS BAR
// ══════════════════════════════════════════

var _ytRetryCount = 0;
var _ytRetryMax = 3;
var _mediaUpdateInterval = null;

function loadLocalMedia(input) {
    var file = input.files[0];
    if (!file) return;
    var url = URL.createObjectURL(file);
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    var yt = document.getElementById('player');
    var lbl = document.getElementById('mediaLabel');
    yt.style.display = 'none';
    vid.style.display = 'none';
    aud.style.display = 'none';
    if (file.type.indexOf('video/') === 0) {
        vid.src = url;
        vid.style.display = 'block';
        vid.load();
        lbl.textContent = '🎬 ' + file.name;
        applyVolumeToMedia(vid);
    } else if (file.type.indexOf('audio/') === 0) {
        aud.src = url;
        aud.style.display = 'block';
        aud.load();
        lbl.textContent = '🎵 ' + file.name;
        applyVolumeToMedia(aud);
    } else { showToast('⚠️ Format tidak didukung'); return; }
    detectSongFromFile(file);
    startMediaProgressUpdate();
}

function loadVideo() {
    var url = document.getElementById('ytLink').value.trim();
    var match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    var v = match ? match[1] : null;
    if (!v) { showToast('⚠️ Link YouTube tidak valid'); return; }
    document.getElementById('localMedia').style.display = 'none';
    document.getElementById('audioPlayer').style.display = 'none';
    document.getElementById('mediaLabel').textContent = '';
    var yt = document.getElementById('player');
    yt.style.display = 'block';
    window._currentYtVideoId = v;
    _ytRetryCount = 0;
    loadYoutubeVideo(v);
    detectSongFromYouTube(url);
    startMediaProgressUpdate();
}

function loadYoutubeVideo(videoId) {
    if (window.ytPlayer) {
        try {
            window.ytPlayer.loadVideoById(videoId);
            applyVolumeToYT(_currentVolume);
        } catch (e) {
            console.warn('YouTube load error, retrying...', e);
            retryYoutubeLoad(videoId);
        }
    } else {
        if (typeof YT !== 'undefined' && YT.Player) {
            window.ytPlayer = new YT.Player('player', {
                height: '315',
                width: '100%',
                videoId: videoId,
                events: {
                    onError: function() { retryYoutubeLoad(videoId); },
                    onReady: function() { applyVolumeToYT(_currentVolume); }
                }
            });
        } else {
            setTimeout(function() {
                loadYoutubeVideo(videoId);
            }, 500);
        }
    }
}

function retryYoutubeLoad(videoId) {
    _ytRetryCount++;
    if (_ytRetryCount > _ytRetryMax) {
        showToast('⚠️ YouTube video failed to load. Please refresh and try again.');
        return;
    }
    showToast('🔄 Retrying YouTube load... (' + _ytRetryCount + '/' + _ytRetryMax + ')');
    setTimeout(function() {
        if (window.ytPlayer) {
            try {
                window.ytPlayer.loadVideoById(videoId);
                applyVolumeToYT(_currentVolume);
            } catch (e) {
                retryYoutubeLoad(videoId);
            }
        } else {
            loadYoutubeVideo(videoId);
        }
    }, 1000);
}

function detectSongFromYouTube(url) {
    fetch('https://noembed.com' + encodeURIComponent(url))
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.title) {
                document.getElementById('songTitle').value = data.title;
            }
        })
        .catch(function() { /* silent fail */ });
}

function detectSongFromFile(file) {
    if (file.type.indexOf('audio/') === 0 || file.type.indexOf('video/') === 0) {
        var name = file.name.replace(/\.[^/.]+$/, "");
        document.getElementById('songTitle').value = name;
    }
}

function getCurrentPlayerTime() {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    if (vid && vid.style.display !== 'none' && vid.currentTime) return vid.currentTime;
    if (aud && aud.style.display !== 'none' && aud.currentTime) return aud.currentTime;
    if (window.ytPlayer && window.ytPlayer.getCurrentTime) return window.ytPlayer.getCurrentTime();
    return 0;
}

// ── VOLUME ──
function applyVolumeToMedia(el) {
    if (el) el.volume = _currentVolume;
}

function applyVolumeToYT(vol) {
    if (window.ytPlayer && window.ytPlayer.setVolume) {
        window.ytPlayer.setVolume(Math.round(vol * 100));
    }
}

function setVolume(vol) {
    _currentVolume = Math.max(0, Math.min(1, vol));
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    if (vid && vid.style.display !== 'none') vid.volume = _currentVolume;
    if (aud && aud.style.display !== 'none') aud.volume = _currentVolume;
    applyVolumeToYT(_currentVolume);
    var label = document.getElementById('volumeLabel');
    if (label) label.textContent = Math.round(_currentVolume * 100) + '%';
}

// ── PROGRESS BAR ──
function startMediaProgressUpdate() {
    if (_mediaUpdateInterval) clearInterval(_mediaUpdateInterval);
    _mediaUpdateInterval = setInterval(updateMediaProgress, 300);
}

function stopMediaProgressUpdate() {
    if (_mediaUpdateInterval) {
        clearInterval(_mediaUpdateInterval);
        _mediaUpdateInterval = null;
    }
}

function updateMediaProgress() {
    var current = getCurrentPlayerTime();
    var duration = getPlayerDuration();
    var fill = document.getElementById('mediaProgressFill');
    var currentDisplay = document.getElementById('currentTimeDisplay');
    var durationDisplay = document.getElementById('durationDisplay');

    if (fill) {
        var pct = duration > 0 ? (current / duration * 100) : 0;
        fill.style.width = Math.min(pct, 100) + '%';
    }
    if (currentDisplay) currentDisplay.textContent = formatTime(current);
    if (durationDisplay) durationDisplay.textContent = formatTime(duration);

    var resultModal = document.getElementById('resultModal');
    if (resultModal && resultModal.style.display === 'flex') {
        updateTimelineProgress(current);
    }
}

function getPlayerDuration() {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    if (vid && vid.style.display !== 'none' && vid.duration) return vid.duration;
    if (aud && aud.style.display !== 'none' && aud.duration) return aud.duration;
    if (window.ytPlayer && window.ytPlayer.getDuration) return window.ytPlayer.getDuration() || 0;
    return 0;
}

// ── PLAYER CONTROL ──
function togglePlayerPlayback() {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    if (window.ytPlayer && window.ytPlayer.getPlayerState) {
        var state = window.ytPlayer.getPlayerState();
        if (state === 1) {
            window.ytPlayer.pauseVideo();
        } else if (state === 2) {
            window.ytPlayer.playVideo();
        } else {
            window.ytPlayer.playVideo();
        }
        return;
    }
    if (vid && vid.style.display !== 'none' && vid.src) {
        vid.paused ? vid.play() : vid.pause();
        return;
    }
    if (aud && aud.style.display !== 'none' && aud.src) {
        aud.paused ? aud.play() : aud.pause();
        return;
    }
}

function stopPlayer() {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    var ytPlayer = window.ytPlayer;
    
    if (vid && vid.style.display !== 'none' && vid.src) {
        vid.pause();
        vid.currentTime = 0;
    }
    if (aud && aud.style.display !== 'none' && aud.src) {
        aud.pause();
        aud.currentTime = 0;
    }
    if (ytPlayer && ytPlayer.pauseVideo && ytPlayer.seekTo) {
        try {
            ytPlayer.pauseVideo();
            ytPlayer.seekTo(0, true);
        } catch(e) {}
    }
    
    playheadPx = 0;
    updatePlayheadUI();
    updateMediaProgress();
    
    // Stop semua member yang sedang hold
    var names = Object.keys(memberIntervals);
    for (var i = 0; i < names.length; i++) {
        var n = names[i];
        if (memberIntervals[n]) {
            clearInterval(memberIntervals[n]);
            memberIntervals[n] = null;
        }
        var clip = timelineData.find(function(c) { return c.member === n && c.end === 0; });
        if (clip) {
            clip.end = getCurrentPlayerTime();
            clip.duration = clip.end - clip.start;
        }
    }
    
    if (_isRecording) {
        _recordingMembers = {};
    }
    
    updateLeaderboardLive();
    reorderLeaderboard();
    updatePresentationLive();
    saveStateForUndo();
    
    showToast('⏹ Player stopped & reset');
}

function seekPlayer(seconds) {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    var ytPlayer = window.ytPlayer;
    
    var currentTime = getCurrentPlayerTime();
    var newTime = Math.max(0, currentTime + seconds);
    var duration = getPlayerDuration();
    if (newTime > duration) newTime = duration;
    
    if (ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(newTime, true);
    } else if (vid && vid.style.display !== 'none' && vid.src) {
        vid.currentTime = newTime;
    } else if (aud && aud.style.display !== 'none' && aud.src) {
        aud.currentTime = newTime;
    }
    
    playheadPx = newTime * pxPerSec;
    updatePlayheadUI();
    updateMediaProgress();
    
    if (_isRecording) {
        var names = Object.keys(memberIntervals);
        for (var i = 0; i < names.length; i++) {
            var n = names[i];
            if (memberIntervals[n]) {
                memberStartTime[n] = newTime;
            }
        }
    }
    
    var resultModal = document.getElementById('resultModal');
    if (resultModal && resultModal.style.display === 'flex') {
        updateTimelineProgress(newTime);
    }
}

function updatePlayheadUI() {
    var playhead = document.getElementById('playhead');
    if (playhead) {
        playhead.style.left = playheadPx + 'px';
    }
    var timer = document.getElementById('timeline-timer');
    if (timer) {
        var t = playheadPx / pxPerSec;
        timer.textContent = formatTime(t);
    }
}