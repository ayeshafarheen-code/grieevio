/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Admin Dashboard Logic (Supabase Migrated)
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Initialize Real-Time Listener ─────────────────────────────────────────
if (supabase) {
    supabase
        .channel('public:complaints')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, payload => {
            console.log('Real-time update received:', payload);
            showToast('🔄 Real-time update: Complaints synchronized', 'info');
            loadAdminDashboard();
        })
        .subscribe();
}

// ─── Load Admin Dashboard ──────────────────────────────────────────────────
async function loadAdminDashboard() {
    await Promise.all([loadAdminStats(), loadAdminComplaints()]);
}

// ─── Load Stats ────────────────────────────────────────────────────────────
async function loadAdminStats() {
    try {
        const { data: complaints, error } = await supabase.from('complaints').select('status, category, priority');
        if (error) throw error;

        const stats = {
            total: complaints.length,
            submitted: complaints.filter(c => c.status === 'Submitted').length,
            in_progress: complaints.filter(c => c.status === 'In Progress').length,
            resolved: complaints.filter(c => c.status === 'Resolved').length,
            rejected: complaints.filter(c => c.status === 'Rejected').length
        };

        document.getElementById('admin-total').textContent = stats.total;
        document.getElementById('admin-submitted').textContent = stats.submitted;
        document.getElementById('admin-progress').textContent = stats.in_progress;
        document.getElementById('admin-resolved').textContent = stats.resolved;
        document.getElementById('admin-rejected').textContent = stats.rejected;
        
        const rate = stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0;
        document.getElementById('admin-rate').textContent = rate + '%';

        // Process charts
        const categories = {};
        const priorities = {};
        complaints.forEach(c => {
            categories[c.category] = (categories[c.category] || 0) + 1;
            priorities[c.priority] = (priorities[c.priority] || 0) + 1;
        });

        renderBarChart('category-chart', categories, ['purple', 'blue', 'green', 'yellow', 'red', 'cyan']);
        renderBarChart('priority-chart', priorities, ['green', 'yellow', 'red', 'red']);
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
    if (!tbody || !supabase) return;

    try {
        let query = supabase.from('complaints').select(`
            *,
            users:user_id ( username )
        `);

        if (status) query = query.eq('status', status);
        if (category) query = query.eq('category', category);

        const { data: complaints, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        if (complaints.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 3rem; color: var(--text-muted);">No complaints found</td></tr>`;
            return;
        }

        tbody.innerHTML = complaints.map(c => `
            <tr>
                <td><strong>#${c.id}</strong></td>
                <td>
                    <div style="max-width: 200px;">
                        <strong style="display:block; margin-bottom:2px;">
                            ${escapeHtml(c.title)}
                            ${c.is_urgent ? '<span class="badge badge-danger" style="font-size: 0.6rem; vertical-align: middle; margin-left: 5px;">URGENT</span>' : ''}
                        </strong>
                        <span style="color: var(--text-muted); font-size: 0.78rem;">by ${escapeHtml(c.users?.username || 'Unknown')}</span>
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
                <td>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        ${c.image_path ? `<img src="${supabase.storage.from('complaints').getPublicUrl(c.image_path).data.publicUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${supabase.storage.from('complaints').getPublicUrl(c.image_path).data.publicUrl}')">` : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>'}
                        ${(c.latitude && c.longitude) ? `<span title="Geo-tagged: ${c.latitude}, ${c.longitude}" style="cursor:help;">📍</span>` : ''}
                        ${c.is_escalated ? `<span title="Escalated ${c.escalation_level}x" style="cursor:help;">⚠️ Escalated</span>` : ''}
                    </div>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="viewComplaint(${c.id})" title="View Details">👁️</button>
                    ${c.status === 'In Progress' ? `<button class="btn btn-sm btn-success" onclick="openVerifyModal(${c.id})" title="AI Verify & Resolve">✅ Verify</button>` : ''}
                    <button class="btn btn-sm btn-primary" onclick="openNotesModal(${c.id}, '${escapeHtml(c.admin_notes || '')}')" title="Edit Notes">📝</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteComplaint(${c.id})" title="Delete Complaint">🗑️</button>
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
        const { error } = await supabase.from('complaints').update({ [field]: value }).eq('id', id);
        if (error) throw error;
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
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Delete Complaint ──────────────────────────────────────────────────────
async function deleteComplaint(id) {
    if (!confirm('Are you sure you want to delete this complaint?')) return;
    try {
        await supabase.from('complaints').delete().eq('id', id);
        showToast('Complaint deleted', 'success');
        loadAdminComplaints();
        loadAdminStats();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── AI Verification Modal ──────────────────────────────────────────────────
function openVerifyModal(id) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
        <div class="modal">
            <h3>✅ AI Visual Verification - Complaint #${id}</h3>
            <div class="form-group">
                <label>Upload 'After' Evidence</label>
                <input type="file" id="verify-file" class="form-control" accept="image/*" onchange="previewVerifyImage(event)">
            </div>
            <div id="verify-preview-container" style="display:none; margin-bottom: 1.5rem; text-align: center;">
                <img id="verify-preview-img" style="max-width: 100%; border-radius: 8px;">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" id="verify-submit-btn" onclick="submitAIVerification(${id})">🤖 AI Verify & Resolve</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

let verifyImageBase64 = null;
function previewVerifyImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        verifyImageBase64 = e.target.result;
        document.getElementById('verify-preview-img').src = e.target.result;
        document.getElementById('verify-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function submitAIVerification(id) {
    if (!verifyImageBase64) return;
    const btn = document.getElementById('verify-submit-btn');
    btn.disabled = true;
    btn.textContent = '🤖 Analyzing...';

    try {
        // In a solely Supabase app, we'd invoke an Edge Function here
        const { data, error } = await supabase.functions.invoke('verify-resolution', {
            body: { complaint_id: id, after_image: verifyImageBase64 }
        });
        if (error) throw error;

        showToast(`Verified! AI Match Score: ${data.score}%`, 'success');
        document.querySelector('.modal-overlay').remove();
        loadAdminDashboard();
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = '🤖 AI Verify & Resolve';
    }
}
