// ══════════════════════════════════════════
//  TOTAL DURASI LIVE
// ══════════════════════════════════════════
function updateTotalDuration() {
    var el = document.getElementById('totalDurationDisplay');
    if (!el) return;
    var total = 0;
    for (var key in memberDurations) {
        total += memberDurations[key];
    }
    el.textContent = 'Total: ' + total.toFixed(1) + 's';
}

// ══════════════════════════════════════════
//  PHOTO HELPER
// ══════════════════════════════════════════
function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        var objectUrl = URL.createObjectURL(file);
        img.onload = function() {
            var MAX = 256;
            var w = img.width;
            var h = img.height;
            if (w > h) {
                if (w > MAX) { h = Math.round(h * MAX / w);
                    w = MAX; }
            } else {
                if (h > MAX) { w = Math.round(w * MAX / h);
                    h = MAX; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function() {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Gagal memuat gambar'));
        };
        img.src = objectUrl;
    });
}

function savePhotoCache() {
    localStorage.setItem('linedistro_photos', JSON.stringify(memberPhotos));
}

function loadPhotoCache() {
    var raw = localStorage.getItem('linedistro_photos');
    if (!raw) return;
    try {
        var cached = JSON.parse(raw);
        for (var n in cached) {
            var url = cached[n];
            if (url && url.indexOf('blob:') !== 0) {
                memberPhotos[n] = url;
            }
        }
    } catch (e) {
        console.warn('Failed to load photo cache', e);
    }
}

function showFileName(input, labelId, defaultText) {
    var label = document.getElementById(labelId);
    if (!label) return;
    var file = input.files[0];
    var text = file ? '📄 ' + (file.name.length > 24 ? file.name.substring(0, 22) + '…' : file.name) : defaultText;
    var span = label.querySelector('.file-label-text');
    if (!span) {
        span = document.createElement('span');
        span.className = 'file-label-text';
        var textNodes = [];
        for (var i = 0; i < label.childNodes.length; i++) {
            if (label.childNodes[i].nodeType === Node.TEXT_NODE) {
                textNodes.push(label.childNodes[i]);
            }
        }
        for (var j = 0; j < textNodes.length; j++) {
            textNodes[j].remove();
        }
        label.insertBefore(span, label.firstChild);
    }
    span.textContent = text;
}

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
// Di bagian STATE (awal file)
var _lastRenderState = ''; // tambahkan ini
var memberList = document.getElementById('memberList');
var memberDurations = {};
var memberColors = {};
var memberPhotos = {};
var memberIntervals = {};
var chartInstance = null;

// ── FITUR ──
var memberStartTime = {};
var timelineData = [];
var autoSaveInterval = null;
var historyStack = [];
var historyIndex = -1;
var _reorderPending = false;
var _avatarState = {};
var _pressReorderPending = false;
var _timelineInterval = null;
var _currentVolume = 0.8;

// ── TAB MODE ──
var _isAllMembersActive = false; // untuk toggle ALL di LYRICS

// ── AD-LIBS HOLD ──
var activeAdLibKeys = new Set();
var adLibIntervals = {};
var AD_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];

// ── LYRICS ──
var _lyricsData = [];
var _lyricsActiveIndex = -1;
var _lyricsUpdateInterval = null;

// ══════════════════════════════════════════
//  DUET / GROUP SINGING HELPER
// ══════════════════════════════════════════
function getActiveMembers() {
    var active = [];
    for (var n in memberIntervals) {
        if (memberIntervals[n]) active.push(n);
    }
    return active;
}

function getGradientForActive(colors) {
    if (!colors || colors.length === 0) return '';
    if (colors.length === 1) return colors[0];
    var stops = colors.map(function(c, i) {
        var pct = (i / (colors.length - 1)) * 100;
        return c + ' ' + pct + '%';
    });
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
}

function getAverageColor(colors) {
    if (!colors || colors.length === 0) return '#a78bfa';
    if (colors.length === 1) return colors[0];
    var r = 0,
        g = 0,
        b = 0;
    for (var i = 0; i < colors.length; i++) {
        var hex = colors[i].replace('#', '');
        var bigint = parseInt(hex, 16);
        r += (bigint >> 16) & 255;
        g += (bigint >> 8) & 255;
        b += bigint & 255;
    }
    r = Math.round(r / colors.length);
    g = Math.round(g / colors.length);
    b = Math.round(b / colors.length);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getMultiShadow(colors, intensity) {
    if (intensity === undefined) intensity = 0.5;
    if (!colors || colors.length === 0) return '';
    return colors.map(function(c) {
        var alpha = Math.round(intensity * 80).toString(16).padStart(2, '0');
        return '0 0 12px 2px ' + c + alpha;
    }).join(', ');
}

// ══════════════════════════════════════════
//  TOAST & CONFIRM & PROMPT
// ══════════════════════════════════════════
var _undoTimer = null;
var _undoCallback = null;

function showUndoToast(msg, onUndo, duration) {
    if (duration === undefined) duration = 3000;
    var t = document.getElementById('toast');
    t.innerHTML = '<span>' + msg + '</span><button class="toast-undo-btn" onclick="triggerUndo()">Undo</button>';
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.gap = '12px';
    requestAnimationFrame(function() { t.classList.add('show'); });
    clearTimeout(t._timer);
    if (_undoTimer) clearTimeout(_undoTimer);
    _undoCallback = onUndo;
    _undoTimer = setTimeout(function() {
        _undoCallback = null;
        t.classList.remove('show');
        setTimeout(function() { t.style.display = 'none';
            t.innerHTML = ''; }, 300);
    }, duration);
}

function triggerUndo() {
    clearTimeout(_undoTimer);
    var cb = _undoCallback;
    _undoCallback = null;
    var t = document.getElementById('toast');
    t.classList.remove('show');
    setTimeout(function() { t.style.display = 'none';
        t.innerHTML = ''; }, 300);
    if (cb) cb();
}

function showToast(msg, duration) {
    if (duration === undefined) duration = 2800;
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    requestAnimationFrame(function() { t.classList.add('show'); });
    clearTimeout(t._timer);
    t._timer = setTimeout(function() {
        t.classList.remove('show');
        setTimeout(function() { t.style.display = 'none'; }, 300);
    }, duration);
}

var _confirmCallback = null;

function showConfirm(_ref) {
    var icon = _ref.icon !== undefined ? _ref.icon : '⚠️';
    var title = _ref.title !== undefined ? _ref.title : 'Konfirmasi';
    var msg = _ref.msg !== undefined ? _ref.msg : '';
    var okLabel = _ref.okLabel !== undefined ? _ref.okLabel : 'Ya';
    var okClass = _ref.okClass !== undefined ? _ref.okClass : 'btn-danger';
    var onOk = _ref.onOk;
    document.getElementById('confirmIcon').textContent = icon;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    var okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okLabel;
    okBtn.className = okClass;
    _confirmCallback = onOk;
    var modal = document.getElementById('confirmModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

function closeConfirm() {
    var modal = document.getElementById('confirmModal');
    modal.style.display = 'none';
    modal.style.zIndex = '';
    _confirmCallback = null;
}

function confirmOk() {
    document.getElementById('confirmModal').style.display = 'none';
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
}
document.getElementById('confirmOkBtn').addEventListener('click', confirmOk);

var _promptCallback = null;

function showPrompt(_ref2) {
    var icon = _ref2.icon !== undefined ? _ref2.icon : '✏️';
    var title = _ref2.title !== undefined ? _ref2.title : '';
    var sub = _ref2.sub !== undefined ? _ref2.sub : '';
    var placeholder = _ref2.placeholder !== undefined ? _ref2.placeholder : '';
    var onOk = _ref2.onOk;
    document.getElementById('promptTitle').textContent = title;
    document.getElementById('promptSub').textContent = sub;
    var inp = document.getElementById('promptInput');
    inp.placeholder = placeholder;
    inp.value = '';
    _promptCallback = onOk;
    document.getElementById('promptModal').style.display = 'flex';
    setTimeout(function() { inp.focus(); }, 100);
}

function closePrompt() {
    document.getElementById('promptModal').style.display = 'none';
    _promptCallback = null;
}

function confirmPrompt() {
    var val = document.getElementById('promptInput').value.trim();
    if (!val) { showToast('⚠️ Name cannot be empty'); return; }
    closePrompt();
    if (_promptCallback) _promptCallback(val);
}
document.getElementById('promptInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') confirmPrompt();
    if (e.key === 'Escape') closePrompt();
});

// ══════════════════════════════════════════
//  1. RENDER MEMBER STRIP
// ══════════════════════════════════════════
var memberStrip = document.getElementById('memberStrip');

function renderStripItem(n, c, p, index) {
    var item = document.createElement('div');
    item.className = 'strip-item';
    item.dataset.name = n;
    item.style.setProperty('--strip-color', c);
    var keyLabel = index < 9 ? index + 1 : index === 9 ? '0' : '';
    var adLabel = index < 10 ? 'QWERTYUIOP'[index] : '';
    var keyBadge = keyLabel !== '' ? '<span class="strip-key">' + keyLabel + '</span>' : '';
    var adBadge = adLabel !== '' ? '<span class="strip-ad-key">' + adLabel + '</span>' : '';
    var tooltip = index < 10 ? 'Hold [' + (keyLabel || '0') + '] · Hold [' + adLabel + '] Ad-Lib' : 'Hold to record';
    item.title = tooltip;
    item.innerHTML = '\n        <div class="strip-avatar-wrap" id="sav-' + CSS.escape(n) + '">\n            <img src="' + p + '" class="strip-avatar" onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(n) + '&background=random\'">\n            ' + keyBadge + '\n            ' + adBadge + '\n        </div>\n        <div class="strip-name">' + n + '</div>\n        <div class="strip-time" id="strip-time-' + CSS.escape(n) + '">' + (memberDurations[n] || 0).toFixed(1) + 's</div>\n        <div class="strip-tooltip">' + tooltip + '</div>';
    memberStrip.appendChild(item);

    var wrap = item.querySelector('.strip-avatar-wrap');
    var timeLabel = item.querySelector('.strip-time');
    var rippleInterval = null;

    function spawnRipple() {
        var dot = document.createElement('span');
        dot.className = 'ripple-dot';
        dot.style.width = '70px';
        dot.style.height = '70px';
        dot.style.left = '50%';
        dot.style.top = '50%';
        wrap.appendChild(dot);
        setTimeout(function() { dot.remove(); }, 1100);
    }

    function startHold() {
        if (memberIntervals[n]) return;
        item.classList.add('holding');
        spawnRipple();
        rippleInterval = setInterval(spawnRipple, 550);
        var startTime = Date.now();
        var startDuration = memberDurations[n] || 0;
        memberStartTime[n] = getCurrentPlayerTime();
        memberIntervals[n] = setInterval(function() {
            var elapsed = (Date.now() - startTime) / 1000;
            memberDurations[n] = startDuration + elapsed;
            timeLabel.textContent = memberDurations[n].toFixed(1) + 's';
            updateLeaderboardLive();
            updateTotalDuration();
            updatePresentationLive();
            reorderLeaderboard();
        }, 50);
        saveStateForUndo();
    }

    function stopHold() {
        if (!memberIntervals[n]) return;
        clearInterval(memberIntervals[n]);
        memberIntervals[n] = null;
        clearInterval(rippleInterval);
        rippleInterval = null;
        item.classList.remove('holding');
        var endTime = getCurrentPlayerTime();
        var start = memberStartTime[n] || 0;
        var dur = memberDurations[n] || 0;
        if (dur > 0.1) {
            timelineData.push({
                member: n,
                start: start,
                end: endTime,
                duration: dur
            });
        }
        updateLeaderboardLive();
        reorderLeaderboard();
        updatePresentationLive();
        saveStateForUndo();
    }

    item.addEventListener('mousedown', startHold);
    item.addEventListener('mouseup', stopHold);
    item.addEventListener('mouseleave', stopHold);
    item.addEventListener('touchstart', function(e) { e.preventDefault();
        startHold(); if (navigator.vibrate) navigator.vibrate(8); }, { passive: false });
    item.addEventListener('touchend', function(e) { e.preventDefault();
        stopHold(); }, { passive: false });
    item.addEventListener('touchcancel', stopHold);
}

function reloadMemberStrip() {
    memberStrip.innerHTML = '';
    var names = Object.keys(memberDurations);
    for (var i = 0; i < names.length; i++) {
        var n = names[i];
        renderStripItem(n, memberColors[n], memberPhotos[n], i);
    }
}

// ══════════════════════════════════════════
//  1b. LEADERBOARD
// ══════════════════════════════════════════
function renderMemberCard(n, c, p, d) {
    var card = document.createElement('div');
    card.className = 'member-card';
    card.style.borderLeftColor = c;
    card.style.setProperty('--pulse-color', c + '66');
    card.dataset.name = n;
    card.innerHTML = '\n        <div class="member-card-inner">\n            <span class="rank-num">1</span>\n            <img src="' + p + '" class="member-avatar"\n                 style="border-color:' + c + '; box-shadow:0 0 10px 2px ' + c + '44; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.5s ease;"\n                 onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(n) + '&background=random\'">\n            <div class="member-text">\n                <div class="member-name-row">\n                    <span class="member-name">' + n + '</span>\n                    <div class="member-time-wrap">\n                        <span class="rec-dot" style="margin-right:4px;"></span>\n                        <span class="member-time" id="time-' + CSS.escape(n) + '">' + d.toFixed(1) + 's</span>\n                    </div>\n                </div>\n                <div class="member-bar-wrap">\n                    <div class="member-bar" id="bar-' + CSS.escape(n) + '"\n                         style="background:linear-gradient(90deg,' + c + '88,' + c + '); transform:scaleX(0); transition: transform 0.15s linear, background 0.3s ease, box-shadow 0.3s ease;"></div>\n                </div>\n            </div>\n            <div class="member-actions">\n                <button class="btn-sm" onclick="resetMember(\'' + n + '\')" title="Reset">↺</button>\n                <button class="btn-sm del" onclick="confirmDeleteMember(\'' + n + '\')" title="Delete">✕</button>\n            </div>\n        </div>';
    return card;
}

function reloadMemberList() {
    memberList.innerHTML = '';
    var names = Object.keys(memberDurations);
    var hint = document.getElementById('emptyHint');
    hint.style.display = names.length === 0 ? 'flex' : 'none';
    var sorted = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    for (var i = 0; i < sorted.length; i++) {
        var n = sorted[i];
        memberList.appendChild(renderMemberCard(n, memberColors[n], memberPhotos[n], memberDurations[n]));
    }
    applyRankStyles();
    refreshEditDropdown();
    updateLeaderboardLive();
}

function applyRankStyles() {
    var all = document.querySelectorAll('.member-card');
    for (var j = 0; j < all.length; j++) {
        var card = all[j];
        card.classList.remove('rank-1', 'rank-2', 'rank-3');
        if (j === 0) card.classList.add('rank-1');
        if (j === 1) card.classList.add('rank-2');
        if (j === 2) card.classList.add('rank-3');
        var rankEl = card.querySelector('.rank-num');
        if (rankEl) rankEl.textContent = (j + 1);
    }
}

// ══════════════════════════════════════════
//  UPDATE LEADERBOARD
// ══════════════════════════════════════════
function updateLeaderboardLive() {
    var all = document.querySelectorAll('.member-card');
    var currentMax = 0;
    for (var i = 0; i < all.length; i++) {
        var val = memberDurations[all[i].dataset.name] || 0;
        if (val > currentMax) currentMax = val;
    }
    if (currentMax < 0.001) currentMax = 0.001;

    var activeMembers = getActiveMembers();
    var isDuet = activeMembers.length >= 2;
    var duetColors = isDuet ? activeMembers.map(function(n) { return memberColors[n] || '#a78bfa'; }) : [];
    var avgColor = isDuet ? getAverageColor(duetColors) : null;
    var gradientBar = isDuet ? getGradientForActive(duetColors) : null;
    var multiShadow = isDuet ? getMultiShadow(duetColors, 0.6) : '';

    for (var j = 0; j < all.length; j++) {
        var card = all[j];
        var n = card.dataset.name;
        var el = card.querySelector('.member-time');
        if (el) el.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
        var avatar = card.querySelector('.member-avatar');
        var isActive = !!memberIntervals[n];
        var c = memberColors[n] || '#a78bfa';
        var isInDuet = isDuet && isActive;

        if (isActive) {
            if (!card.classList.contains('is-active')) {
                card.classList.add('is-active');
            }
            if (avatar) {
                if (isInDuet) {
                    avatar.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out';
                    avatar.style.transform = 'scale(1.18)';
                    avatar.style.borderColor = avgColor;
                    avatar.style.boxShadow = '0 0 22px 6px ' + avgColor + '66, ' + multiShadow;
                    avatar.dataset.duet = 'true';
                } else {
                    avatar.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out';
                    avatar.style.transform = 'scale(1.18)';
                    avatar.style.borderColor = c;
                    avatar.style.boxShadow = '0 0 22px 6px ' + c + '66';
                    avatar.dataset.duet = 'false';
                }
                _avatarState[n] = 'active';
            }
        } else {
            if (card.classList.contains('is-active')) {
                card.classList.remove('is-active');
                void card.offsetWidth;
            }
            if (avatar) {
                if (_avatarState[n] !== 'inactive') {
                    avatar.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.5s ease';
                    avatar.style.transform = 'scale(1)';
                    avatar.style.borderColor = c;
                    avatar.style.boxShadow = '0 0 10px 2px ' + c + '44';
                    _avatarState[n] = 'inactive';
                }
            }
        }

        var bar = card.querySelector('.member-bar');
        if (bar) {
            var pct = (memberDurations[n] || 0) / currentMax;
            if (pct > 1) pct = 1;
            bar.style.transform = 'scaleX(' + pct + ')';

            if (isInDuet) {
                bar.style.background = gradientBar;
                bar.style.boxShadow = '0 0 12px ' + avgColor;
                bar.style.transition = 'transform 0.15s linear, background 0.3s ease, box-shadow 0.3s ease';
            } else if (isActive) {
                bar.style.background = 'linear-gradient(90deg, ' + c + '88, ' + c + ')';
                bar.style.boxShadow = '';
                bar.style.transition = 'transform 0.15s linear, background 0.3s ease, box-shadow 0.3s ease';
            } else {
                bar.style.background = 'linear-gradient(90deg, ' + c + '88, ' + c + ')';
                bar.style.boxShadow = '';
                bar.style.transition = 'transform 0.15s linear, background 0.3s ease, box-shadow 0.3s ease';
            }
        }
    }
}

function reorderLeaderboard() {
    if (_reorderPending) return;
    _reorderPending = true;
    requestAnimationFrame(function() {
        _reorderPending = false;
        var cards = document.querySelectorAll('.member-card');
        if (cards.length === 0) return;

        var sortedNames = Object.keys(memberDurations).slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });

        var currentOrder = [];
        for (var i = 0; i < cards.length; i++) {
            currentOrder.push(cards[i].dataset.name);
        }
        var same = true;
        if (currentOrder.length === sortedNames.length) {
            for (var j = 0; j < sortedNames.length; j++) {
                if (currentOrder[j] !== sortedNames[j]) { same = false; break; }
            }
        } else {
            same = false;
        }
        if (same) return;

        var firstRects = {};
        for (var k = 0; k < cards.length; k++) {
            firstRects[cards[k].dataset.name] = cards[k].getBoundingClientRect();
        }

        var memberListEl = document.getElementById('memberList');
        for (var l = 0; l < sortedNames.length; l++) {
            var n = sortedNames[l];
            var card = null;
            for (var m = 0; m < cards.length; m++) {
                if (cards[m].dataset.name === n) { card = cards[m]; break; }
            }
            if (card) memberListEl.appendChild(card);
        }
        applyRankStyles();

        for (var o = 0; o < sortedNames.length; o++) {
            var name = sortedNames[o];
            var card2 = null;
            for (var p = 0; p < cards.length; p++) {
                if (cards[p].dataset.name === name) { card2 = cards[p]; break; }
            }
            if (!card2) continue;
            var first = firstRects[name];
            var last = card2.getBoundingClientRect();
            if (!first) continue;
            var dy = first.top - last.top;
            if (Math.abs(dy) < 1) continue;
            card2.style.transition = 'transform 0s';
            card2.style.transform = 'translateY(' + dy + 'px)';
            requestAnimationFrame(function(cardRef) {
                return function() {
                    requestAnimationFrame(function() {
                        cardRef.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        cardRef.style.transform = '';
                        setTimeout(function() { cardRef.style.transition = '';
                            cardRef.style.transform = ''; }, 600);
                    });
                };
            }(card2));
        }
    });
}

// ══════════════════════════════════════════
//  2. TAMBAH & KELOLA MEMBER
// ══════════════════════════════════════════
function addNewMember() {
    var n = document.getElementById('memberName').value.trim();
    if (!n) { showToast('⚠️ Member name cannot be empty'); return; }
    var names = Object.keys(memberDurations);
    for (var i = 0; i < names.length; i++) {
        if (names[i].toLowerCase() === n.toLowerCase()) {
            showToast('⚠️ Member "' + n + '" already exists');
            return;
        }
    }
    var color = document.getElementById('memberColor').value;
    var f = document.getElementById('memberPhoto').files[0];
    if (f) {
        fileToBase64(f).then(function(url) {
            finalizeAddMember(n, color, url);
        }).catch(function(err) {
            console.error(err);
            showToast('❌ Failed to load photo');
        });
        return;
    }
    var photoUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(n) + '&background=random&color=fff';
    finalizeAddMember(n, color, photoUrl);
}

function finalizeAddMember(n, color, photoUrl) {
    memberDurations[n] = 0;
    memberColors[n] = color;
    memberPhotos[n] = photoUrl;
    document.getElementById('memberName').value = '';
    document.getElementById('memberPhoto').value = '';
    var photoLabel = document.getElementById('memberPhotoLabel');
    if (photoLabel) {
        var span = photoLabel.querySelector('.file-label-text');
        if (span) span.textContent = '🖼 Foto';
    }
    savePhotoCache();
    reloadMemberStrip();
    reloadMemberList();
    saveStateForUndo();
    showToast('✅ ' + n + ' added');
}

function resetMember(n) {
    if (memberIntervals[n]) { clearInterval(memberIntervals[n]);
        memberIntervals[n] = null; }
    var prev = memberDurations[n];
    memberDurations[n] = 0;
    reloadMemberStrip();
    reloadMemberList();
    saveStateForUndo();
    showUndoToast('↺ Reset ' + n, function() {
        memberDurations[n] = prev;
        reloadMemberStrip();
        reloadMemberList();
        saveStateForUndo();
        showToast('↩ Undo reset ' + n);
    });
}

function confirmDeleteMember(n) {
    showConfirm({ icon: '🗑', title: 'Delete ' + n + '?', msg: 'Recorded durations will be lost.', okLabel: 'Delete', okClass: 'btn-danger', onOk: function() { deleteMember(n); } });
}

function deleteMember(n) {
    if (memberIntervals[n]) clearInterval(memberIntervals[n]);
    delete memberDurations[n];
    delete memberColors[n];
    delete memberPhotos[n];
    delete memberIntervals[n];
    savePhotoCache();
    reloadMemberStrip();
    reloadMemberList();
    saveStateForUndo();
    showToast('🗑 ' + n + ' deleted');
}

// ══════════════════════════════════════════
//  RESET ALL
// ══════════════════════════════════════════
function confirmResetAll() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('⚠️ No members yet'); return; }
    showConfirm({
        icon: '↺',
        title: 'Reset All?',
        msg: 'This will reset ALL member durations, player position, and timeline. Are you sure?',
        okLabel: 'Reset All',
        okClass: 'btn-primary',
        onOk: function() {
            resetAllData();
        }
    });
}

function resetAllData() {
    var names = Object.keys(memberDurations);
    for (var i = 0; i < names.length; i++) {
        var n = names[i];
        if (memberIntervals[n]) {
            clearInterval(memberIntervals[n]);
            memberIntervals[n] = null;
        }
        memberDurations[n] = 0;
    }
    timelineData = [];
    resetPlayerToStart();
    reloadMemberStrip();
    reloadMemberList();
    updateTotalDuration();
    updateLeaderboardLive();
    saveStateForUndo();
    showToast('↺ All data reset successfully');
}

function resetPlayerToStart() {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    var ytPlayer = window.ytPlayer;

    if (vid && vid.style.display !== 'none' && vid.src) {
        vid.currentTime = 0;
        vid.pause();
    }
    if (aud && aud.style.display !== 'none' && aud.src) {
        aud.currentTime = 0;
        aud.pause();
    }
    if (ytPlayer && ytPlayer.seekTo) {
        try {
            ytPlayer.seekTo(0, true);
            ytPlayer.pauseVideo();
        } catch (e) {
            console.log('⚠️ YouTube seek failed:', e);
        }
    }
    updateMediaProgress();
}

// ══════════════════════════════════════════
//  3. EDIT MEMBER
// ══════════════════════════════════════════
function refreshEditDropdown() {
    var sel = document.getElementById('editMemberSelect');
    var cur = sel.value;
    sel.innerHTML = '<option value="">— Select member —</option>';
    var names = Object.keys(memberDurations);
    for (var i = 0; i < names.length; i++) {
        var o = document.createElement('option');
        o.value = names[i];
        o.textContent = names[i];
        sel.appendChild(o);
    }
    if (cur && memberDurations[cur] !== undefined) sel.value = cur;
}

function openEditMenu() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('⚠️ No members yet'); return; }
    refreshEditDropdown();
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }

function populateEditForm() {
    var n = document.getElementById('editMemberSelect').value;
    if (!n) return;
    document.getElementById('editMemberName').value = n;
    document.getElementById('editMemberColor').value = memberColors[n] || '#a78bfa';
}

function applyEdit() {
    var oldName = document.getElementById('editMemberSelect').value;
    var newName = document.getElementById('editMemberName').value.trim();
    var newColor = document.getElementById('editMemberColor').value;
    var newPhotoFile = document.getElementById('editMemberPhoto').files[0];
    if (!oldName) { showToast('⚠️ Select a member first'); return; }
    if (!newName) { showToast('⚠️ Name cannot be empty'); return; }
    if (newName !== oldName) {
        var names = Object.keys(memberDurations);
        for (var i = 0; i < names.length; i++) {
            if (names[i].toLowerCase() === newName.toLowerCase()) {
                showToast('⚠️ Member "' + newName + '" already exists');
                return;
            }
        }
    }
    var newPhoto = memberPhotos[oldName] || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(oldName) + '&background=random';
    if (newPhotoFile) {
        fileToBase64(newPhotoFile).then(function(url) {
            newPhoto = url;
            applyEditFinal(oldName, newName, newColor, newPhoto);
        }).catch(function(err) {
            console.error(err);
            showToast('❌ Failed to load photo');
        });
        return;
    }
    applyEditFinal(oldName, newName, newColor, newPhoto);
}

function applyEditFinal(oldName, newName, newColor, newPhoto) {
    if (newName !== oldName) {
        memberDurations[newName] = memberDurations[oldName];
        memberColors[newName] = newColor;
        memberPhotos[newName] = newPhoto;
        if (memberIntervals[oldName]) memberIntervals[newName] = memberIntervals[oldName];
        delete memberDurations[oldName];
        delete memberColors[oldName];
        delete memberPhotos[oldName];
        delete memberIntervals[oldName];
    } else {
        memberColors[oldName] = newColor;
        memberPhotos[oldName] = newPhoto;
    }
    savePhotoCache();
    closeEditModal();
    reloadMemberStrip();
    reloadMemberList();
    saveStateForUndo();
    showToast('✅ ' + newName + ' updated');
}

// ══════════════════════════════════════════
//  4. PRESET
// ══════════════════════════════════════════
function getPresets() {
    try {
        return JSON.parse(localStorage.getItem('linedistro_presets') || '{}');
    } catch (e) {
        return {};
    }
}

function savePresets(d) { localStorage.setItem('linedistro_presets', JSON.stringify(d)); }

function refreshPresetDropdown() {
    var sel = document.getElementById('presetSelect');
    var presets = getPresets();
    sel.innerHTML = '<option value="">— Select preset —</option>';
    var names = Object.keys(presets);
    for (var i = 0; i < names.length; i++) {
        var o = document.createElement('option');
        o.value = names[i];
        o.textContent = names[i];
        sel.appendChild(o);
    }
}

function saveNewPreset() {
    var members = Object.keys(memberDurations);
    if (members.length === 0) { showToast('⚠️ Add a member first'); return; }
    var defaultName = document.getElementById('songTitle').value.trim();
    var bar = document.getElementById('presetSaveBar');
    var inp = document.getElementById('presetSaveInput');
    if (!bar || !inp) return;
    inp.value = defaultName;
    bar.style.display = 'flex';
    setTimeout(function() { inp.focus(); }, 50);
}

function doSavePreset() {
    var inp = document.getElementById('presetSaveInput');
    var name = inp ? inp.value.trim() : '';
    if (!name) { showToast('⚠️ Preset name cannot be empty'); return; }
    var members = Object.keys(memberDurations);
    var presets = getPresets();
    var data = [];
    for (var i = 0; i < members.length; i++) {
        var n = members[i];
        data.push({ name: n, color: memberColors[n], photo: memberPhotos[n] });
    }
    presets[name] = data;
    savePresets(presets);
    refreshPresetDropdown();
    var sel = document.getElementById('presetSelect');
    if (sel) { sel.value = name;
        updatePresetDropdownColor(); }
    document.getElementById('presetSaveBar').style.display = 'none';
    showToast('💾 Preset "' + name + '" saved');
}

function cancelSavePreset() { document.getElementById('presetSaveBar').style.display = 'none'; }

function updatePresetDropdownColor() {
    var sel = document.getElementById('presetSelect');
    var name = sel.value;
    if (!name) { sel.style.borderColor = ''; return; }
    var preset = getPresets()[name];
    if (!preset || preset.length === 0) return;
    var firstColor = preset[0].color || '#a78bfa';
    sel.style.borderColor = firstColor;
    sel.style.boxShadow = '0 0 0 2px ' + firstColor + '22';
}

function loadSelectedPreset() {
    var name = document.getElementById('presetSelect').value;
    if (!name) return;
    updatePresetDropdownColor();
    var preset = getPresets()[name];
    if (!preset) return;

    function doLoad() {
        memberDurations = {};
        memberColors = {};
        memberPhotos = {};
        for (var i = 0; i < preset.length; i++) {
            var m = preset[i];
            memberDurations[m.name] = 0;
            memberColors[m.name] = m.color || '#a78bfa';
            memberPhotos[m.name] = m.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name) + '&background=random';
        }
        timelineData = [];
        savePhotoCache();
        reloadMemberStrip();
        reloadMemberList();
        saveStateForUndo();
        showToast('✅ Preset "' + name + '" loaded');
    }
    var currentNames = Object.keys(memberDurations);
    if (currentNames.length > 0) {
        showConfirm({ icon: '📂', title: 'Load "' + name + '"?', msg: 'Current members will be replaced.', okLabel: 'Load', okClass: 'btn-primary', onOk: doLoad });
    } else { doLoad(); }
}

function deleteSelectedPreset() {
    var name = document.getElementById('presetSelect').value;
    if (!name) { showToast('⚠️ Select a preset first'); return; }
    showConfirm({ icon: '🗑', title: 'Delete preset "' + name + '"?', msg: 'This preset will be permanently deleted.', okLabel: 'Delete', okClass: 'btn-danger', onOk: function() {
            var presets = getPresets();
            delete presets[name];
            savePresets(presets);
            refreshPresetDropdown();
            showToast('🗑 Preset "' + name + '" deleted');
        } });
}

// ══════════════════════════════════════════
//  5. MEDIA + AUTO-DETECT + YOUTUBE RETRY + VOLUME + PROGRESS
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
    fetch('https://noembed.com/embed?url=' + encodeURIComponent(url))
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
    if (vid.style.display !== 'none' && vid.currentTime) return vid.currentTime;
    if (aud.style.display !== 'none' && aud.currentTime) return aud.currentTime;
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
    if (vid.style.display !== 'none') vid.volume = _currentVolume;
    if (aud.style.display !== 'none') aud.volume = _currentVolume;
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

    if (document.getElementById('resultModal').style.display === 'flex') {
        updateTimelineProgress(current);
    }
}

function getPlayerDuration() {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    if (vid.style.display !== 'none' && vid.duration) return vid.duration;
    if (aud.style.display !== 'none' && aud.duration) return aud.duration;
    if (window.ytPlayer && window.ytPlayer.getDuration) return window.ytPlayer.getDuration() || 0;
    return 0;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// ══════════════════════════════════════════
//  PLAYER CONTROL
// ══════════════════════════════════════════
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
    if (vid.style.display !== 'none' && vid.src) {
        vid.paused ? vid.play() : vid.pause();
        return;
    }
    if (aud.style.display !== 'none' && aud.src) {
        aud.paused ? aud.play() : aud.pause();
        return;
    }
}

function seekPlayer(seconds) {
    var vid = document.getElementById('localMedia');
    var aud = document.getElementById('audioPlayer');
    if (window.ytPlayer && window.ytPlayer.getCurrentTime) {
        var current = window.ytPlayer.getCurrentTime() || 0;
        var newTime = Math.max(0, current + seconds);
        var duration = window.ytPlayer.getDuration() || 0;
        if (newTime > duration) newTime = duration;
        window.ytPlayer.seekTo(newTime, true);
        return;
    }
    if (vid.style.display !== 'none' && vid.src) {
        var newVidTime = Math.max(0, vid.currentTime + seconds);
        if (newVidTime > vid.duration) newVidTime = vid.duration;
        vid.currentTime = newVidTime;
        return;
    }
    if (aud.style.display !== 'none' && aud.src) {
        var newAudTime = Math.max(0, aud.currentTime + seconds);
        if (newAudTime > aud.duration) newAudTime = aud.duration;
        aud.currentTime = newAudTime;
        return;
    }
}

// ══════════════════════════════════════════
//  FAIRNESS (Gini Coefficient)
// ══════════════════════════════════════════
function calculateFairness(durations) {
    var values = [];
    for (var key in durations) {
        values.push(durations[key]);
    }
    if (values.length === 0) return { gini: 0, fairness: 100 };
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var n = sorted.length;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += sorted[i];
    if (sum === 0) return { gini: 0, fairness: 100 };
    var sumIndex = 0;
    for (var j = 0; j < n; j++) {
        sumIndex += (j + 1) * sorted[j];
    }
    var gini = (2 * sumIndex) / (n * sum) - (n + 1) / n;
    if (gini < 0) gini = 0;
    if (gini > 1) gini = 1;
    var fairness = (1 - gini) * 100;
    return { gini: gini, fairness: fairness };
}

// ══════════════════════════════════════════
//  6. FINISH + RESET + TIMELINE + CHART + FAIRNESS
// ══════════════════════════════════════════
function finish() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('No members added yet'); return; }
    var total = 0;
    for (var i = 0; i < names.length; i++) {
        total += memberDurations[names[i]];
    }
    if (total === 0) { showToast('All durations are 0 — record first!'); return; }
    for (var j = 0; j < names.length; j++) {
        var n = names[j];
        if (memberIntervals[n]) { clearInterval(memberIntervals[n]);
            memberIntervals[n] = null; }
        var cards = document.querySelectorAll('.member-card');
        for (var k = 0; k < cards.length; k++) {
            if (cards[k].dataset.name === n) cards[k].classList.remove('is-active');
        }
        var si = memberStrip.querySelector('.strip-item[data-name="' + n + '"]');
        if (si) si.classList.remove('holding');
    }
    var sorted = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    var title = document.getElementById('songTitle').value.trim() || 'Untitled';
    var lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    for (var l = 0; l < sorted.length; l++) {
        var memberName = sorted[l];
        var pct = ((memberDurations[memberName] / total) * 100).toFixed(1);
        var item = document.createElement('div');
        item.className = 'rank-item';
        item.style.borderLeftColor = memberColors[memberName];
        item.innerHTML = '\n            <div class="rank-name">\n                <img src="' + memberPhotos[memberName] + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;"\n                     onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(memberName) + '\'">\n                <span class="rank-badge">' + (l + 1) + '</span>\n                <span>' + memberName + '</span>\n            </div>\n            <div class="rank-meta">\n                <span class="rank-time">' + memberDurations[memberName].toFixed(1) + 's</span>\n                <span class="rank-pct">' + pct + '%</span>\n            </div>';
        lb.appendChild(item);
    }

    var fairness = calculateFairness(memberDurations);
    var fairnessHtml = '<div style="margin-top:14px;padding:12px 16px;background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;">';
    fairnessHtml += '<span style="color:var(--text2);font-size:13px;">⚖️ Line Distribution Fairness</span>';
    var color = fairness.fairness > 70 ? '#4ade80' : fairness.fairness > 40 ? '#fbbf24' : '#f87171';
    fairnessHtml += '<span style="font-weight:700;font-size:20px;color:' + color + ';">' + fairness.fairness.toFixed(1) + '%</span>';
    fairnessHtml += '<span style="color:var(--text3);font-size:11px;margin-left:8px;">(Gini: ' + fairness.gini.toFixed(3) + ')</span>';
    fairnessHtml += '</div>';
    lb.insertAdjacentHTML('afterend', fairnessHtml);

    document.getElementById('resultSongTitle').textContent = '🎵 ' + title;
    document.getElementById('resultDateLabel').textContent = new Date().toLocaleString('en-US');
    if (chartInstance) chartInstance.destroy();
    var ctx = document.getElementById('resultChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted,
            datasets: [{
                data: sorted.map(function(n) { return memberDurations[n].toFixed(2); }),
                backgroundColor: sorted.map(function(n) { return memberColors[n]; }),
                borderColor: '#13131f',
                borderWidth: 3
            }]
        },
        options: {
            plugins: {
                legend: { labels: { color: '#9490b0', font: { family: 'Inter', size: 12 }, boxWidth: 14 } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            var pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return ' ' + ctx.parsed + 's  (' + pct + '%)';
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
    saveToHistory(title, sorted, memberDurations, memberColors, memberPhotos, total);
    document.getElementById('resultModal').style.display = 'flex';

    setTimeout(function() {
        var modalBox = document.querySelector('#resultModal .modal-box');
        var existing = document.getElementById('timelineContainer');
        if (existing) existing.remove();
        var timelineContainer = document.createElement('div');
        timelineContainer.id = 'timelineContainer';
        timelineContainer.style.cssText = 'margin-top:20px; padding:10px 0; position:relative;';
        var label = document.createElement('p');
        label.style.cssText = 'color:var(--text2);font-size:12px;margin-bottom:8px;';
        label.textContent = '⏱ Timeline (member active)';
        timelineContainer.appendChild(label);
        var canvas = document.createElement('canvas');
        canvas.width = 560;
        canvas.height = 80;
        canvas.style.cssText = 'width:100%; height:auto; background:var(--bg3); border-radius:8px; display:block;';
        timelineContainer.appendChild(canvas);
        modalBox.appendChild(timelineContainer);
        var totalDuration = getPlayerDuration() || 60;
        drawTimeline(canvas, totalDuration, getCurrentPlayerTime());

        window._timelineCanvas = canvas;
        window._timelineDuration = totalDuration;

        if (_timelineInterval) clearInterval(_timelineInterval);
        _timelineInterval = setInterval(function() {
            if (document.getElementById('resultModal').style.display === 'flex') {
                updateTimelineProgress(getCurrentPlayerTime());
            } else {
                clearInterval(_timelineInterval);
                _timelineInterval = null;
            }
        }, 500);
    }, 300);

    resetAllTimestamps();
}

function resetAllTimestamps() {
    var names = Object.keys(memberDurations);
    for (var i = 0; i < names.length; i++) {
        var n = names[i];
        if (memberIntervals[n]) { clearInterval(memberIntervals[n]);
            memberIntervals[n] = null; }
        memberDurations[n] = 0;
    }
    timelineData = [];
    reloadMemberStrip();
    reloadMemberList();
    showToast('🔄 All timestamps reset');
}

function drawTimeline(canvas, totalDuration, currentTime) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (timelineData.length === 0) {
        ctx.fillStyle = '#5a5680';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No timeline data', w/2, 40);
        return;
    }
    timelineData.sort(function(a, b) { return a.start - b.start; });
    var padding = 10;
    var barHeight = 24;
    var y = (h - barHeight) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(padding, y, w - padding*2, barHeight);
    for (var j = 0; j < timelineData.length; j++) {
        var seg = timelineData[j];
        var startX = padding + (seg.start / totalDuration) * (w - padding*2);
        var endX = padding + (seg.end / totalDuration) * (w - padding*2);
        var width = Math.max(endX - startX, 2);
        ctx.fillStyle = memberColors[seg.member] || '#a78bfa';
        ctx.shadowColor = memberColors[seg.member] || '#a78bfa';
        ctx.shadowBlur = 6;
        ctx.fillRect(startX, y, width, barHeight);
        ctx.shadowBlur = 0;
        if (width > 30) {
            ctx.fillStyle = '#fff';
            ctx.font = '9px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(seg.member, startX + width/2, y - 4);
        }
    }

    if (currentTime !== undefined && currentTime > 0 && totalDuration > 0) {
        var markerX = padding + (currentTime / totalDuration) * (w - padding*2);
        ctx.beginPath();
        ctx.moveTo(markerX, y - 4);
        ctx.lineTo(markerX, y + barHeight + 4);
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff4d4d';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(markerX - 5, y - 4);
        ctx.lineTo(markerX, y - 10);
        ctx.lineTo(markerX + 5, y - 4);
        ctx.fillStyle = '#ff4d4d';
        ctx.fill();
    }
}

function updateTimelineProgress(currentTime) {
    if (window._timelineCanvas && window._timelineDuration) {
        drawTimeline(window._timelineCanvas, window._timelineDuration, currentTime);
    }
}

function closeResultModal() {
    document.getElementById('resultModal').style.display = 'none';
    if (_timelineInterval) {
        clearInterval(_timelineInterval);
        _timelineInterval = null;
    }
}

// ══════════════════════════════════════════
//  7. HISTORY
// ══════════════════════════════════════════
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('linedistro_history') || '[]');
    } catch (e) {
        return [];
    }
}

function saveHistory(d) { localStorage.setItem('linedistro_history', JSON.stringify(d)); }

function saveToHistory(title, sorted, durations, colors, photos, total) {
    var history = getHistory();
    var entry = {
        id: Date.now(),
        title: title,
        date: new Date().toLocaleString('en-US'),
        totalDuration: total,
        members: sorted.map(function(n) {
            return {
                name: n,
                duration: durations[n],
                color: colors[n],
                photo: photos[n],
                pct: ((durations[n] / total) * 100).toFixed(1)
            };
        })
    };
    history.unshift(entry);
    saveHistory(history);
}

function getMemberStats(memberName) {
    var history = getHistory();
    var result = [];
    for (var i = 0; i < history.length; i++) {
        var entry = history[i];
        var found = null;
        for (var j = 0; j < entry.members.length; j++) {
            if (entry.members[j].name === memberName) { found = entry.members[j]; break; }
        }
        if (found) {
            result.push({ title: entry.title, date: entry.date, duration: found.duration, pct: parseFloat(found.pct) });
        }
    }
    return result.reverse();
}

function openMemberStats(memberName) {
    var stats = getMemberStats(memberName);
    if (stats.length < 2) { showToast('⚠️ Need at least 2 history entries'); return; }
    var modal = document.getElementById('memberStatsModal');
    document.getElementById('statsModalTitle').textContent = '📈 ' + memberName;
    var canvas = document.getElementById('memberStatsChart');
    if (window._statsChart) window._statsChart.destroy();
    var ctx = canvas.getContext('2d');
    var labels = stats.map(function(s) { return s.title.length > 12 ? s.title.substring(0, 11) + '…' : s.title; });
    window._statsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duration (s)',
                data: stats.map(function(s) { return s.duration.toFixed(1); }),
                borderColor: memberColors[memberName] || '#a78bfa',
                backgroundColor: (memberColors[memberName] || '#a78bfa') + '22',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: memberColors[memberName] || '#a78bfa',
            }, {
                label: 'Share (%)',
                data: stats.map(function(s) { return s.pct; }),
                borderColor: '#67e8f9',
                backgroundColor: '#67e8f922',
                fill: false,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#67e8f9',
                yAxisID: 'y2',
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#9490b0', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#9490b0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9490b0' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Seconds', color: '#9490b0' } },
                y2: { position: 'right', ticks: { color: '#67e8f9' }, grid: { display: false }, title: { display: true, text: '%', color: '#67e8f9' } }
            }
        }
    });
    modal.style.display = 'flex';
}

function closeMemberStatsModal() { document.getElementById('memberStatsModal').style.display = 'none'; }

function openHistory() {
    var history = getHistory();
    var container = document.getElementById('historyList');
    container.innerHTML = '';
    if (history.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:30px 0;font-size:13px;">No history yet.</p>';
    } else {
        for (var i = 0; i < history.length; i++) {
            var entry = history[i];
            var card = document.createElement('div');
            card.className = 'history-card';
            var avatarsHtml = '';
            var maxAvatars = Math.min(entry.members.length, 4);
            for (var j = 0; j < maxAvatars; j++) {
                var m = entry.members[j];
                avatarsHtml += '<img src="' + m.photo + '" onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name) + '\'"/>';
            }
            var moreHtml = entry.members.length > 4 ? '<span class="history-more">+' + (entry.members.length - 4) + '</span>' : '';
            var membersHtml = '';
            for (var k = 0; k < entry.members.length; k++) {
                var member = entry.members[k];
                membersHtml += '\n                            <div class="rank-item" style="border-left-color:' + member.color + '; cursor:pointer;" onclick="openMemberStats(\'' + member.name.replace(/'/g, "\\'") + '\')">\n                                <div class="rank-name">\n                                    <img src="' + member.photo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"\n                                         onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name) + '\'">\n                                    <span class="rank-badge">' + (k + 1) + '</span>\n                                    <span>' + member.name + '</span>\n                                </div>\n                                <div class="rank-meta">\n                                    <span class="rank-time">' + member.duration.toFixed(1) + 's</span>\n                                    <span class="rank-pct">' + member.pct + '%</span>\n                                    <span style="color:var(--text3);font-size:11px;margin-left:4px;">📈</span>\n                                </div>\n                            </div>';
            }
            card.innerHTML = '\n                <div class="history-card-header" onclick="toggleHistoryDetail(' + entry.id + ')">\n                    <div>\n                        <div class="history-card-title">🎵 ' + entry.title + '</div>\n                        <div class="history-card-meta">' + entry.date + ' · Total ' + entry.totalDuration.toFixed(1) + 's</div>\n                    </div>\n                    <div style="display:flex;align-items:center;gap:6px;">\n                        <div class="history-avatars">\n                            ' + avatarsHtml + '\n                            ' + moreHtml + '\n                        </div>\n                        <span class="history-chevron" id="chev-' + entry.id + '">▾</span>\n                    </div>\n                </div>\n                <div class="history-detail" id="detail-' + entry.id + '">\n                    <div style="padding-top:10px; display:flex; flex-direction:column; gap:6px;">\n                        ' + membersHtml + '\n                    </div>\n                </div>\n                <div style="padding:8px 16px 14px; border-top:1px solid var(--border);">\n                    <button class="btn-danger-soft" style="width:100%;justify-content:center;"\n                            onclick="confirmDeleteHistoryEntry(' + entry.id + ')">🗑 Delete Entry</button>\n                </div>';
            container.appendChild(card);
        }
    }
    document.getElementById('historyModal').style.display = 'flex';
}

function toggleHistoryDetail(id) {
    var detail = document.getElementById('detail-' + id);
    var chev = document.getElementById('chev-' + id);
    var isOpen = detail.classList.contains('open');
    detail.classList.toggle('open', !isOpen);
    chev.classList.toggle('open', !isOpen);
}

function confirmDeleteHistoryEntry(id) {
    showConfirm({ icon: '🗑', title: 'Delete this entry?', msg: 'This recording data cannot be recovered.', okLabel: 'Delete', okClass: 'btn-danger', onOk: function() {
            saveHistory(getHistory().filter(function(e) { return e.id !== id; }));
            openHistory();
            showToast('🗑 History entry deleted');
        } });
}

function confirmClearHistory() {
    showConfirm({ icon: '🗑', title: 'Delete all history?', msg: 'All recording history will be permanently deleted.', okLabel: 'Delete All', okClass: 'btn-danger', onOk: function() { saveHistory([]);
            openHistory();
            showToast('🗑 All history cleared'); } });
}

function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }

// ══════════════════════════════════════════
//  8. KEYBOARD SHORTCUTS + AD-LIBS HOLD + PLAYER CONTROL + TAB
// ══════════════════════════════════════════
var activeKeyHolds = new Set();

document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // ── TAB = TOGGLE "ALL" DI LYRICS (tanpa nambah durasi) ──
    if (e.key === 'Tab') {
        e.preventDefault();
        _isAllMembersActive = !_isAllMembersActive;
        renderLyrics();
        showToast(_isAllMembersActive ? '🎤 ALL members singing together' : '↺ ALL released');
        return;
    }

    // ── PLAYER CONTROL ──
    if (e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlayerPlayback();
        return;
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekPlayer(-5);
        return;
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekPlayer(5);
        return;
    }

    // ── SHORTCUTS ──
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveNewPreset();
        return;
    }

    switch(e.key.toLowerCase()) {
        case 'z':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                undoAction();
            }
            break;
        case 'a':
            confirmResetAll();
            break;
        case 'f':
            finish();
            break;
        case 'l':
            openPresentation();
            break;
        case 'x':
            exportData();
            break;
        case 'h':
            openHistory();
            break;
        case 'n':
            document.getElementById('memberName').focus();
            break;
        case 'escape':
            var modals = document.querySelectorAll('.modal-overlay[style*="display: flex"]');
            for (var i = 0; i < modals.length; i++) {
                modals[i].style.display = 'none';
            }
            break;
    }

    // ── HOLD MEMBER (1-9, 0) ──
    var idx = parseInt(e.key) - 1;
    if (e.key === '0') idx = 9;
    if (isNaN(idx) || idx < 0 || idx > 9) {
        handleAdLibKeyDown(e);
        return;
    }
    if (activeKeyHolds.has(idx)) return;
    var items = document.querySelectorAll('.strip-item');
    var item = items[idx];
    if (!item) return;
    activeKeyHolds.add(idx);
    item.dispatchEvent(new MouseEvent('mousedown'));
});

document.addEventListener('keyup', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Abaikan tombol player & Tab
    if (e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
        return;
    }

    var idx = parseInt(e.key) - 1;
    if (e.key === '0') idx = 9;
    if (isNaN(idx) || idx < 0 || idx > 9) {
        handleAdLibKeyUp(e);
        return;
    }
    activeKeyHolds.delete(idx);
    var items = document.querySelectorAll('.strip-item');
    var item = items[idx];
    if (!item) return;
    item.dispatchEvent(new MouseEvent('mouseup'));
});

window.addEventListener('blur', function() {
    activeKeyHolds.forEach(function(idx) {
        var items = document.querySelectorAll('.strip-item');
        var item = items[idx];
        if (item) item.dispatchEvent(new MouseEvent('mouseup'));
    });
    activeKeyHolds.clear();
    activeAdLibKeys.forEach(function(idx) { clearAdLib(idx); });
    activeAdLibKeys.clear();
    for (var key in adLibIntervals) {
        clearInterval(adLibIntervals[key]);
        delete adLibIntervals[key];
    }
});

// ══════════════════════════════════════════
//  AD-LIBS HOLD (Q-P)
// ══════════════════════════════════════════
function addAdLibTime(memberName, amount) {
    if (amount === undefined) amount = 0.05;
    if (!memberDurations[memberName]) return;
    memberDurations[memberName] = (memberDurations[memberName] || 0) + amount;
    var timeLabel = document.getElementById('strip-time-' + CSS.escape(memberName));
    if (timeLabel) timeLabel.textContent = memberDurations[memberName].toFixed(1) + 's';
    updateLeaderboardLive();
    updateTotalDuration();
    updatePresentationLive();
    reorderLeaderboard();
    var overlay = document.getElementById('presentationOverlay');
    if (overlay.style.display !== 'none') {
        renderPresentationBars();
    }
    saveStateForUndo();
}

function handleAdLibKeyDown(e) {
    var key = e.key.toUpperCase();
    var idx = AD_KEYS.indexOf(key);
    if (idx < 0) return;
    if (activeAdLibKeys.has(idx)) return;
    var items = document.querySelectorAll('.strip-item');
    var item = items[idx];
    if (!item) return;
    var n = item.dataset.name;
    if (!n) return;
    activeAdLibKeys.add(idx);
    startAdLib(idx, item);
    if (adLibIntervals[idx]) clearInterval(adLibIntervals[idx]);
    adLibIntervals[idx] = setInterval(function() {
        addAdLibTime(n, 0.05);
    }, 50);
}

function handleAdLibKeyUp(e) {
    var key = e.key.toUpperCase();
    var idx = AD_KEYS.indexOf(key);
    if (idx < 0) return;
    activeAdLibKeys.delete(idx);
    clearAdLib(idx);
    if (adLibIntervals[idx]) {
        clearInterval(adLibIntervals[idx]);
        delete adLibIntervals[idx];
    }
}

function startAdLib(idx, item) {
    item.classList.add('adlib-active');
    var wrap = item.querySelector('.strip-avatar-wrap');
    if (wrap) wrap.classList.add('adlib-glow');
    var n = item.dataset.name;
    var cards = document.querySelectorAll('.member-card');
    var card = null;
    for (var i = 0; i < cards.length; i++) {
        if (cards[i].dataset.name === n) { card = cards[i]; break; }
    }
    if (card) {
        card.classList.add('adlib-card');
        var avatar = card.querySelector('.member-avatar');
        if (avatar) {
            avatar.style.borderColor = '#4ade80';
            avatar.style.boxShadow = '0 0 20px 6px rgba(74,222,128,0.6)';
        }
        var bar = card.querySelector('.member-bar');
        if (bar) {
            bar.style.background = 'linear-gradient(90deg, #4ade80, #22d3ee)';
            bar.style.boxShadow = '0 0 12px #4ade80';
        }
    }
}

function clearAdLib(idx) {
    var items = document.querySelectorAll('.strip-item');
    var item = items[idx];
    if (!item) return;
    item.classList.remove('adlib-active');
    var wrap = item.querySelector('.strip-avatar-wrap');
    if (wrap) wrap.classList.remove('adlib-glow');
    var n = item.dataset.name;
    var cards = document.querySelectorAll('.member-card');
    var card = null;
    for (var i = 0; i < cards.length; i++) {
        if (cards[i].dataset.name === n) { card = cards[i]; break; }
    }
    if (card) {
        card.classList.remove('adlib-card');
        var avatar = card.querySelector('.member-avatar');
        if (avatar) {
            avatar.style.borderColor = memberColors[n] || '#a78bfa';
            avatar.style.boxShadow = '0 0 10px 2px ' + (memberColors[n] || '#a78bfa') + '44';
        }
        var bar = card.querySelector('.member-bar');
        if (bar) {
            var c = memberColors[n] || '#a78bfa';
            bar.style.background = 'linear-gradient(90deg, ' + c + '88, ' + c + ')';
            bar.style.boxShadow = '';
        }
    }
}

// ══════════════════════════════════════════
//  UNDO/REDO
// ══════════════════════════════════════════
function saveStateForUndo() {
    var state = {
        durations: JSON.parse(JSON.stringify(memberDurations)),
        colors: JSON.parse(JSON.stringify(memberColors)),
        photos: JSON.parse(JSON.stringify(memberPhotos))
    };
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(state);
    historyIndex = historyStack.length - 1;
    if (historyStack.length > 30) {
        historyStack.shift();
        historyIndex--;
    }
}

function undoAction() {
    if (historyIndex <= 0) { showToast('Nothing to undo'); return; }
    historyIndex--;
    restoreState(historyStack[historyIndex]);
    showToast('↩ Undo');
}

function redoAction() {
    if (historyIndex >= historyStack.length - 1) { showToast('Nothing to redo'); return; }
    historyIndex++;
    restoreState(historyStack[historyIndex]);
    showToast('↪ Redo');
}

function restoreState(state) {
    memberDurations = state.durations;
    memberColors = state.colors;
    memberPhotos = state.photos;
    reloadMemberStrip();
    reloadMemberList();
    updateTotalDuration();
    updateLeaderboardLive();
    saveAutoState();
}

// ══════════════════════════════════════════
//  EXPORT DATA (X)
// ══════════════════════════════════════════
function exportData() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('No data to export'); return; }
    var total = 0;
    for (var i = 0; i < names.length; i++) {
        total += memberDurations[names[i]];
    }
    var csv = 'Member,Duration (s),Percentage\n';
    var sorted = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    for (var j = 0; j < sorted.length; j++) {
        var n = sorted[j];
        var pct = ((memberDurations[n] / total) * 100).toFixed(1);
        csv += n + ',' + memberDurations[n].toFixed(1) + ',' + pct + '%\n';
    }
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'line-distribution.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📊 Exported CSV');
}

// ══════════════════════════════════════════
//  AUTO-SAVE
// ══════════════════════════════════════════
function saveAutoState() {
    var data = {
        durations: memberDurations,
        colors: memberColors,
        photos: memberPhotos,
        songTitle: document.getElementById('songTitle').value,
        timestamp: Date.now()
    };
    localStorage.setItem('linedistro_autosave', JSON.stringify(data));
}

function loadAutoState() {
    var raw = localStorage.getItem('linedistro_autosave');
    if (!raw) return false;
    try {
        var data = JSON.parse(raw);
        if (Date.now() - data.timestamp > 86400000) {
            localStorage.removeItem('linedistro_autosave');
            return false;
        }
        memberDurations = data.durations || {};
        memberColors = data.colors || {};
        memberPhotos = data.photos || {};
        document.getElementById('songTitle').value = data.songTitle || '';
        return true;
    } catch (e) { return false; }
}

function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(saveAutoState, 10000);
}

// ══════════════════════════════════════════
//  CLEAR ALL DATA
// ══════════════════════════════════════════
function clearAllData() {
    showConfirm({
        icon: '🗑',
        title: 'Clear All Data?',
        msg: 'This will delete ALL members, durations, timeline, and auto-save data. Presets and history will be kept.',
        okLabel: 'Clear All',
        okClass: 'btn-danger',
        onOk: function() {
            memberDurations = {};
            memberColors = {};
            memberPhotos = {};
            memberIntervals = {};
            memberStartTime = {};
            timelineData = [];
            localStorage.removeItem('linedistro_autosave');
            localStorage.removeItem('linedistro_photos');
            historyStack = [];
            historyIndex = -1;
            reloadMemberStrip();
            reloadMemberList();
            updateTotalDuration();
            updateLeaderboardLive();
            showToast('🗑 All data cleared successfully');
        }
    });
}

// ══════════════════════════════════════════
//  MULTI-PROJECT
// ══════════════════════════════════════════
function getProjects() {
    try {
        return JSON.parse(localStorage.getItem('linedistro_projects') || '[]');
    } catch (e) {
        return [];
    }
}

function saveProjects(projects) {
    localStorage.setItem('linedistro_projects', JSON.stringify(projects));
}

function openProjectModal() {
    renderProjectList();
    document.getElementById('projectModal').style.display = 'flex';
}

function closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
}

function renderProjectList() {
    var container = document.getElementById('projectList');
    var projects = getProjects();
    container.innerHTML = '';
    if (projects.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px 0;font-size:13px;">No projects saved yet.</p>';
        return;
    }
    for (var i = projects.length - 1; i >= 0; i--) {
        var proj = projects[i];
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border-radius:6px;margin-bottom:6px;border-left:3px solid var(--purple);';
        div.innerHTML = '\n            <div>\n                <div style="font-weight:600;font-size:14px;">' + proj.name + '</div>\n                <div style="font-size:11px;color:var(--text3);">' + proj.songTitle + ' · ' + new Date(proj.timestamp).toLocaleDateString() + '</div>\n            </div>\n            <div style="display:flex;gap:6px;">\n                <button class="btn-sm" onclick="loadProject(\'' + proj.id + '\')" title="Load">📂</button>\n                <button class="btn-sm del" onclick="deleteProject(\'' + proj.id + '\')" title="Delete">✕</button>\n            </div>';
        container.appendChild(div);
    }
}

function saveCurrentProject() {
    var nameInput = document.getElementById('projectNameInput');
    var name = nameInput.value.trim();
    if (!name) { showToast('⚠️ Please enter a project name'); return; }

    var projects = getProjects();
    for (var i = 0; i < projects.length; i++) {
        if (projects[i].name.toLowerCase() === name.toLowerCase()) {
            showConfirm({
                icon: '⚠️',
                title: 'Project already exists',
                msg: 'A project with this name already exists. Do you want to overwrite it?',
                okLabel: 'Overwrite',
                okClass: 'btn-primary',
                onOk: function() {
                    projects = projects.filter(function(p) { return p.name.toLowerCase() !== name.toLowerCase(); });
                    doSaveProject(projects, name);
                }
            });
            return;
        }
    }
    doSaveProject(projects, name);
}

function doSaveProject(projects, name) {
    var project = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name: name,
        songTitle: document.getElementById('songTitle').value || 'Untitled',
        timestamp: Date.now(),
        data: {
            durations: memberDurations,
            colors: memberColors,
            photos: memberPhotos,
            timeline: timelineData
        }
    };
    projects.push(project);
    saveProjects(projects);
    document.getElementById('projectNameInput').value = '';
    renderProjectList();
    showToast('💾 Project "' + name + '" saved');
}

function loadProject(id) {
    var projects = getProjects();
    var project = null;
    for (var i = 0; i < projects.length; i++) {
        if (projects[i].id === id) { project = projects[i]; break; }
    }
    if (!project) { showToast('⚠️ Project not found'); return; }

    showConfirm({
        icon: '📂',
        title: 'Load "' + project.name + '"?',
        msg: 'This will replace your current session. Unsaved changes will be lost.',
        okLabel: 'Load',
        okClass: 'btn-primary',
        onOk: function() {
            var data = project.data;
            memberDurations = data.durations || {};
            memberColors = data.colors || {};
            memberPhotos = data.photos || {};
            timelineData = data.timeline || [];
            document.getElementById('songTitle').value = project.songTitle || '';
            savePhotoCache();
            reloadMemberStrip();
            reloadMemberList();
            updateTotalDuration();
            updateLeaderboardLive();
            closeProjectModal();
            showToast('✅ Project "' + project.name + '" loaded');
        }
    });
}

function deleteProject(id) {
    showConfirm({
        icon: '🗑',
        title: 'Delete this project?',
        msg: 'This project will be permanently deleted.',
        okLabel: 'Delete',
        okClass: 'btn-danger',
        onOk: function() {
            var projects = getProjects().filter(function(p) { return p.id !== id; });
            saveProjects(projects);
            renderProjectList();
            showToast('🗑 Project deleted');
        }
    });
}

// ══════════════════════════════════════════
//  9. PRESENTATION MODE
// ══════════════════════════════════════════
function openPresentation() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('⚠️ No members to present'); return; }
    var pressVid = document.getElementById('pressBgVideo');
    var pressAud = document.getElementById('pressBgAudio');
    var localVid = document.getElementById('localMedia');
    var localAud = document.getElementById('audioPlayer');

    pressVid.style.display = 'none';
    pressAud.style.display = 'none';
    pressVid.src = '';
    pressAud.src = '';

    if (localVid.style.display !== 'none' && localVid.src) {
        pressVid.src = localVid.src;
        pressVid.currentTime = localVid.currentTime;
        pressVid.style.display = 'block';
        pressVid.muted = true;
        pressVid.play().catch(function() {});
    } else if (localAud.style.display !== 'none' && localAud.src) {
        pressAud.src = localAud.src;
        pressAud.currentTime = localAud.currentTime;
        pressAud.style.display = 'block';
        pressAud.muted = true;
        pressAud.play().catch(function() {});
    } else if (window.ytPlayer) {
        var wrap = document.getElementById('pressBgVideoWrap');
        wrap.innerHTML = '';
        var videoId = window._currentYtVideoId || '';
        if (videoId) {
            wrap.innerHTML = '<iframe\n                width="100%" height="100%"\n                src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&loop=1&controls=0&rel=0&mute=1&playlist=' + videoId + '"\n                frameborder="0"\n                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"\n                allowfullscreen\n                style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">\n            </iframe>';
        }
    }

    document.getElementById('presentationOverlay').style.display = 'flex';
    renderPresentationBars();
}

function closePresentation() {
    document.getElementById('presentationOverlay').style.display = 'none';
    var pressVid = document.getElementById('pressBgVideo');
    if (pressVid) { pressVid.pause();
        pressVid.src = ''; }
    var pressAud = document.getElementById('pressBgAudio');
    if (pressAud) { pressAud.pause();
        pressAud.src = ''; }
}

function syncPresentationMedia() {
    var localVid = document.getElementById('localMedia');
    var pressVid = document.getElementById('pressBgVideo');
    var localAud = document.getElementById('audioPlayer');
    var pressAud = document.getElementById('pressBgAudio');

    if (localVid.style.display !== 'none' && pressVid.style.display !== 'none') {
        pressVid.currentTime = localVid.currentTime;
        if (!localVid.paused) pressVid.play();
        else pressVid.pause();
    } else if (localAud.style.display !== 'none' && pressAud.style.display !== 'none') {
        pressAud.currentTime = localAud.currentTime;
        if (!localAud.paused) pressAud.play();
        else pressAud.pause();
    }
    showToast('⏱ Synced');
}

function renderPresentationBars() {
    var container = document.getElementById('pressBars');
    container.innerHTML = '';
    var names = Object.keys(memberDurations);
    var maxDur = 0.001;
    for (var i = 0; i < names.length; i++) {
        if (memberDurations[names[i]] > maxDur) maxDur = memberDurations[names[i]];
    }
    var sorted = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    var title = document.getElementById('songTitle').value.trim() || 'Line Distribution';
    document.getElementById('pressSongTitle').textContent = title;
    for (var j = 0; j < sorted.length; j++) {
        var n = sorted[j];
        var barPct = (memberDurations[n] || 0) / maxDur;
        if (barPct > 1) barPct = 1;
        var c = memberColors[n] || '#a78bfa';
        var row = document.createElement('div');
        row.className = 'press-row';
        row.dataset.name = n;
        row.style.animationDelay = (j * 0.06) + 's';
        row.style.setProperty('--press-color', c);
        var isRecording = !!memberIntervals[n];
        var isAdlib = false;
        var adItems = document.querySelectorAll('.strip-item.adlib-active');
        for (var ai = 0; ai < adItems.length; ai++) {
            if (adItems[ai].dataset.name === n) { isAdlib = true; break; }
        }
        var avatarScale = isRecording ? 'scale(1.15)' : 'scale(1)';
        var avatarShadow = isRecording ? '0 0 28px 8px ' + c + '99' : (isAdlib ? '0 0 28px 8px rgba(74,222,128,0.7)' : '0 0 14px 2px ' + c + '44');
        var borderColor = isAdlib ? '#4ade80' : c;
        var barColor = isAdlib ? '#4ade80' : c;
        var barShadow = isAdlib ? 'box-shadow:0 0 12px #4ade80;' : '';
        row.innerHTML = '\n            <img src="' + memberPhotos[n] + '" class="press-avatar"\n                 id="' + pressId('pavatar-', n) + '"\n                 style="border-color:' + borderColor + '; transform:' + avatarScale + '; box-shadow:' + avatarShadow + ';"\n                 onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(n) + '&background=random\'">\n            <div class="press-member-info">\n                <span class="press-name">' + n + '</span>\n                <div class="press-bar-wrap">\n                    <div class="press-bar"\n                         id="' + pressId('pbar-', n) + '"\n                         style="transform:scaleX(' + barPct + '); background:linear-gradient(90deg,' + barColor + '99,' + barColor + ');' + barShadow + '"></div>\n                </div>\n            </div>\n            <span class="press-time" id="' + pressId('ptime-', n) + '">' + memberDurations[n].toFixed(1) + 's</span>';
        container.appendChild(row);
    }
}

function pressId(prefix, name) { return prefix + name.replace(/[^a-zA-Z0-9]/g, '_'); }

function updatePresentationLive() {
    var overlay = document.getElementById('presentationOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    var container = document.getElementById('pressBars');
    if (!container || container.children.length === 0) return;
    var rows = container.children;
    var maxDur = 0.001;
    var names = Object.keys(memberDurations);
    for (var i = 0; i < names.length; i++) {
        if (memberDurations[names[i]] > maxDur) maxDur = memberDurations[names[i]];
    }
    var adItems = document.querySelectorAll('.strip-item.adlib-active');
    var adNames = [];
    for (var ai = 0; ai < adItems.length; ai++) {
        adNames.push(adItems[ai].dataset.name);
    }

    var activeMembers = getActiveMembers();
    var isDuet = activeMembers.length >= 2;
    var duetColors = isDuet ? activeMembers.map(function(m) { return memberColors[m] || '#a78bfa'; }) : [];
    var avgColor = isDuet ? getAverageColor(duetColors) : null;
    var gradientBar = isDuet ? getGradientForActive(duetColors) : null;
    var multiShadow = isDuet ? getMultiShadow(duetColors, 0.5) : '';

    for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var n = row.dataset.name;
        var bar = row.querySelector('.press-bar');
        var time = row.querySelector('.press-time');
        var avatar = row.querySelector('.press-avatar');
        var c = memberColors[n] || '#a78bfa';
        var isRecording = !!memberIntervals[n];
        var isAdlib = adNames.indexOf(n) !== -1;
        var isInDuet = isDuet && isRecording;

        if (bar) {
            var pct = (memberDurations[n] || 0) / maxDur;
            if (pct > 1) pct = 1;
            bar.style.transform = 'scaleX(' + pct + ')';
            if (isInDuet) {
                bar.style.background = gradientBar;
                bar.style.boxShadow = '0 0 12px ' + avgColor;
                bar.style.transition = 'transform 0.1s linear, background 0.3s ease, box-shadow 0.3s ease';
            } else if (isAdlib) {
                bar.style.background = 'linear-gradient(90deg, #4ade80, #22d3ee)';
                bar.style.boxShadow = '0 0 12px #4ade80';
                bar.style.transition = 'transform 0.1s linear, background 0.3s ease, box-shadow 0.3s ease';
            } else {
                bar.style.background = 'linear-gradient(90deg, ' + c + '99, ' + c + ')';
                bar.style.boxShadow = '';
                bar.style.transition = 'transform 0.1s linear, background 0.3s ease, box-shadow 0.3s ease';
            }
        }
        if (time) time.textContent = (memberDurations[n] || 0).toFixed(1) + 's';

        if (avatar) {
            if (isInDuet) {
                avatar.style.transition = 'transform 0.2s ease, box-shadow 0.3s ease, border-color 0.3s ease';
                avatar.style.transform = 'scale(1.15)';
                avatar.style.boxShadow = '0 0 28px 8px ' + avgColor + ', ' + multiShadow;
                avatar.style.borderColor = avgColor;
            } else if (isRecording) {
                avatar.style.transition = 'transform 0.2s ease, box-shadow 0.3s ease, border-color 0.3s ease';
                avatar.style.transform = 'scale(1.15)';
                avatar.style.boxShadow = '0 0 28px 8px ' + c + '99';
                avatar.style.borderColor = c;
            } else if (isAdlib) {
                avatar.style.transition = 'transform 0.2s ease, box-shadow 0.3s ease, border-color 0.3s ease';
                avatar.style.transform = 'scale(1)';
                avatar.style.boxShadow = '0 0 28px 8px rgba(74,222,128,0.7)';
                avatar.style.borderColor = '#4ade80';
            } else {
                avatar.style.transition = 'transform 0.2s ease, box-shadow 0.3s ease, border-color 0.3s ease';
                avatar.style.transform = 'scale(1)';
                avatar.style.boxShadow = '0 0 14px 2px ' + c + '44';
                avatar.style.borderColor = c;
            }
        }
    }

    reorderPresentationBars();
}

function reorderPresentationBars() {
    if (_pressReorderPending) return;
    _pressReorderPending = true;
    requestAnimationFrame(function() {
        _pressReorderPending = false;
        var container = document.getElementById('pressBars');
        var rows = container ? container.children : [];
        if (rows.length === 0) return;

        var sortedNames = Object.keys(memberDurations).slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });

        var currentOrder = [];
        for (var i = 0; i < rows.length; i++) {
            currentOrder.push(rows[i].dataset.name);
        }
        var same = true;
        if (currentOrder.length === sortedNames.length) {
            for (var j = 0; j < sortedNames.length; j++) {
                if (currentOrder[j] !== sortedNames[j]) { same = false; break; }
            }
        } else {
            same = false;
        }
        if (same) return;

        var firstRects = {};
        for (var k = 0; k < rows.length; k++) {
            firstRects[rows[k].dataset.name] = rows[k].getBoundingClientRect();
        }

        for (var l = 0; l < sortedNames.length; l++) {
            var n = sortedNames[l];
            var row = null;
            for (var m = 0; m < rows.length; m++) {
                if (rows[m].dataset.name === n) { row = rows[m]; break; }
            }
            if (row) container.appendChild(row);
        }

        for (var o = 0; o < sortedNames.length; o++) {
            var name = sortedNames[o];
            var row2 = null;
            for (var p = 0; p < rows.length; p++) {
                if (rows[p].dataset.name === name) { row2 = rows[p]; break; }
            }
            if (!row2) continue;
            var first = firstRects[name];
            var last = row2.getBoundingClientRect();
            if (!first) continue;
            var dy = first.top - last.top;
            if (Math.abs(dy) < 1) continue;
            row2.style.transition = 'transform 0s';
            row2.style.transform = 'translateY(' + dy + 'px)';
            requestAnimationFrame(function(rowRef) {
                return function() {
                    requestAnimationFrame(function() {
                        rowRef.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        rowRef.style.transform = '';
                        setTimeout(function() { rowRef.style.transition = '';
                            rowRef.style.transform = ''; }, 600);
                    });
                };
            }(row2));
        }

        setTimeout(function() {
            _pressReorderPending = false;
        }, 600);
    });
}

// ══════════════════════════════════════════
//  LYRICS — SYNC DENGAN HOLD MEMBER + TAB "ALL"
// ══════════════════════════════════════════

function renderLyrics() {
    var container = document.getElementById('lyricsContainer');
    if (!container) return;

    var activeMembers = getActiveMembers();
    var activeDisplay = document.getElementById('activeMemberDisplay');
    var activeAvatar = document.getElementById('activeMemberAvatar');
    var activeName = document.getElementById('activeMemberName');
    var activeLyrics = document.getElementById('activeMemberLyrics');

    // ── UPDATE ACTIVE MEMBER DISPLAY ──
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
        activeAvatar.src = memberPhotos[firstMember] || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(firstMember) + '&background=random';
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

    // ── RENDER LIRIK (HANYA TEKS, TANPA EFEK) ──
    if (_lyricsData.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:30px 0;font-size:12px;">No lyrics loaded.<br>Upload a .lrc file or click 🔍 Search to fetch from online.</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < _lyricsData.length; i++) {
        var l = _lyricsData[i];
        var isCurrent = (i === _lyricsActiveIndex);
        // ── PAKAI CSS CLASS ──
        var cls = 'lyric-line';
        if (isCurrent) cls += ' active';
        if (i < _lyricsActiveIndex) cls += ' past';
        
        // ── ALL BADGE ──
        var allLabel = '';
        if (isCurrent && _isAllMembersActive) {
            allLabel = ' <span class="all-badge">ALL</span>';
        }
        
        html += '<div class="' + cls + '" data-index="' + i + '">' + l.text + allLabel + '</div>';
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

// ══════════════════════════════════════════
//  10. INIT
// ══════════════════════════════════════════
window.onload = function() {
    memberDurations = {};
    memberColors = {};
    memberPhotos = {};
    timelineData = [];

    loadPhotoCache();
    refreshPresetDropdown();
    reloadMemberStrip();
    reloadMemberList();

    var hasAuto = loadAutoState();
    if (hasAuto) {
        showToast('🔄 Auto-save restored');
        reloadMemberStrip();
        reloadMemberList();
        updateTotalDuration();
    }

    startAutoSave();
    saveStateForUndo();
    startMediaProgressUpdate();

    var volSlider = document.getElementById('volumeSlider');
    if (volSlider) {
        volSlider.value = _currentVolume * 100;
        var label = document.getElementById('volumeLabel');
        if (label) label.textContent = Math.round(_currentVolume * 100) + '%';
        volSlider.addEventListener('input', function(e) {
            var val = parseFloat(e.target.value) / 100;
            setVolume(val);
        });
    }

    var saveEditBtn = document.querySelector('#editModal .btn-primary');
    if (saveEditBtn) {
        saveEditBtn.removeAttribute('onclick');
        saveEditBtn.addEventListener('click', function(e) { e.preventDefault();
            applyEdit(); });
    }
    var addBtn = document.getElementById('addMemberBtn');
    if (addBtn) {
        addBtn.removeAttribute('onclick');
        addBtn.addEventListener('click', function(e) { e.preventDefault();
            addNewMember(); });
    }
    var promptSaveBtn = document.getElementById('promptSaveBtn');
    if (promptSaveBtn) {
        promptSaveBtn.removeAttribute('onclick');
        promptSaveBtn.addEventListener('click', function(e) { e.preventDefault();
            confirmPrompt(); });
    }
    updateTotalDuration();
    var presetSaveInput = document.getElementById('presetSaveInput');
    if (presetSaveInput) {
        presetSaveInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') doSavePreset();
            if (e.key === 'Escape') cancelSavePreset();
        });
    }
};
