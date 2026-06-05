// ============================================================
//  AUTOSCRIPT TCP — Project Page Logic
//  Handles project CRUD via Worker API, profile-based token auth,
//  and Admin-only User Management panel.
// ============================================================

(function () {
    'use strict';

    // ── Session Checking & Auth ─────────────────────────────
    const sessionToken = localStorage.getItem('autoscript_session_token');
    const sessionUser = localStorage.getItem('autoscript_session_username');

    function requireAuth() {
        if (!sessionToken || !sessionUser) {
            localStorage.removeItem('autoscript_session_token');
            localStorage.removeItem('autoscript_session_username');
            window.location.href = '/tcpscript/login';
            return false;
        }
        return true;
    }

    if (!requireAuth()) return;

    // Helper for API headers
    function getAuthHeaders() {
        return {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
        };
    }

    // ── State ────────────────────────────────────────────────
    let projects = [];
    let editingProject = null; // { index, field } for inline edit modal
    let projectSearchQuery = '';
    let projectStatusFilter = localStorage.getItem('autoscript_project_status_filter') || 'all';
    let projectSortMode = localStorage.getItem('autoscript_project_sort_mode') === 'oldest' ? 'oldest' : 'newest';
    let projectViewMode = localStorage.getItem('autoscript_project_view_mode') === 'list' ? 'list' : 'grid';

    // ── DOM References ───────────────────────────────────────
    // Views
    const projectsView = document.getElementById('projectsView');
    const projectGrid = document.getElementById('projectGrid');
    const emptyState = document.getElementById('emptyState');
    const emptyStateTitle = document.getElementById('emptyStateTitle');
    const emptyStateText = document.getElementById('emptyStateText');
    const loadingState = document.getElementById('loadingState');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const projectToolbar = document.getElementById('projectToolbar');
    const syncNotice = document.getElementById('syncNotice');
    const projectSearchInput = document.getElementById('projectSearchInput');
    const projectStatusFilterSelect = document.getElementById('projectStatusFilter');
    const projectSortSelect = document.getElementById('projectSortSelect');
    const btnGridView = document.getElementById('btnGridView');
    const btnListView = document.getElementById('btnListView');

    // Topbar
    const topbarEmail = document.getElementById('topbarEmail');
    const topbarAvatar = document.getElementById('topbarAvatar');
    const btnSettings = document.getElementById('btnSettings');
    const btnLogout = document.getElementById('btnLogout');

    // Project Actions
    const btnNewProject = document.getElementById('btnNewProject');
    const btnNewProjectEmpty = document.getElementById('btnNewProjectEmpty');

    // Project Modal references
    const newProjectModal = document.getElementById('newProjectModal');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalCreate = document.getElementById('modalCreate');
    const modalProjectName = document.getElementById('modalProjectName');
    const modalProjectStatus = document.getElementById('modalProjectStatus');
    const modalSpeaker = document.getElementById('modalSpeaker');
    const modalSource = document.getElementById('modalSource');
    const modalLink = document.getElementById('modalLink');
    const modalStatus = document.getElementById('modalStatus');

    // Edit field modal
    const editFieldModal = document.getElementById('editFieldModal');
    const editFieldClose = document.getElementById('editFieldClose');
    const editFieldCancel = document.getElementById('editFieldCancel');
    const editFieldSave = document.getElementById('editFieldSave');
    const editFieldInput = document.getElementById('editFieldInput');
    const editFieldSelect = document.getElementById('editFieldSelect');
    const editFieldTitle = document.getElementById('editFieldTitle');
    const editFieldLabel = document.getElementById('editFieldLabel');
    const confirmModal = document.getElementById('confirmModal');
    const confirmModalTitle = document.getElementById('confirmModalTitle');
    const confirmModalText = document.getElementById('confirmModalText');
    const confirmModalNote = document.getElementById('confirmModalNote');
    const confirmModalClose = document.getElementById('confirmModalClose');
    const confirmModalCancel = document.getElementById('confirmModalCancel');
    const confirmModalConfirm = document.getElementById('confirmModalConfirm');
    let syncNoticeTimer = null;
    let confirmModalResolver = null;

    // ── Helpers ──────────────────────────────────────────────
    function formatDate(isoString) {
        try {
            const d = new Date(isoString);
            return d.toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (e) {
            return '—';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function normalizeProjectStatus(status) {
        return ['ongoing', 'not_started', 'done'].includes(status) ? status : 'done';
    }

    function getProjectStatusLabel(status) {
        const labels = {
            ongoing: 'Ongoing',
            not_started: 'Not Started Yet',
            done: 'Done'
        };
        return labels[normalizeProjectStatus(status)];
    }

    function getDisplayProjectName(name) {
        return String(name || '').replace(/^Autoscript\s*-\s*/i, '').trim();
    }

    function slugifyProjectName(name) {
        return String(name || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'project';
    }

    function buildProjectAppUrl(project) {
        return `/tcpscript/app/${encodeURIComponent(project.id)}`;
    }

    function isLikelyExternalLink(value) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue || /\s/.test(normalizedValue)) return false;
        if (/^https?:\/\//i.test(normalizedValue)) return true;
        if (/^www\./i.test(normalizedValue)) return true;
        return /^(?:\d{1,3}(?:\.\d{1,3}){3}|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#].*)?$/i.test(normalizedValue);
    }

    function getExternalLinkUrl(link) {
        const value = String(link || '').trim();
        if (!value) return '';
        if (!isLikelyExternalLink(value)) return '';
        return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    }

    function getDisplayCompactText(input) {
        const value = String(input || '').trim();
        if (!value) return '';
        if (!getExternalLinkUrl(value)) return value;

        try {
            const parsedUrl = new URL(getExternalLinkUrl(value));
            const compactValue = `${parsedUrl.hostname}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
            return compactValue.length <= 42
                ? compactValue
                : `${compactValue.slice(0, 28)}...${compactValue.slice(-11)}`;
        } catch (e) {
            return value.length <= 42
                ? value
                : `${value.slice(0, 28)}...${value.slice(-11)}`;
        }
    }

    function normalizeSearchValue(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getFilteredProjects() {
        const query = normalizeSearchValue(projectSearchQuery);

        return projects.filter((project) => {
            const projectStatus = normalizeProjectStatus(project.status);
            const matchesStatus = projectStatusFilter === 'all' || projectStatus === projectStatusFilter;
            if (!matchesStatus) {
                return false;
            }

            if (!query) {
                return true;
            }

            const searchable = [
                getDisplayProjectName(project.name),
                project.speaker,
                project.source,
                project.link,
                getProjectStatusLabel(projectStatus)
            ].map(normalizeSearchValue);

            return searchable.some((value) => value.includes(query));
        });
    }

    function getProjectTimestamp(project) {
        const parsed = Date.parse(project && project.createdAt ? project.createdAt : '');
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    function getVisibleProjects() {
        const filteredProjects = getFilteredProjects();

        return filteredProjects.slice().sort((projectA, projectB) => {
            const diff = getProjectTimestamp(projectB) - getProjectTimestamp(projectA);
            return projectSortMode === 'oldest' ? -diff : diff;
        });
    }

    function syncProjectToolbar() {
        if (projectToolbar) {
            projectToolbar.style.display = 'flex';
        }

        if (projectSortSelect) {
            projectSortSelect.value = projectSortMode;
        }

        if (projectStatusFilterSelect) {
            projectStatusFilterSelect.value = projectStatusFilter;
        }

        if (projectGrid) {
            projectGrid.classList.toggle('is-list', projectViewMode === 'list');
        }

        if (btnGridView) {
            const isActive = projectViewMode === 'grid';
            btnGridView.classList.toggle('active', isActive);
            btnGridView.setAttribute('aria-pressed', String(isActive));
        }

        if (btnListView) {
            const isActive = projectViewMode === 'list';
            btnListView.classList.toggle('active', isActive);
            btnListView.setAttribute('aria-pressed', String(isActive));
        }
    }

    function setProjectViewMode(nextMode) {
        projectViewMode = nextMode === 'list' ? 'list' : 'grid';
        localStorage.setItem('autoscript_project_view_mode', projectViewMode);
        syncProjectToolbar();
        renderProjects();
    }

    function setProjectSortMode(nextMode) {
        projectSortMode = nextMode === 'oldest' ? 'oldest' : 'newest';
        localStorage.setItem('autoscript_project_sort_mode', projectSortMode);
        syncProjectToolbar();
        renderProjects();
    }

    function setProjectStatusFilter(nextFilter) {
        projectStatusFilter = ['all', 'ongoing', 'not_started', 'done'].includes(nextFilter) ? nextFilter : 'all';
        localStorage.setItem('autoscript_project_status_filter', projectStatusFilter);
        syncProjectToolbar();
        renderProjects();
    }

    function showSyncNotice(message) {
        if (!syncNotice) return;
        if (syncNoticeTimer) {
            clearTimeout(syncNoticeTimer);
        }

        syncNotice.textContent = message || 'Changes synced successfully.';
        syncNotice.style.display = 'flex';

        syncNoticeTimer = setTimeout(() => {
            syncNotice.style.display = 'none';
        }, 3200);
    }

    function closeConfirmModal(result) {
        if (confirmModal) {
            confirmModal.style.display = 'none';
        }

        if (confirmModalResolver) {
            const resolve = confirmModalResolver;
            confirmModalResolver = null;
            resolve(Boolean(result));
        }
    }

    function openConfirmModal(config) {
        if (!confirmModal || !confirmModalTitle || !confirmModalText || !confirmModalConfirm) {
            return Promise.resolve(false);
        }

        confirmModalTitle.textContent = config && config.title ? config.title : 'Confirm Action';
        confirmModalText.textContent = config && config.message ? config.message : 'Please confirm this action.';
        confirmModalConfirm.textContent = config && config.confirmText ? config.confirmText : 'Confirm';
        confirmModalConfirm.classList.toggle('btn-modal-danger', Boolean(config && config.isDanger));

        if (confirmModalCancel) {
            confirmModalCancel.style.display = config && config.hideCancel ? 'none' : '';
        }

        if (confirmModalNote) {
            const note = config && config.note ? config.note : '';
            confirmModalNote.textContent = note;
            confirmModalNote.style.display = note ? 'block' : 'none';
        }

        confirmModal.style.display = 'flex';
        confirmModalConfirm.focus();

        return new Promise((resolve) => {
            confirmModalResolver = resolve;
        });
    }

    function openMessageModal(config) {
        return openConfirmModal({
            title: config && config.title ? config.title : 'Notice',
            message: config && config.message ? config.message : '',
            note: config && config.note ? config.note : '',
            confirmText: config && config.confirmText ? config.confirmText : 'OK',
            hideCancel: true,
            isDanger: Boolean(config && config.isDanger)
        });
    }

    // ── Render User Info ─────────────────────────────────────
    function renderUserInfo() {
        if (topbarEmail) topbarEmail.textContent = sessionUser;
        if (topbarAvatar) {
            topbarAvatar.innerHTML = `<span class="profile-initial" style="font-weight: 700; color: #fff; font-size: 14px;">${sessionUser.charAt(0).toUpperCase()}</span>`;
            // Set dynamic background color based on length
            const colors = ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#f43f5e'];
            const colorIndex = sessionUser.toLowerCase() === 'admin' ? 0 : sessionUser.toLowerCase() === 'nguyên' ? 1 : sessionUser.length % colors.length;
            topbarAvatar.style.background = colors[colorIndex];
        }

        // Chỉ Admin mới thấy Setting
        if (btnSettings && sessionUser.toLowerCase() === 'admin') {
            btnSettings.style.display = 'inline-flex';
        }
    }

    // ── Projects CRUD Logic ──────────────────────────────────
    async function loadProjects() {
        if (loadingState) loadingState.style.display = 'block';
        if (projectsView) projectsView.style.display = 'none';

        try {
            const res = await fetch('/tcpscript/api/projects', {
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch project list');
            projects = await res.json();
            renderProjects();
        } catch (e) {
            console.error('Load projects error:', e);
            if (projectGrid) {
                projectGrid.innerHTML = `<div style="color: var(--danger); text-align: center; grid-column: 1/-1; padding: 40px;">Error: ${e.message}</div>`;
            }
        } finally {
            if (loadingState) loadingState.style.display = 'none';
            if (projectsView) projectsView.style.display = 'block';
        }
    }

    function renderProjects() {
        if (!projectGrid) return;
        syncProjectToolbar();

        const visibleProjects = getVisibleProjects();

        if (projects.length === 0 || visibleProjects.length === 0) {
            projectGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';

            if (projects.length === 0) {
                if (emptyStateTitle) emptyStateTitle.textContent = 'No projects yet';
                if (emptyStateText) emptyStateText.textContent = 'Create your first project to start logging timecodes. Each project is linked to a Google Sheet.';
                if (btnNewProjectEmpty) btnNewProjectEmpty.style.display = 'inline-flex';
            } else {
                if (emptyStateTitle) emptyStateTitle.textContent = 'No matching projects';
                if (emptyStateText) emptyStateText.textContent = 'Try a different keyword or adjust the current status filter.';
                if (btnNewProjectEmpty) btnNewProjectEmpty.style.display = 'none';
            }
            return;
        }

        projectGrid.style.display = '';
        if (emptyState) emptyState.style.display = 'none';
        if (btnNewProjectEmpty) btnNewProjectEmpty.style.display = 'inline-flex';

        projectGrid.innerHTML = visibleProjects.map((project, index) => {
            const projectNameDisplay = getDisplayProjectName(project.name);
            const projectStatus = normalizeProjectStatus(project.status);
            const projectStatusLabel = getProjectStatusLabel(projectStatus);
            const speakerDisplay = project.speaker || '';
            const sourceDisplay = project.source || '';
            const sourceTextDisplay = getDisplayCompactText(sourceDisplay);
            const sourceUrl = getExternalLinkUrl(sourceDisplay);
            const linkDisplay = project.link || '';
            const linkTextDisplay = getDisplayCompactText(linkDisplay);
            const linkUrl = getExternalLinkUrl(linkDisplay);
            const delay = Math.min(index * 0.08, 0.6);

            return `
                <div class="project-card status-${projectStatus}" style="animation-delay: ${delay}s" data-project-id="${escapeHtml(project.id)}">
                    <div class="project-card-main">
                        <div class="project-card-header">
                            <div class="project-card-header-main">
                                <div class="project-card-icon status-${projectStatus}">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                </div>
                                <span class="project-card-date">${formatDate(project.createdAt)}</span>
                            </div>
                            <div class="project-card-actions">
                                <a class="card-action-btn" href="${escapeHtml(project.url)}" target="_blank" rel="noopener" title="Open in Google Sheets">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </a>
                                <button class="card-action-btn danger" data-delete-id="${project.id}" title="Remove project">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                        <div class="project-card-name" data-edit-field="name" data-edit-id="${escapeHtml(project.id)}">${escapeHtml(projectNameDisplay)}</div>
                        <div class="project-card-fields">
                            <div class="project-text-row" data-edit-field="speaker" data-edit-id="${escapeHtml(project.id)}">
                                <span class="info-label">Speaker</span>
                                <span class="info-value ${speakerDisplay ? '' : 'empty'}">${speakerDisplay ? escapeHtml(speakerDisplay) : 'Not set'}</span>
                            </div>
                            <div class="project-text-row" data-edit-field="source" data-edit-id="${escapeHtml(project.id)}">
                                <span class="info-label">Source</span>
                                <span class="info-value ${sourceDisplay ? '' : 'empty'}" title="${sourceDisplay ? escapeHtml(sourceDisplay) : ''}">${sourceDisplay ? escapeHtml(sourceTextDisplay) : 'Not set'}</span>
                                ${sourceUrl ? `
                                    <a class="info-link-icon" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener" title="Open source link">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="project-card-fields project-card-meta">
                        <div class="info-row status-row" data-edit-field="status" data-edit-id="${escapeHtml(project.id)}">
                            <span class="info-label">Status</span>
                            <span class="info-value"><span class="status-pill status-${projectStatus}">${projectStatusLabel}</span></span>
                        </div>
                        <div class="info-row" data-edit-field="link" data-edit-id="${escapeHtml(project.id)}">
                            <span class="info-label">Link</span>
                            <span class="info-value info-value-inline ${linkDisplay ? '' : 'empty'}" title="${linkDisplay ? escapeHtml(linkDisplay) : ''}">${linkDisplay ? escapeHtml(linkTextDisplay) : 'Not set'}</span>
                        </div>
                    </div>

                    <div class="project-card-footer">
                        <div class="project-card-buttons">
                            ${linkUrl ? `
                                <a href="${escapeHtml(linkUrl)}" class="btn-open-link" target="_blank" rel="noopener">
                                    Open Link
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </a>
                            ` : ''}
                            <a href="${buildProjectAppUrl(project)}" class="btn-open-project">
                                Open Project
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        attachCardListeners();
    }

    function attachCardListeners() {
        // Delete buttons
        document.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pId = btn.dataset.deleteId;
                const project = projects.find(p => p.id === pId);
                if (!project) return;

                const shouldDelete = await openConfirmModal({
                    title: 'Remove Project',
                    message: `Remove "${getDisplayProjectName(project.name)}" from your project list?`,
                    note: 'The Google Sheet file will not be deleted from Google Drive.',
                    confirmText: 'Delete'
                });

                if (!shouldDelete) {
                    return;
                }

                try {
                    const res = await fetch('/tcpscript/api/projects', {
                        method: 'DELETE',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ id: pId })
                    });
                    if (!res.ok) throw new Error('Failed to delete project');
                    projects = projects.filter(p => p.id !== pId);
                    renderProjects();
                    showSyncNotice('Project list synced successfully.');
                } catch (err) {
                    openMessageModal({
                        title: 'Delete Failed',
                        message: 'Could not remove this project.',
                        note: err.message,
                        isDanger: true
                    });
                }
            });
        });

        // Edit info rows
        document.querySelectorAll('[data-edit-field]').forEach(row => {
            row.addEventListener('click', () => {
                const field = row.dataset.editField;
                const projectId = row.dataset.editId;
                const idx = projects.findIndex(project => project.id === projectId);
                if (isNaN(idx) || idx < 0 || idx >= projects.length) return;
                openEditFieldModal(idx, field);
            });
        });

        document.querySelectorAll('.info-link-icon').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    // ── Create Project Modal ─────────────────────────────────
    function openNewProjectModal() {
        if (!newProjectModal) return;
        const today = new Date().toISOString().slice(0, 10);
        if (modalProjectName) modalProjectName.value = 'Project_' + today;
        if (modalProjectStatus) modalProjectStatus.value = 'not_started';
        if (modalSpeaker) modalSpeaker.value = '';
        if (modalSource) modalSource.value = '';
        if (modalLink) modalLink.value = '';
        if (modalStatus) { modalStatus.style.display = 'none'; modalStatus.textContent = ''; }
        if (modalCreate) modalCreate.disabled = false;

        newProjectModal.style.display = 'flex';
        if (modalProjectName) modalProjectName.focus();
    }

    function closeNewProjectModal() {
        if (newProjectModal) newProjectModal.style.display = 'none';
    }

    async function handleCreateProject() {
        const projectName = modalProjectName ? modalProjectName.value.trim() : '';
        const status = modalProjectStatus ? normalizeProjectStatus(modalProjectStatus.value) : 'not_started';
        const speaker = modalSpeaker ? modalSpeaker.value.trim() : '';
        const source = modalSource ? modalSource.value.trim() : '';
        const link = modalLink ? modalLink.value.trim() : '';

        if (!projectName) {
            showModalStatus('Please enter a project name.', 'error');
            return;
        }

        if (modalCreate) modalCreate.disabled = true;
        showModalStatus('Creating Google Sheet clone via Apps Script owner...', 'loading');

        try {
            const res = await fetch('/tcpscript/api/projects', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: projectName,
                    status,
                    speaker,
                    source,
                    link
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Server error');
            }

            // Project created successfully!
            projects.unshift(data);

            if (data.moveStatus === 'failed') {
                showModalStatus(`Created, but failed to move to folder: ${data.moveError}`, 'error');
                setTimeout(() => {
                    closeNewProjectModal();
                    renderProjects();
                }, 6000);
            } else if (data.moveStatus === 'outdated_script') {
                showModalStatus('Created. Warning: Google Apps Script Web App is outdated. Please deploy a "New Version".', 'error');
                setTimeout(() => {
                    closeNewProjectModal();
                    renderProjects();
                }, 6000);
            } else {
                showModalStatus('Project created successfully!', 'success');
                setTimeout(() => {
                    closeNewProjectModal();
                    renderProjects();
                    showSyncNotice('Project synced successfully.');
                }, 800);
            }

        } catch (err) {
            console.error('[Project] Create error:', err);
            showModalStatus('Error: ' + err.message, 'error');
            if (modalCreate) modalCreate.disabled = false;
        }
    }

    function showModalStatus(msg, type) {
        if (!modalStatus) return;
        modalStatus.style.display = 'flex';
        modalStatus.className = 'modal-status' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');

        if (type === 'loading') {
            modalStatus.innerHTML = `<span class="spinner"></span>${escapeHtml(msg)}`;
        } else {
            modalStatus.textContent = msg;
        }
    }

    // ── Edit Field Modal ─────────────────────────────────────
    function openEditFieldModal(index, field) {
        if (!editFieldModal) return;
        editingProject = { index, field };

        const project = projects[index];
        const fieldConfig = {
            name: {
                title: 'Edit Project Name',
                label: 'Project Name',
                value: getDisplayProjectName(project.name),
                inputType: 'text'
            },
            status: {
                title: 'Edit Status',
                label: 'Status',
                value: normalizeProjectStatus(project.status),
                inputType: 'select'
            },
            speaker: {
                title: 'Edit Speaker',
                label: 'Speaker (B1)',
                value: project.speaker || '',
                inputType: 'text'
            },
            source: {
                title: 'Edit Source',
                label: 'Source (B2)',
                value: project.source || '',
                inputType: 'text'
            },
            link: {
                title: 'Edit Link',
                label: 'Link',
                value: project.link || '',
                inputType: 'url'
            }
        };

        const config = fieldConfig[field] || fieldConfig.speaker;
        const isSelect = config.inputType === 'select';

        if (editFieldTitle) editFieldTitle.textContent = config.title;
        if (editFieldLabel) editFieldLabel.textContent = config.label;
        if (editFieldInput) {
            editFieldInput.type = config.inputType === 'url' ? 'url' : 'text';
            editFieldInput.value = isSelect ? '' : config.value;
            editFieldInput.style.display = isSelect ? 'none' : '';
        }
        if (editFieldSelect) {
            editFieldSelect.value = isSelect ? config.value : 'not_started';
            editFieldSelect.style.display = isSelect ? '' : 'none';
        }

        editFieldModal.style.display = 'flex';
        if (isSelect && editFieldSelect) {
            editFieldSelect.focus();
        } else if (editFieldInput) {
            editFieldInput.focus();
        }
    }

    function closeEditFieldModal() {
        if (editFieldModal) editFieldModal.style.display = 'none';
        editingProject = null;
    }

    async function handleSaveField() {
        if (!editingProject) return;

        const { index, field } = editingProject;
        const project = projects[index];
        const newValue = field === 'status'
            ? (editFieldSelect ? normalizeProjectStatus(editFieldSelect.value) : 'done')
            : (editFieldInput ? editFieldInput.value.trim() : '');

        if (field === 'name' && !newValue) {
            openMessageModal({
                title: 'Missing Project Name',
                message: 'Project name is required.'
            });
            return;
        }

        const updateBody = {
            id: project.id,
            name: field === 'name' ? newValue : getDisplayProjectName(project.name),
            status: field === 'status' ? newValue : normalizeProjectStatus(project.status),
            speaker: field === 'speaker' ? newValue : (project.speaker || ''),
            source: field === 'source' ? newValue : (project.source || ''),
            link: field === 'link' ? newValue : (project.link || '')
        };

        project.name = updateBody.name;
        project.status = updateBody.status;
        project.speaker = updateBody.speaker;
        project.source = updateBody.source;
        project.link = updateBody.link;
        renderProjects();
        closeEditFieldModal();

        // Save to backend via proxy
        try {
            const res = await fetch('/tcpscript/api/projects', {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(updateBody)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update metadata');
            }
            showSyncNotice('Changes synced successfully.');
        } catch (err) {
            console.error('Update metadata failed:', err);
            openMessageModal({
                title: 'Sync Failed',
                message: 'Could not save changes to KV or Sheet.',
                note: err.message,
                isDanger: true
            });
            // Refresh to restore original data
            loadProjects();
        }
    }

    // ── Admin: User Management Panel ─────────────────────────
    // ── Logout ───────────────────────────────────────────────
    function handleLogout() {
        localStorage.removeItem('autoscript_session_token');
        localStorage.removeItem('autoscript_session_username');
        document.cookie = 'autoscript_session_token=; path=/; max-age=0; SameSite=Lax';
        window.location.href = '/tcpscript/login';
    }

    // ── Event Listeners ──────────────────────────────────────
    if (btnNewProject) btnNewProject.addEventListener('click', openNewProjectModal);
    if (btnNewProjectEmpty) btnNewProjectEmpty.addEventListener('click', openNewProjectModal);
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);
    if (projectSearchInput) {
        projectSearchInput.value = projectSearchQuery;
        projectSearchInput.addEventListener('input', (e) => {
            projectSearchQuery = e.target.value || '';
            renderProjects();
        });
    }
    if (projectStatusFilterSelect) {
        projectStatusFilterSelect.value = projectStatusFilter;
        projectStatusFilterSelect.addEventListener('change', (e) => {
            setProjectStatusFilter(e.target.value);
        });
    }
    if (projectSortSelect) {
        projectSortSelect.value = projectSortMode;
        projectSortSelect.addEventListener('change', (e) => {
            setProjectSortMode(e.target.value);
        });
    }
    if (btnGridView) btnGridView.addEventListener('click', () => setProjectViewMode('grid'));
    if (btnListView) btnListView.addEventListener('click', () => setProjectViewMode('list'));
    
    // New project modal
    if (modalClose) modalClose.addEventListener('click', closeNewProjectModal);
    if (modalCancel) modalCancel.addEventListener('click', closeNewProjectModal);
    if (modalCreate) modalCreate.addEventListener('click', handleCreateProject);

    // Edit field modal
    if (editFieldClose) editFieldClose.addEventListener('click', closeEditFieldModal);
    if (editFieldCancel) editFieldCancel.addEventListener('click', closeEditFieldModal);
    if (editFieldSave) editFieldSave.addEventListener('click', handleSaveField);
    if (confirmModalClose) confirmModalClose.addEventListener('click', () => closeConfirmModal(false));
    if (confirmModalCancel) confirmModalCancel.addEventListener('click', () => closeConfirmModal(false));
    if (confirmModalConfirm) confirmModalConfirm.addEventListener('click', () => closeConfirmModal(true));

    // Close modals on overlay click
    [newProjectModal, editFieldModal, confirmModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal === confirmModal) {
                        closeConfirmModal(false);
                        return;
                    }
                    modal.style.display = 'none';
                    if (modal === editFieldModal) editingProject = null;
                }
            });
        }
    });

    // Keyboard shortcuts for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNewProjectModal();
            closeEditFieldModal();
            closeConfirmModal(false);
        }
        if (e.key === 'Enter') {
            if (editFieldModal && editFieldModal.style.display === 'flex') {
                e.preventDefault();
                handleSaveField();
            } else if (newProjectModal && newProjectModal.style.display === 'flex') {
                e.preventDefault();
                handleCreateProject();
            }
        }
    });

    // ── Initialize ───────────────────────────────────────────
    renderUserInfo();
    syncProjectToolbar();
    loadProjects();

})();
