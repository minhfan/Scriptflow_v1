// ============================================================
//  AUTOSCRIPT TCP — Login Page Logic
//  Netflix-style profile selection & PIN verification.
// ============================================================

(function () {
    'use strict';

    // ── Constants & Gradients ────────────────────────────────
    const GRADIENTS = [
        'linear-gradient(135deg, #10b981, #059669)', // Emerald
        'linear-gradient(135deg, #6366f1, #4f46e5)', // Indigo
        'linear-gradient(135deg, #ec4899, #d946ef)', // Pink/Purple
        'linear-gradient(135deg, #f59e0b, #d97706)', // Amber
        'linear-gradient(135deg, #f43f5e, #e11d48)'  // Rose
    ];

    // ── State ────────────────────────────────────────────────
    let selectedUser = null;
    let profiles = [];
    let adminProfile = null;

    // ── DOM References ───────────────────────────────────────
    const stepProfiles = document.getElementById('stepProfiles');
    const stepPin = document.getElementById('stepPin');
    const profilesGrid = document.getElementById('profilesGrid');
    const pinUserAvatar = document.getElementById('pinUserAvatar');
    const pinUsername = document.getElementById('pinUsername');
    const pinTitle = document.getElementById('pinTitle');
    const pinSubtitle = document.getElementById('pinSubtitle');
    const pinInputsContainer = document.getElementById('pinInputsContainer');
    const pinBoxes = Array.from(document.querySelectorAll('.pin-box'));
    const btnUnlock = document.getElementById('btnUnlock');
    const btnBackProfiles = document.getElementById('btnBackProfiles');
    const authError = document.getElementById('authError');
    const btnAdminAccess = document.getElementById('btnAdminAccess');

    // ── Helpers ──────────────────────────────────────────────
    function getGradientForUser(username, index) {
        if (username.toLowerCase() === 'admin') return GRADIENTS[0]; // Admin is always emerald
        if (username.toLowerCase() === 'nguyên') return GRADIENTS[1]; // Nguyên is always indigo
        return GRADIENTS[index % GRADIENTS.length];
    }

    function showError(msg) {
        if (authError) {
            authError.textContent = msg;
            authError.style.display = 'block';
        }
    }

    function hideError() {
        if (authError) {
            authError.style.display = 'none';
            authError.textContent = '';
        }
    }

    function getSessionCookieToken() {
        const cookieName = 'autoscript_session_token=';
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            if (trimmed.startsWith(cookieName)) {
                return trimmed.substring(cookieName.length);
            }
        }
        return '';
    }

    function persistSessionCookie(token) {
        if (!token) return;
        document.cookie = `autoscript_session_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax; Secure`;
    }

    function clearSessionCookie() {
        document.cookie = 'autoscript_session_token=; path=/; max-age=0; SameSite=Lax';
    }

    // ── Fetch & Render Profiles ──────────────────────────────
    async function loadProfiles() {
        try {
            const res = await fetch('/tcpscript/api/users/profiles');
            if (!res.ok) throw new Error('Failed to load user profiles');
            const loadedProfiles = await res.json();
            adminProfile = loadedProfiles.find(profile => profile.username.toLowerCase() === 'admin') || null;
            profiles = loadedProfiles.filter(profile => profile.username.toLowerCase() !== 'admin');
            renderProfilesGrid();
        } catch (err) {
            showError('Error loading profiles: ' + err.message);
            if (profilesGrid) {
                profilesGrid.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 20px;">Failed to load profiles. Please refresh page.</div>`;
            }
        }
    }

    function renderProfilesGrid() {
        if (!profilesGrid) return;
        profilesGrid.innerHTML = '';

        profiles.forEach((profile, index) => {
            const username = profile.username;
            const initial = username.charAt(0).toUpperCase();
            const gradient = getGradientForUser(username, index);

            const item = document.createElement('div');
            item.className = 'profile-item';
            item.innerHTML = `
                <div class="profile-avatar-wrapper" style="background: ${gradient}">
                    <span class="profile-initial">${initial}</span>
                </div>
                <span class="profile-name">${username}</span>
            `;

            item.addEventListener('click', () => selectProfile(profile, gradient));
            profilesGrid.appendChild(item);
        });

        if (btnAdminAccess) {
            btnAdminAccess.style.display = adminProfile ? 'inline-flex' : 'none';
        }
    }

    // ── Select Profile & Transition ──────────────────────────
    function selectProfile(profile, gradient) {
        selectedUser = profile;
        hideError();

        // Set avatar & info
        if (pinUserAvatar) {
            pinUserAvatar.style.background = gradient;
            pinUserAvatar.querySelector('.profile-initial').textContent = profile.username.charAt(0).toUpperCase();
        }
        if (pinUsername) pinUsername.textContent = profile.username;

        // Custom titles for new vs existing pin
        if (profile.hasPin) {
            if (pinTitle) pinTitle.textContent = 'Profile Lock is on';
            if (pinSubtitle) pinSubtitle.textContent = 'Enter your 4-digit PIN to access this profile.';
        } else {
            if (pinTitle) pinTitle.textContent = 'Set your Profile PIN';
            if (pinSubtitle) pinSubtitle.textContent = 'Choose a 4-digit PIN for first-time sign in.';
        }

        // Reset pin inputs
        pinBoxes.forEach(box => {
            box.value = '';
            box.disabled = false;
        });

        // Switch panel views
        stepProfiles.classList.add('auth-step-hidden');
        stepPin.classList.remove('auth-step-hidden');

        // Focus first box
        setTimeout(() => pinBoxes[0].focus(), 100);
    }

    function backToProfiles() {
        selectedUser = null;
        hideError();
        stepPin.classList.add('auth-step-hidden');
        stepProfiles.classList.remove('auth-step-hidden');
        // reload profiles in case they changed
        loadProfiles();
    }

    // ── PIN Input Keyboard Navigation ────────────────────────
    pinBoxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            const val = e.target.value;
            // Ensure only digit
            if (!/^\d$/.test(val)) {
                e.target.value = '';
                return;
            }

            // Move to next box
            if (index < 3) {
                pinBoxes[index + 1].focus();
            } else {
                // Last box completed, submit!
                submitPin();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (box.value === '' && index > 0) {
                    pinBoxes[index - 1].value = '';
                    pinBoxes[index - 1].focus();
                } else {
                    box.value = '';
                }
                e.preventDefault();
            }
        });
        
        // Prevent typing non-numeric keys
        box.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    });

    // ── Submit PIN to Worker API ─────────────────────────────
    async function submitPin() {
        const pin = pinBoxes.map(b => b.value).join('');
        if (pin.length !== 4) {
            showError('Please enter a 4-digit PIN');
            return;
        }

        hideError();
        
        // Disable boxes while authenticating
        pinBoxes.forEach(b => b.disabled = true);

        try {
            const res = await fetch('/tcpscript/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: selectedUser.username,
                    pin: pin
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Successfully unlocked profile!
            localStorage.setItem('autoscript_session_username', data.username);
            localStorage.setItem('autoscript_session_token', data.token);
            persistSessionCookie(data.token);

            // Fetch and cache webAppUrl and templateId locally so other pages can retrieve them instantly
            try {
                const settingsRes = await fetch('/tcpscript/api/settings', {
                    headers: { 'Authorization': `Bearer ${data.token}` }
                });
                if (settingsRes.ok) {
                    const settings = await settingsRes.json();
                    if (settings.googleSheetsWebAppUrl) {
                        localStorage.setItem('autoscript_google_sheets_url', settings.googleSheetsWebAppUrl);
                    }
                    if (settings.googleTemplateId) {
                        localStorage.setItem('autoscript_google_template_id', settings.googleTemplateId);
                    }
                }
            } catch (err) {
                console.warn('Failed to pre-cache setting configuration:', err);
            }

            // Redirect to project management dashboard
            window.location.href = '/tcpscript/project';

        } catch (err) {
            console.error('Auth error:', err);
            showError(err.message);
            
            // Re-enable and shake inputs on error
            pinBoxes.forEach(b => {
                b.value = '';
                b.disabled = false;
            });
            
            if (pinInputsContainer) {
                pinInputsContainer.classList.add('pin-shake');
                setTimeout(() => {
                    pinInputsContainer.classList.remove('pin-shake');
                }, 400);
            }
            
            pinBoxes[0].focus();
        }
    }

    // ── Check Existing Session ────────────────────────────────
    function syncSessionStateOnLoginPage() {
        const token = localStorage.getItem('autoscript_session_token');
        const username = localStorage.getItem('autoscript_session_username');
        const cookieToken = getSessionCookieToken();

        if ((token || username) && !cookieToken) {
            localStorage.removeItem('autoscript_session_token');
            localStorage.removeItem('autoscript_session_username');
            clearSessionCookie();
        }
    }

    // ── Event Listeners ──────────────────────────────────────
    if (btnUnlock) btnUnlock.addEventListener('click', submitPin);
    if (btnBackProfiles) btnBackProfiles.addEventListener('click', backToProfiles);
    if (btnAdminAccess) {
        btnAdminAccess.addEventListener('click', () => {
            if (!adminProfile) return;
            selectProfile(adminProfile, getGradientForUser(adminProfile.username, 0));
        });
    }

    // ── Initialize ───────────────────────────────────────────
    syncSessionStateOnLoginPage();
    loadProfiles();

})();
