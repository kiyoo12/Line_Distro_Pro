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
var memberList = document.getElementById('memberList');
var memberDurations = {};
var memberColors = {};
var memberPhotos = {};
var memberIntervals = {};
var chartInstance = null;

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
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() {
    document.getElementById('confirmModal').style.display = 'none';
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
    var tooltip = index < 10 ? 'Hold [' + (keyLabel || '0') + '] · Ad-Lib [' + adLabel + ']' : 'Hold to record';
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
        var lastReorder = Date.now();
        memberIntervals[n] = setInterval(function() {
            var elapsed = (Date.now() - startTime) / 1000;
            memberDurations[n] = startDuration + elapsed;
            timeLabel.textContent = memberDurations[n].toFixed(1) + 's';
            requestAnimationFrame(function() {
                updateLeaderboardLive();
                updateTotalDuration();
                updatePresentationLive();
            });
            if (Date.now() - lastReorder > 600) {
                lastReorder = Date.now();
                requestAnimationFrame(function() { reorderLeaderboard(); });
            }
        }, 50);
    }

    function stopHold() {
        if (!memberIntervals[n]) return;
        clearInterval(memberIntervals[n]);
        memberIntervals[n] = null;
        clearInterval(rippleInterval);
        rippleInterval = null;
        item.classList.remove('holding');
        requestAnimationFrame(function() {
            updateLeaderboardLive();
            reorderLeaderboard();
            updatePresentationLive();
        });
    }

    item.addEventListener('mousedown', startHold);
    item.addEventListener('mouseup', stopHold);
    item.addEventListener('mouseleave', stopHold);
    item.addEventListener('touchstart', function(e) { e.preventDefault();
        startHold(); }, { passive: false });
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
    card.innerHTML = '\n        <div class="member-card-inner">\n            <span class="rank-num">1</span>\n            <img src="' + p + '" class="member-avatar"\n                 style="border-color:' + c + '; box-shadow:0 0 10px 2px ' + c + '44; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);"\n                 onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(n) + '&background=random\'">\n            <div class="member-text">\n                <div class="member-name-row">\n                    <span class="member-name">' + n + '</span>\n                    <div class="member-time-wrap">\n                        <span class="rec-dot" style="margin-right:4px;"></span>\n                        <span class="member-time" id="time-' + CSS.escape(n) + '">' + d.toFixed(1) + 's</span>\n                    </div>\n                </div>\n                <div class="member-bar-wrap">\n                    <div class="member-bar" id="bar-' + CSS.escape(n) + '"\n                         style="background:linear-gradient(90deg,' + c + '88,' + c + '); transform:scaleX(0); transition: transform 0.15s linear;"></div>\n                </div>\n            </div>\n            <div class="member-actions">\n                <button class="btn-sm" onclick="resetMember(\'' + n + '\')" title="Reset">↺</button>\n                <button class="btn-sm del" onclick="confirmDeleteMember(\'' + n + '\')" title="Delete">✕</button>\n            </div>\n        </div>';
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
    // Update max durasi
    updateMaxDurEver();
}

function applyRankStyles() {
    var all = document.querySelectorAll('.member-card');
    var maxDur = 0.001;
    for (var i = 0; i < all.length; i++) {
        var val = memberDurations[all[i].dataset.name] || 0;
        if (val > maxDur) maxDur = val;
    }
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
//  UPDATE LEADERBOARD — pakai _maxDurEver agar bar tidak turun
// ══════════════════════════════════════════
var _maxDurEver = 0.001;
var _avatarState = {};
var _updatePending = false;

function updateMaxDurEver() {
    var all = document.querySelectorAll('.member-card');
    var currentMax = 0;
    for (var i = 0; i < all.length; i++) {
        var val = memberDurations[all[i].dataset.name] || 0;
        if (val > currentMax) currentMax = val;
    }
    if (currentMax > _maxDurEver) {
        _maxDurEver = currentMax;
    }
    if (_maxDurEver < 0.001) _maxDurEver = 0.001;
}

function updateLeaderboardLive() {
    if (_updatePending) return;
    _updatePending = true;
    requestAnimationFrame(function() {
        _updatePending = false;
        var all = document.querySelectorAll('.member-card');
        // Update _maxDurEver jika ada durasi yang lebih tinggi
        var currentMax = 0;
        for (var i = 0; i < all.length; i++) {
            var val = memberDurations[all[i].dataset.name] || 0;
            if (val > currentMax) currentMax = val;
        }
        if (currentMax > _maxDurEver) {
            _maxDurEver = currentMax;
        }
        if (_maxDurEver < 0.001) _maxDurEver = 0.001;

        for (var j = 0; j < all.length; j++) {
            var card = all[j];
            var n = card.dataset.name;
            var el = card.querySelector('.member-time');
            if (el) el.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
            var avatar = card.querySelector('.member-avatar');
            var isActive = !!memberIntervals[n];

            if (isActive) {
                if (!card.classList.contains('is-active')) {
                    card.classList.add('is-active');
                }
                if (avatar) {
                    avatar.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out';
                    avatar.style.transform = 'scale(1.18)';
                    avatar.style.boxShadow = '0 0 22px 6px ' + (memberColors[n] || '#a78bfa') + '66';
                    _avatarState[n] = 'active';
                }
            } else {
                if (card.classList.contains('is-active')) {
                    card.classList.remove('is-active');
                    void card.offsetWidth;
                }
                if (avatar) {
                    if (_avatarState[n] !== 'inactive') {
                        avatar.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                        avatar.style.transform = 'scale(1)';
                        avatar.style.boxShadow = '0 0 10px 2px ' + (memberColors[n] || '#a78bfa') + '44';
                        _avatarState[n] = 'inactive';
                    }
                }
            }
            var bar = card.querySelector('.member-bar');
            if (bar) {
                var pct = (memberDurations[n] || 0) / _maxDurEver;
                if (pct > 1) pct = 1;
                bar.style.transform = 'scaleX(' + pct + ')';
            }
        }
    });
}

function reorderLeaderboard() {
    var cards = document.querySelectorAll('.member-card');
    if (cards.length === 0) return;
    var firstRects = {};
    for (var i = 0; i < cards.length; i++) {
        firstRects[cards[i].dataset.name] = cards[i].getBoundingClientRect();
    }
    var names = Object.keys(memberDurations);
    var sortedNames = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    var memberListEl = document.getElementById('memberList');
    for (var j = 0; j < sortedNames.length; j++) {
        var n = sortedNames[j];
        var card = null;
        for (var k = 0; k < cards.length; k++) {
            if (cards[k].dataset.name === n) { card = cards[k]; break; }
        }
        if (card) memberListEl.appendChild(card);
    }
    applyRankStyles();
    for (var l = 0; l < sortedNames.length; l++) {
        var name = sortedNames[l];
        var card2 = null;
        for (var m = 0; m < cards.length; m++) {
            if (cards[m].dataset.name === name) { card2 = cards[m]; break; }
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
    // update _maxDurEver
    updateMaxDurEver();
    showToast('✅ ' + n + ' added');
}

function resetMember(n) {
    if (memberIntervals[n]) { clearInterval(memberIntervals[n]);
        memberIntervals[n] = null; }
    var prev = memberDurations[n];
    memberDurations[n] = 0;
    reloadMemberStrip();
    reloadMemberList();
    updateMaxDurEver();
    showUndoToast('↺ Reset ' + n, function() {
        memberDurations[n] = prev;
        reloadMemberStrip();
        reloadMemberList();
        updateMaxDurEver();
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
    updateMaxDurEver();
    showToast('🗑 ' + n + ' deleted');
}

function confirmResetAll() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('⚠️ No members yet'); return; }
    showConfirm({ icon: '↺', title: 'Reset all durations?', msg: 'All recorded times will reset to 0.', okLabel: 'Reset', okClass: 'btn-primary', onOk: function() {
            for (var i = 0; i < names.length; i++) {
                var n = names[i];
                if (memberIntervals[n]) { clearInterval(memberIntervals[n]);
                    memberIntervals[n] = null; }
                memberDurations[n] = 0;
            }
            // Reset _maxDurEver ke 0.001 agar bar mulai dari 0
            _maxDurEver = 0.001;
            reloadMemberStrip();
            reloadMemberList();
            showToast('↺ All durations reset');
        } });
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
    updateMaxDurEver();
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
        // Reset _maxDurEver agar proporsional dengan preset baru
        _maxDurEver = 0.001;
        savePhotoCache();
        reloadMemberStrip();
        reloadMemberList();
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
//  5. MEDIA
// ══════════════════════════════════════════
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
    } else if (file.type.indexOf('audio/') === 0) {
        aud.src = url;
        aud.style.display = 'block';
        aud.load();
        lbl.textContent = '🎵 ' + file.name;
    } else { showToast('⚠️ Format tidak didukung'); }
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
    if (window.ytPlayer) { window.ytPlayer.loadVideoById(v); } else { window.ytPlayer = new YT.Player('player', { height: '315', width: '100%', videoId: v }); }
}

// ══════════════════════════════════════════
//  6. FINISH & CHART
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
}

function closeResultModal() { document.getElementById('resultModal').style.display = 'none'; }

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
            card.innerHTML = '\n                <div class="history-card-header" onclick="toggleHistoryDetail(' + entry.id + ')">\n                    <div>\n                        <div class="history-card-title">🎵 ' + entry.title + '</div>\n                        <div class="history-card-meta">' + entry.date + ' · Total ' + entry.totalDuration.toFixed(1) + 's</div>\n                    </div>\n                    <div style="display:flex;align-items:center;gap:6px;">\n                        <div class="history-avatars">\n                            ' + avatarsHtml + '\n                            ' + moreHtml + '\n                        </div>\n                        <span class="history-chevron" id="chev-' + entry.id + '">▾</span>\n                    </div>\n                </div>\n                <div class="history-detail" id="detail-' + entry.id + '">\n                    <div style="padding-top:10px; display:flex; flex-direction:column; gap:6px;">\n                        ' + membersHtml + '\n                    </div>\n                    <button class="btn-danger-soft" style="width:100%;justify-content:center;margin-top:10px;"\n                            onclick="confirmDeleteHistoryEntry(' + entry.id + ')">🗑 Delete Entry</button>\n                </div>';
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
    showConfirm({ icon: '🗑', title: 'Delete riwayat ini?', msg: 'This recording data cannot be recovered.', okLabel: 'Delete', okClass: 'btn-danger', onOk: function() {
            saveHistory(getHistory().filter(function(e) { return e.id !== id; }));
            openHistory();
            showToast('🗑 History entry deleted');
        } });
}

function confirmClearHistory() {
    showConfirm({ icon: '🗑', title: 'Delete semua riwayat?', msg: 'All recording history will be permanently deleted.', okLabel: 'Delete Semua', okClass: 'btn-danger', onOk: function() { saveHistory([]);
            openHistory();
            showToast('🗑 All history cleared'); } });
}

function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }

// ══════════════════════════════════════════
//  8. KEYBOARD SHORTCUTS
// ══════════════════════════════════════════
var activeKeyHolds = new Set();
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
        e.preventDefault();
        var vid = document.getElementById('localMedia');
        var aud = document.getElementById('audioPlayer');
        if (vid.style.display !== 'none') { vid.paused ? vid.play() : vid.pause(); } else if (aud.style.display !== 'none') { aud.paused ? aud.play() : aud.pause(); } else if (window.ytPlayer) { window.ytPlayer.getPlayerState() === 1 ? window.ytPlayer.pauseVideo() : window.ytPlayer.playVideo(); }
        return;
    }
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
});

// ══════════════════════════════════════════
//  AD-LIBS (Q-P) — interval 50ms, increment 0.05
// ══════════════════════════════════════════
var AD_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
var activeAdLibKeys = new Set();
var adLibIntervals = {};

function addAdLibTime(memberName, amount) {
    if (amount === undefined) amount = 0.05;
    if (!memberDurations[memberName]) return;
    memberDurations[memberName] = (memberDurations[memberName] || 0) + amount;
    var timeLabel = document.getElementById('strip-time-' + CSS.escape(memberName));
    if (timeLabel) timeLabel.textContent = memberDurations[memberName].toFixed(1) + 's';
    requestAnimationFrame(function() {
        updateLeaderboardLive();
        updateTotalDuration();
        updatePresentationLive();
        reorderLeaderboard();
        var overlay = document.getElementById('presentationOverlay');
        if (overlay.style.display !== 'none') {
            renderPresentationBars();
        }
    });
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

// Tutup modal klik backdrop
var modals = document.querySelectorAll('.modal-overlay');
for (var mi = 0; mi < modals.length; mi++) {
    modals[mi].addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
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
    if (_pressReorderTimer) { clearTimeout(_pressReorderTimer);
        _pressReorderTimer = null; }
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

var _pressReorderTimer = null;
var _pressIsReordering = false;

function pressId(prefix, name) { return prefix + name.replace(/[^a-zA-Z0-9]/g, '_'); }

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
    for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var n = row.dataset.name;
        var bar = row.querySelector('.press-bar');
        var time = row.querySelector('.press-time');
        var avatar = row.querySelector('.press-avatar');
        var c = memberColors[n] || '#a78bfa';
        var isRecording = !!memberIntervals[n];
        var isAdlib = adNames.indexOf(n) !== -1;
        if (bar) {
            var pct = (memberDurations[n] || 0) / maxDur;
            if (pct > 1) pct = 1;
            bar.style.transform = 'scaleX(' + pct + ')';
            if (isAdlib) {
                bar.style.background = 'linear-gradient(90deg, #4ade80, #22d3ee)';
                bar.style.boxShadow = '0 0 12px #4ade80';
            } else {
                bar.style.background = 'linear-gradient(90deg, ' + c + '99, ' + c + ')';
                bar.style.boxShadow = '';
            }
        }
        if (time) time.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
        if (avatar) {
            avatar.style.transform = isRecording ? 'scale(1.15)' : 'scale(1)';
            avatar.style.boxShadow = isRecording ? '0 0 28px 8px ' + c + '99' : (isAdlib ? '0 0 28px 8px rgba(74,222,128,0.7)' : '0 0 14px 2px ' + c + '44');
            avatar.style.borderColor = isAdlib ? '#4ade80' : c;
        }
    }
    if (_pressReorderTimer || _pressIsReordering) return;
    _pressReorderTimer = setTimeout(function() {
        _pressReorderTimer = null;
        if (_pressIsReordering) return;
        var curRows = container.children;
        var sortedNames = Object.keys(memberDurations).slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
        var same = true;
        for (var k = 0; k < sortedNames.length; k++) {
            if (!curRows[k] || curRows[k].dataset.name !== sortedNames[k]) { same = false; break; }
        }
        if (same) return;
        _pressIsReordering = true;
        var firstRects = {};
        for (var l = 0; l < curRows.length; l++) {
            firstRects[curRows[l].dataset.name] = curRows[l].getBoundingClientRect();
        }
        for (var m = 0; m < sortedNames.length; m++) {
            var name = sortedNames[m];
            var rowToMove = null;
            for (var n2 = 0; n2 < curRows.length; n2++) {
                if (curRows[n2].dataset.name === name) { rowToMove = curRows[n2]; break; }
            }
            if (rowToMove) container.appendChild(rowToMove);
        }
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                for (var o = 0; o < sortedNames.length; o++) {
                    var name2 = sortedNames[o];
                    var row2 = null;
                    for (var p = 0; p < container.children.length; p++) {
                        if (container.children[p].dataset.name === name2) { row2 = container.children[p]; break; }
                    }
                    var first = firstRects[name2];
                    if (!row2 || !first) continue;
                    var last = row2.getBoundingClientRect();
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
                setTimeout(function() { _pressIsReordering = false; }, 600);
            });
        });
    }, 600);
}

// ══════════════════════════════════════════
//  10. INIT
// ══════════════════════════════════════════
window.onload = function() {
    loadPhotoCache();
    refreshPresetDropdown();
    reloadMemberStrip();
    reloadMemberList();

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
