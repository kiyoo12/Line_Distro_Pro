// ══════════════════════════════════════════
//  FEATURES MODUL — PRESET, HISTORY, PROJECT, EXPORT & PRESENTATION
// ══════════════════════════════════════════

// ── PRESET MANAGEMENT ──
function getPresets() {
    try { return JSON.parse(localStorage.getItem('linedistro_presets') || '{}'); } catch (e) { return {}; }
}
function savePresets(d) { localStorage.setItem('linedistro_presets', JSON.stringify(d)); }

function refreshPresetDropdown() {
    var sel = document.getElementById('presetSelect');
    if (!sel) return;
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
    if (sel) { sel.value = name; updatePresetDropdownColor(); }
    document.getElementById('presetSaveBar').style.display = 'none';
    showToast('💾 Preset "' + name + '" saved');
}

function cancelSavePreset() { document.getElementById('presetSaveBar').style.display = 'none'; }

function updatePresetDropdownColor() {
    var sel = document.getElementById('presetSelect');
    if (!sel) return;
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
        memberDurations = {}; memberColors = {}; memberPhotos = {};
        for (var i = 0; i < preset.length; i++) {
            var m = preset[i];
            memberDurations[m.name] = 0;
            memberColors[m.name] = m.color || '#a78bfa';
            memberPhotos[m.name] = m.photo || 'https://ui-avatars.com' + encodeURIComponent(m.name) + '&background=random';
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

// ── HISTORY MANAGEMENT ──
function getHistory() {
    try { return JSON.parse(localStorage.getItem('linedistro_history') || '[]'); } catch (e) { return []; }
}
function saveHistory(d) { localStorage.setItem('linedistro_history', JSON.stringify(d)); }

function saveToHistory(title, sorted, durations, colors, photos, total) {
    var history = getHistory();
    var entry = {
        id: Date.now(), title: title, date: new Date().toLocaleString('en-US'), totalDuration: total,
        members: sorted.map(function(n) {
            return { name: n, duration: durations[n], color: colors[n], photo: photos[n], pct: ((durations[n] / total) * 100).toFixed(1) };
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
        if (found) { result.push({ title: entry.title, date: entry.date, duration: found.duration, pct: parseFloat(found.pct) }); }
    }
    return result.reverse();
}

function openHistory() {
    var history = getHistory();
    var container = document.getElementById('historyList');
    if (!container) return;
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
                avatarsHtml += '<img src="' + entry.members[j].photo + '" onerror="this.src=\'https://ui-avatars.com' + encodeURIComponent(entry.members[j].name) + '\'"/>';
            }
            var moreHtml = entry.members.length > 4 ? '<span class="history-more">+' + (entry.members.length - 4) + '</span>' : '';
            var membersHtml = '';
            for (var k = 0; k < entry.members.length; k++) {
                var member = entry.members[k];
                membersHtml += '\n                            <div class="rank-item" style="border-left-color:' + member.color + '; cursor:pointer;" onclick="openMemberStats(\'' + member.name.replace(/'/g, "\\'") + '\')">\n                                <div class="rank-name">\n                                    <img src="' + member.photo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"\n                                         onerror="this.src=\'https://ui-avatars.com' + encodeURIComponent(member.name) + '\'">\n                                    <span class="rank-badge">' + (k + 1) + '</span>\n                                    <span>' + member.name + '</span>\n                                </div>\n                                <div class="rank-meta">\n                                    <span class="rank-time">' + member.duration.toFixed(1) + 's</span>\n                                    <span class="rank-pct">' + member.pct + '%</span>\n                                    <span style="color:var(--text3);font-size:11px;margin-left:4px;">📈</span>\n                                </div>\n                            </div>';
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
    if (!detail || !chev) return;
    var isOpen = detail.classList.contains('open');
    detail.classList.toggle('open', !isOpen);
    chev.classList.toggle('open', !isOpen);
}

// ── PROJECT MANAGEMENT ──
function getProjects() {
    try { return JSON.parse(localStorage.getItem('linedistro_projects') || '[]'); } catch (e) { return []; }
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
    if (!container) return;
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
    var name = nameInput ? nameInput.value.trim() : '';
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
        data: { durations: memberDurations, colors: memberColors, photos: memberPhotos, timeline: timelineData }
    };
    projects.push(project);
    saveProjects(projects);
    document.getElementById('projectNameInput').value = '';
    renderProjectList();
    showToast('💾 Project "' + name + '" saved');
}

// ⭐ PERBAIKAN: Memulihkan logika muat proyek yang sempat rusak
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
            if (typeof savePhotoCache === 'function') savePhotoCache(); 
            if (typeof reloadMemberStrip === 'function') reloadMemberStrip(); 
            if (typeof reloadMemberList === 'function') reloadMemberList(); 
            if (typeof updateTotalDuration === 'function') updateTotalDuration(); 
            if (typeof updateLeaderboardLive === 'function') updateLeaderboardLive(); 
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

// ── DATA EXPORT ──
function exportData() {
    var names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('No data to export'); return; }
    var total = 0;
    for (var i = 0; i < names.length; i++) total += memberDurations[names[i]];
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

// ── PRESENTATION LIVE SYSTEM ──
// ⭐ PERBAIKAN: Memulihkan pembungkus layout bar presentasi dan string avatar placeholder yang rusak total
function renderPresentationBars() {
    var container = document.getElementById('pressBars');
    if (!container) return;
    container.innerHTML = '';
    var names = Object.keys(memberDurations);
    var maxDur = 0.001;
    for (var i = 0; i < names.length; i++) {
        if (memberDurations[names[i]] > maxDur) maxDur = memberDurations[names[i]];
    }
    var sorted = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    var title = document.getElementById('songTitle').value.trim() || 'Line Distribution';
    var pressTitleEl = document.getElementById('pressSongTitle');
    if (pressTitleEl) pressTitleEl.textContent = title;
    
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
        
        row.innerHTML = '\n            <img src="' + memberPhotos[n] + '" class="press-avatar"\n                 id="' + pressId('pavatar-', n) + '"\n                 style="border-color:' + borderColor + '; transform:' + avatarScale + '; box-shadow:' + avatarShadow + ';"\n                 onerror="this.src=\'https://ui-avatars.com' + encodeURIComponent(n) + '&background=random\'">\n            <div class="press-member-info">\n                <span class="press-name">' + n + '</span>\n                <div class="press-bar-wrap">\n                    <div class="press-bar"\n                         id="' + pressId('pbar-', n) + '"\n                         style="transform:scaleX(' + barPct + '); background:linear-gradient(90deg,' + barColor + '99,' + barColor + ');' + barShadow + '"></div>\n                </div>\n            </div>\n            <span class="press-time" id="' + pressId('ptime-', n) + '">' + memberDurations[n].toFixed(1) + 's</span>';
        container.appendChild(row);
    }
}

function pressId(prefix, name) { 
    return prefix + name.replace(/[^a-zA-Z0-9]/g, '_'); 
}
