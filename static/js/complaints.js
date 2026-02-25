/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Complaint Form & User Dashboard Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── User Dashboard ────────────────────────────────────────────────────────
async function loadDashboard() {
    const listEl = document.getElementById('complaints-list');
    const statsSubmitted = document.getElementById('stat-submitted');
    const statsProgress = document.getElementById('stat-progress');
    const statsResolved = document.getElementById('stat-resolved');
    const statsTotal = document.getElementById('stat-total');

    if (!listEl) return;

    try {
        const data = await apiCall('/api/complaints');
        const complaints = data.complaints;

        // Update stats
        if (statsTotal) statsTotal.textContent = complaints.length;
        if (statsSubmitted) statsSubmitted.textContent = complaints.filter(c => c.status === 'Submitted').length;
        if (statsProgress) statsProgress.textContent = complaints.filter(c => c.status === 'In Progress').length;
        if (statsResolved) statsResolved.textContent = complaints.filter(c => c.status === 'Resolved').length;

        if (complaints.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No complaints yet</h3>
                    <p>Submit your first complaint to get started</p>
                    <a href="/new-complaint" class="btn btn-primary">🆕 New Complaint</a>
                </div>`;
            return;
        }

        listEl.innerHTML = complaints.map(c => `
            <div class="complaint-card" data-id="${c.id}">
                <div class="complaint-info">
                    <h3>${escapeHtml(c.title)}</h3>
                    <div class="complaint-meta">
                        ${getCategoryBadge(c.category)}
                        ${getStatusBadge(c.status)}
                        ${getPriorityBadge(c.priority)}
                        <span>📍 ${escapeHtml(c.location || 'No location')}</span>
                        <span>📅 ${formatDate(c.created_at)}</span>
                    </div>
                    <p class="complaint-desc">${escapeHtml(c.description).substring(0, 150)}${c.description.length > 150 ? '...' : ''}</p>
                </div>
                <div class="complaint-actions">
                    <button class="btn btn-sm btn-secondary" onclick="viewComplaint(${c.id})">View</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteComplaint(${c.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Filter Complaints ────────────────────────────────────────────────────
function filterComplaints(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    document.querySelectorAll('.complaint-card').forEach(card => {
        const badge = card.querySelector('.badge-submitted, .badge-in-progress, .badge-resolved, .badge-rejected');
        if (!status || (badge && badge.textContent.toLowerCase().includes(status.toLowerCase()))) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// ─── View Complaint Detail ─────────────────────────────────────────────────
async function viewComplaint(id) {
    try {
        const data = await apiCall(`/api/complaints/${id}`);
        const c = data.complaint;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal">
                <h3>${escapeHtml(c.title)}</h3>
                <div style="margin-bottom: 1rem;">
                    ${getCategoryBadge(c.category)}
                    ${getStatusBadge(c.status)}
                    ${getPriorityBadge(c.priority)}
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">${escapeHtml(c.description)}</p>
                </div>
                ${c.translated_text ? `
                <div class="form-group">
                    <label>Translated (English)</label>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${escapeHtml(c.translated_text)}</p>
                </div>` : ''}
                <div class="form-group">
                    <label>Location</label>
                    <p style="color: var(--text-secondary);">${escapeHtml(c.location || 'Not specified')}</p>
                </div>
                <div class="form-group">
                    <label>Language Detected</label>
                    <p style="color: var(--text-secondary);">${c.original_language}</p>
                </div>
                ${c.admin_notes ? `
                <div class="form-group">
                    <label>Admin Notes</label>
                    <p style="color: var(--accent-primary-light);">${escapeHtml(c.admin_notes)}</p>
                </div>` : ''}
                <div class="form-group">
                    <label>Submitted</label>
                    <p style="color: var(--text-muted);">${formatDate(c.created_at)}</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Delete Complaint ──────────────────────────────────────────────────────
async function deleteComplaint(id) {
    if (!confirm('Are you sure you want to delete this complaint?')) return;
    try {
        await apiCall(`/api/complaints/${id}`, 'DELETE');
        showToast('Complaint deleted', 'success');
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Submit Complaint ──────────────────────────────────────────────────────
async function handleSubmitComplaint(e) {
    e.preventDefault();
    const title = document.getElementById('complaint-title').value.trim();
    const description = document.getElementById('complaint-desc').value.trim();
    const location = document.getElementById('complaint-location').value.trim();

    if (!title || !description) {
        showToast('Please fill in title and description', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processing with AI...';

    try {
        const data = await apiCall('/api/complaints', 'POST', { title, description, location });
        const ai = data.ai_info;

        showToast(`Complaint filed! Category: ${ai.category} (${ai.confidence}% confidence)`, 'success');

        // Show AI result
        const aiBox = document.getElementById('ai-result');
        if (aiBox) {
            aiBox.style.display = 'flex';
            aiBox.innerHTML = `
                <span class="ai-icon">🤖</span>
                <div class="ai-text">
                    <strong>AI Classification Result</strong>
                    Category: ${ai.category} · Confidence: ${ai.confidence}% · Language: ${ai.detected_language}
                </div>
            `;
        }

        setTimeout(() => window.location.href = '/dashboard', 2000);
    } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '📩 Submit Complaint';
    }
}

// ─── Real-time AI Classification Preview ───────────────────────────────────
let classifyTimeout;
function onDescriptionChange() {
    clearTimeout(classifyTimeout);
    const text = document.getElementById('complaint-desc')?.value || '';

    if (text.length < 10) return;

    classifyTimeout = setTimeout(async () => {
        try {
            // Detect language
            const langData = await apiCall('/api/detect-language', 'POST', { text });
            const langEl = document.getElementById('language-indicator');
            if (langEl) {
                langEl.style.display = 'inline-flex';
                langEl.innerHTML = `🌐 ${langData.language_name}`;
            }

            // Classify
            const classData = await apiCall('/api/classify', 'POST', { text });
            const suggEl = document.getElementById('ai-suggestion');
            if (suggEl && classData.category !== 'Other') {
                suggEl.style.display = 'flex';
                suggEl.innerHTML = `
                    <span class="ai-icon">🤖</span>
                    <div class="ai-text">
                        <strong>AI suggests: ${classData.category}</strong>
                        Confidence: ${classData.confidence}%
                    </div>
                `;
            }
        } catch (e) {
            // Silently fail for preview
        }
    }, 600);
}

// ─── Track Complaints ──────────────────────────────────────────────────────
async function loadTrackPage() {
    const container = document.getElementById('track-container');
    if (!container) return;

    try {
        const data = await apiCall('/api/complaints');
        const complaints = data.complaints;

        if (complaints.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No complaints to track</h3>
                    <p>Submit a complaint first to track its progress</p>
                </div>`;
            return;
        }

        container.innerHTML = complaints.map(c => {
            const statuses = ['Submitted', 'In Progress', 'Resolved'];
            const currentIdx = statuses.indexOf(c.status);
            const isRejected = c.status === 'Rejected';

            return `
                <div class="track-card">
                    <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:0.5rem;">
                        <div>
                            <h3>${escapeHtml(c.title)}</h3>
                            <p style="color:var(--text-muted); font-size:0.85rem;">ID: #${c.id} · ${formatDate(c.created_at)}</p>
                        </div>
                        <div>
                            ${getCategoryBadge(c.category)}
                            ${getStatusBadge(c.status)}
                        </div>
                    </div>

                    <div class="timeline">
                        ${statuses.map((s, i) => `
                            <div class="timeline-item ${i < currentIdx ? 'completed' : ''} ${i === currentIdx && !isRejected ? 'active' : ''}">
                                <div class="timeline-dot"></div>
                                <div class="timeline-content">
                                    <h4>${s}</h4>
                                    <p>${i <= currentIdx && !isRejected ? '✅ Completed' : (isRejected && i === 0 ? '✅ Done' : '⏳ Pending')}</p>
                                </div>
                            </div>
                        `).join('')}
                        ${isRejected ? `
                            <div class="timeline-item active">
                                <div class="timeline-dot" style="border-color: var(--accent-danger); background: var(--accent-danger);"></div>
                                <div class="timeline-content">
                                    <h4 style="color: var(--accent-danger);">Rejected</h4>
                                    <p>${c.admin_notes ? escapeHtml(c.admin_notes) : 'No reason provided'}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Escape HTML ───────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
