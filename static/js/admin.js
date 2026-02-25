/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Admin Dashboard Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Load Admin Dashboard ──────────────────────────────────────────────────
async function loadAdminDashboard() {
    await Promise.all([loadAdminStats(), loadAdminComplaints()]);
}

// ─── Load Stats ────────────────────────────────────────────────────────────
async function loadAdminStats() {
    try {
        const data = await apiCall('/api/admin/stats');

        document.getElementById('admin-total').textContent = data.total;
        document.getElementById('admin-submitted').textContent = data.submitted;
        document.getElementById('admin-progress').textContent = data.in_progress;
        document.getElementById('admin-resolved').textContent = data.resolved;
        document.getElementById('admin-rejected').textContent = data.rejected || 0;
        document.getElementById('admin-rate').textContent = data.resolution_rate + '%';

        // Render category chart
        renderBarChart('category-chart', data.categories, ['purple', 'blue', 'green', 'yellow', 'red', 'cyan']);

        // Render priority chart
        renderBarChart('priority-chart', data.priorities, ['green', 'yellow', 'red', 'red']);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Render Bar Chart ──────────────────────────────────────────────────────
function renderBarChart(containerId, dataObj, colors) {
    const container = document.getElementById(containerId);
    if (!container || !dataObj) return;

    const entries = Object.entries(dataObj);
    if (entries.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No data yet</p>';
        return;
    }

    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

    container.innerHTML = entries.map(([label, value], i) => `
        <div class="bar-item">
            <span class="bar-label">${label}</span>
            <div class="bar-track">
                <div class="bar-fill ${colors[i % colors.length]}" style="width: ${(value / maxVal) * 100}%"></div>
            </div>
            <span class="bar-value">${value}</span>
        </div>
    `).join('');
}

// ─── Load Admin Complaints ─────────────────────────────────────────────────
async function loadAdminComplaints(status = '', category = '') {
    const tbody = document.getElementById('admin-complaints-body');
    if (!tbody) return;

    try {
        let url = '/api/admin/complaints?';
        if (status) url += `status=${encodeURIComponent(status)}&`;
        if (category) url += `category=${encodeURIComponent(category)}`;

        const data = await apiCall(url);
        const complaints = data.complaints;

        if (complaints.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 3rem; color: var(--text-muted);">No complaints found</td></tr>`;
            return;
        }

        tbody.innerHTML = complaints.map(c => `
            <tr>
                <td><strong>#${c.id}</strong></td>
                <td>
                    <div style="max-width: 200px;">
                        <strong style="display:block; margin-bottom:2px;">${escapeHtml(c.title)}</strong>
                        <span style="color: var(--text-muted); font-size: 0.78rem;">by ${escapeHtml(c.username)}</span>
                    </div>
                </td>
                <td>${getCategoryBadge(c.category)}</td>
                <td>
                    <select class="admin-select" onchange="updateComplaint(${c.id}, 'status', this.value)">
                        ${['Submitted', 'In Progress', 'Resolved', 'Rejected'].map(s =>
            `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s}</option>`
        ).join('')}
                    </select>
                </td>
                <td>
                    <select class="admin-select" onchange="updateComplaint(${c.id}, 'priority', this.value)">
                        ${['Low', 'Medium', 'High', 'Critical'].map(p =>
            `<option value="${p}" ${c.priority === p ? 'selected' : ''}>${p}</option>`
        ).join('')}
                    </select>
                </td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(c.created_at)}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="viewComplaint(${c.id})">👁️</button>
                    <button class="btn btn-sm btn-primary" onclick="openNotesModal(${c.id}, '${escapeHtml(c.admin_notes || '')}')">📝</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Update Complaint (Admin) ──────────────────────────────────────────────
async function updateComplaint(id, field, value) {
    try {
        await apiCall(`/api/admin/complaints/${id}`, 'PUT', { [field]: value });
        showToast(`Updated ${field} to "${value}"`, 'success');
        loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Admin Notes Modal ─────────────────────────────────────────────────────
function openNotesModal(id, currentNotes) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
        <div class="modal">
            <h3>📝 Admin Notes - Complaint #${id}</h3>
            <div class="form-group">
                <label>Notes</label>
                <textarea class="form-control" id="modal-notes" rows="4" placeholder="Add your notes here...">${currentNotes}</textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveNotes(${id})">💾 Save Notes</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveNotes(id) {
    const notes = document.getElementById('modal-notes').value;
    try {
        await updateComplaint(id, 'admin_notes', notes);
        document.querySelector('.modal-overlay').remove();
        showToast('Notes saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Admin Filter ──────────────────────────────────────────────────────────
function adminFilter(type, value) {
    document.querySelectorAll(`.filter-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (type === 'status') {
        loadAdminComplaints(value, '');
    } else {
        loadAdminComplaints('', value);
    }
}
