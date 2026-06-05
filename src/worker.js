// ============================================================
//  AUTOSCRIPT TCP — Cloudflare Worker
//  Netflix-style profiles, PIN auth, and user-partitioned project storage on KV.
// ============================================================

const JWT_SECRET = 'autoscript-secret-key-xyz-789-abc-123';
const SESSION_COOKIE_NAME = 'autoscript_session_token';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const PREFIX = '/tcpscript';

        // ── Ensure prefix match ────────────────────────────
        if (!url.pathname.startsWith(PREFIX)) {
            if (env.ASSETS) return env.ASSETS.fetch(request);
            return new Response('Not Found', { status: 404 });
        }

        // ── Strip prefix for internal routing ──────────────
        url.pathname = url.pathname.slice(PREFIX.length) || '/';

        // ── CORS preflight ─────────────────────────────────
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(),
            });
        }

        // ── Public Routes ──────────────────────────────────
        if (url.pathname === '/api/users/profiles' && request.method === 'GET') {
            return handleGetProfiles(env);
        }

        if (url.pathname === '/api/login' && request.method === 'POST') {
            return handleLogin(request, env);
        }

        if (url.pathname === '/' || url.pathname === '/index.html') {
            const user = await verifyTokenAndGetUser(request);
            const targetPath = user ? `${PREFIX}/project` : `${PREFIX}/login`;
            return Response.redirect(`${url.origin}${targetPath}`, 302);
        }

        if (url.pathname.startsWith('/app/')) {
            const user = await verifyTokenAndGetUser(request);
            if (!user) {
                return Response.redirect(`${url.origin}${PREFIX}/login`, 302);
            }
            const requestedProjectId = getProjectIdFromAppPath(url.pathname);
            if (!requestedProjectId) {
                return new Response('Project not found', { status: 404 });
            }
            const userProjects = await env.SETTINGS_KV.get(`user_projects:${user.username}`, { type: 'json' }) || [];
            const matchedProject = userProjects.find((item) => item.id === requestedProjectId);
            if (!matchedProject) {
                return new Response('Project not found', { status: 404 });
            }
            const assetUrl = new URL(request.url);
            assetUrl.pathname = '/app.html';
            return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        }

        // ── Authenticated Routes ───────────────────────────
        if (url.pathname.startsWith('/api/users') || url.pathname.startsWith('/api/projects') || url.pathname.startsWith('/api/project-logs') || url.pathname.startsWith('/api/settings') || url.pathname.startsWith('/api/google-sheets')) {
            const user = await verifyTokenAndGetUser(request);
            if (!user) {
                return jsonResponse({ error: 'Unauthorized: Invalid or expired token' }, 401);
            }

            // Route Settings
            if (url.pathname === '/api/settings') {
                if (request.method === 'GET') {
                    return handleGetSettings(env);
                }
                if (request.method === 'POST') {
                    // Settings write is Admin only
                    if (user.username !== 'Admin') {
                        return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);
                    }
                    return handlePostSettings(request, env);
                }
                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // Route Users (Admin only)
            if (url.pathname === '/api/users') {
                if (user.username !== 'Admin') {
                    return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);
                }
                if (request.method === 'GET') {
                    return handleGetUsersList(env);
                }
                if (request.method === 'POST') {
                    return handlePostUser(request, env);
                }
                if (request.method === 'DELETE') {
                    return handleDeleteUser(request, env);
                }
                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            // Route Projects
            if (url.pathname === '/api/projects/meta' && request.method === 'GET') {
                return handleGetProjectMeta(user.username, url, env);
            }

            if (url.pathname === '/api/projects/video-meta' && request.method === 'PUT') {
                return handlePutProjectVideoMeta(user.username, request, env);
            }

            if (url.pathname === '/api/projects') {
                if (request.method === 'GET') {
                    return handleGetProjects(user.username, env);
                }
                if (request.method === 'POST') {
                    return handleCreateProject(user.username, request, env);
                }
                if (request.method === 'PUT') {
                    return handleUpdateProject(user.username, request, env);
                }
                if (request.method === 'DELETE') {
                    return handleDeleteProject(user.username, request, env);
                }
                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            if (url.pathname === '/api/project-logs') {
                if (request.method === 'GET') {
                    return handleGetProjectLogs(user.username, url, env);
                }
                if (request.method === 'PUT') {
                    return handlePutProjectLogs(user.username, request, env);
                }
                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            if (url.pathname === '/api/google-sheets') {
                return handleGoogleSheetsProxy(user.username, request, env, url);
            }
        }

        // ── Clean URLs (SPA / static routes mapping) ────────
        const publicCleanRoutes = ['/login'];
        const publicAssetRoutes = ['/login.html'];
        const protectedCleanRoutes = ['/project', '/setting', '/app'];
        const protectedAssetRoutes = ['/project.html', '/setting.html', '/app.html'];

        if (publicAssetRoutes.includes(url.pathname)) {
            return env.ASSETS.fetch(new Request(url.toString(), request));
        }

        if (publicCleanRoutes.includes(url.pathname)) {
            url.pathname += '.html';
            return env.ASSETS.fetch(new Request(url.toString(), request));
        }

        if (protectedCleanRoutes.includes(url.pathname)) {
            const user = await verifyTokenAndGetUser(request);
            if (!user) {
                return Response.redirect(`${url.origin}${PREFIX}/login`, 302);
            }
            url.pathname += '.html';
            return env.ASSETS.fetch(new Request(url.toString(), request));
        }

        if (protectedAssetRoutes.includes(url.pathname)) {
            const user = await verifyTokenAndGetUser(request);
            if (!user) {
                return Response.redirect(`${url.origin}${PREFIX}/login`, 302);
            }
        }

        // ── Fall through to static assets ──────────────────
        if (env.ASSETS) {
            return env.ASSETS.fetch(new Request(url.toString(), request));
        }
        return new Response('Not Found', { status: 404 });
    },
};

const DEFAULT_SETTINGS = {
    googleClientId: '1051742339930-exampleclientid12345.apps.googleusercontent.com',
    googleSheetsWebAppUrl: 'https://script.google.com/macros/s/EXAMPLE_SPREADSHEET_APPS_SCRIPT_URL_ABC123/exec',
    googleTemplateId: '1S6YxzKJE7X5vZRZduA36KDc_E00Cdkxp2mD3VXhwfmA',
    googleDriveFolderId: ''
};

// ── GET /api/users/profiles — Read profiles list (public) ──
async function handleGetProfiles(env) {
    try {
        let users = await env.SETTINGS_KV.get('app_users', { type: 'json' });
        if (!users) {
            users = [
                { username: 'Admin', hasPin: false },
                { username: 'Nguyên', hasPin: false }
            ];
            await env.SETTINGS_KV.put('app_users', JSON.stringify(users));
        }
        return jsonResponse(users);
    } catch (err) {
        console.error('[Worker] Profiles read error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── POST /api/login — Verify profile and PIN ──
async function handleLogin(request, env) {
    try {
        const body = await request.json();
        const username = (body.username || '').trim();
        const pin = (body.pin || '').trim();

        if (!username || !pin) {
            return jsonResponse({ error: 'Username and PIN are required' }, 400);
        }

        if (!/^\d{4}$/.test(pin)) {
            return jsonResponse({ error: 'PIN must be a 4-digit number' }, 400);
        }

        let users = await env.SETTINGS_KV.get('app_users', { type: 'json' });
        if (!users) {
            users = [
                { username: 'Admin', hasPin: false },
                { username: 'Nguyên', hasPin: false }
            ];
            await env.SETTINGS_KV.put('app_users', JSON.stringify(users));
        }

        const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) {
            return jsonResponse({ error: 'Profile not found' }, 404);
        }

        const user = users[userIndex];
        const pinKey = `user_pin:${user.username}`;
        const savedPin = await env.SETTINGS_KV.get(pinKey);

        if (!savedPin) {
            // First time login: Set PIN
            await env.SETTINGS_KV.put(pinKey, pin);
            user.hasPin = true;
            await env.SETTINGS_KV.put('app_users', JSON.stringify(users));
            
            const token = await signToken(user.username);
            return jsonResponse(
                { success: true, firstTime: true, username: user.username, token },
                200,
                { 'Set-Cookie': buildSessionCookie(token) }
            );
        } else {
            // Verify PIN
            if (savedPin === pin) {
                const token = await signToken(user.username);
                return jsonResponse(
                    { success: true, username: user.username, token },
                    200,
                    { 'Set-Cookie': buildSessionCookie(token) }
                );
            } else {
                return jsonResponse({ error: 'Incorrect PIN' }, 401);
            }
        }
    } catch (err) {
        console.error('[Worker] Login error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── GET /api/users — List users (Admin only) ──
async function handleGetUsersList(env) {
    const users = await env.SETTINGS_KV.get('app_users', { type: 'json' }) || [];
    return jsonResponse(users);
}

// ── POST /api/users — Create user or Reset user PIN (Admin only) ──
async function handlePostUser(request, env) {
    try {
        const body = await request.json();
        const targetUsername = (body.username || '').trim();
        const action = body.action; // 'create' or 'reset'

        if (!targetUsername) {
            return jsonResponse({ error: 'Username is required' }, 400);
        }

        let users = await env.SETTINGS_KV.get('app_users', { type: 'json' }) || [];

        if (action === 'create') {
            const exists = users.some(u => u.username.toLowerCase() === targetUsername.toLowerCase());
            if (exists) {
                return jsonResponse({ error: 'User already exists' }, 400);
            }
            users.push({ username: targetUsername, hasPin: false });
            await env.SETTINGS_KV.put('app_users', JSON.stringify(users));
            return jsonResponse({ success: true, users });
        } else if (action === 'reset') {
            const userIndex = users.findIndex(u => u.username.toLowerCase() === targetUsername.toLowerCase());
            if (userIndex === -1) {
                return jsonResponse({ error: 'User not found' }, 404);
            }
            await env.SETTINGS_KV.delete(`user_pin:${users[userIndex].username}`);
            users[userIndex].hasPin = false;
            await env.SETTINGS_KV.put('app_users', JSON.stringify(users));
            return jsonResponse({ success: true, users });
        } else if (action === 'changePin') {
            const newPin = (body.pin || '').trim();
            if (!newPin || !/^\d{4}$/.test(newPin)) {
                return jsonResponse({ error: 'PIN must be a 4-digit number' }, 400);
            }
            const userIndex = users.findIndex(u => u.username.toLowerCase() === targetUsername.toLowerCase());
            if (userIndex === -1) {
                return jsonResponse({ error: 'User not found' }, 404);
            }
            await env.SETTINGS_KV.put(`user_pin:${users[userIndex].username}`, newPin);
            users[userIndex].hasPin = true;
            await env.SETTINGS_KV.put('app_users', JSON.stringify(users));
            return jsonResponse({ success: true, users });
        }

        return jsonResponse({ error: 'Invalid action' }, 400);
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── DELETE /api/users — Delete user (Admin only) ──
async function handleDeleteUser(request, env) {
    try {
        const body = await request.json();
        const targetUsername = (body.username || '').trim();

        if (!targetUsername) {
            return jsonResponse({ error: 'Username is required' }, 400);
        }

        if (targetUsername.toLowerCase() === 'admin') {
            return jsonResponse({ error: 'Cannot delete Admin profile' }, 400);
        }

        let users = await env.SETTINGS_KV.get('app_users', { type: 'json' }) || [];
        const userIndex = users.findIndex(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (userIndex === -1) {
            return jsonResponse({ error: 'User not found' }, 404);
        }

        const realUsername = users[userIndex].username;
        users.splice(userIndex, 1);

        // Clean up KV keys
        await env.SETTINGS_KV.delete(`user_pin:${realUsername}`);
        await env.SETTINGS_KV.delete(`user_projects:${realUsername}`);
        await env.SETTINGS_KV.put('app_users', JSON.stringify(users));

        return jsonResponse({ success: true, users });
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── GET /api/projects — Get user projects ──
async function handleGetProjects(username, env) {
    const projects = await env.SETTINGS_KV.get(`user_projects:${username}`, { type: 'json' }) || [];
    return jsonResponse(projects);
}

async function handleGetProjectMeta(username, url, env) {
    const projectId = (url.searchParams.get('id') || '').trim();
    if (!projectId) {
        return jsonResponse({ error: 'Project ID is required' }, 400);
    }

    const projects = await env.SETTINGS_KV.get(`user_projects:${username}`, { type: 'json' }) || [];
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
        return jsonResponse({ error: 'Project not found' }, 404);
    }

    return jsonResponse(project);
}

async function handleGetProjectLogs(username, url, env) {
    const projectId = (url.searchParams.get('id') || '').trim();
    const tab = (url.searchParams.get('tab') || 'Full-show').trim();
    if (!projectId) {
        return jsonResponse({ error: 'Project ID is required' }, 400);
    }

    let logs = await env.SETTINGS_KV.get(`project_logs:${username}:${projectId}:${tab}`, { type: 'json' });
    if (!logs && tab === 'Full-show') {
        logs = await env.SETTINGS_KV.get(`project_logs:${username}:${projectId}`, { type: 'json' });
    }
    return jsonResponse({ success: true, logs: logs || [] });
}

async function handlePutProjectLogs(username, request, env) {
    try {
        const body = await request.json();
        const projectId = (body.projectId || '').trim();
        const tab = (body.sheetTab || 'Full-show').trim();
        const logs = Array.isArray(body.logs) ? body.logs : null;

        if (!projectId) {
            return jsonResponse({ error: 'Project ID is required' }, 400);
        }
        if (!logs) {
            return jsonResponse({ error: 'Logs array is required' }, 400);
        }

        await env.SETTINGS_KV.put(`project_logs:${username}:${projectId}:${tab}`, JSON.stringify(logs));
        return jsonResponse({ success: true, message: 'Project logs synced successfully.' });
    } catch (err) {
        console.error('[Worker] Save project logs error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── POST /api/projects — Create sheet via Apps Script owner credentials and save to user list ──
async function handlePutProjectVideoMeta(username, request, env) {
    try {
        const body = await request.json();
        const projectId = (body.id || '').trim();
        const inputMeta = body.videoMeta && typeof body.videoMeta === 'object' ? body.videoMeta : null;

        if (!projectId) {
            return jsonResponse({ error: 'Project ID is required' }, 400);
        }
        if (!inputMeta) {
            return jsonResponse({ error: 'Video metadata is required' }, 400);
        }

        const userProjectsKey = `user_projects:${username}`;
        const projects = await env.SETTINGS_KV.get(userProjectsKey, { type: 'json' }) || [];
        const projectIndex = projects.findIndex((item) => item.id === projectId);

        if (projectIndex === -1) {
            return jsonResponse({ error: 'Project not found' }, 404);
        }

        const safeMeta = {
            fileName: String(inputMeta.fileName || '').trim(),
            fileSize: Number.isFinite(Number(inputMeta.fileSize)) ? Number(inputMeta.fileSize) : 0,
            fileType: String(inputMeta.fileType || '').trim(),
            lastModified: Number.isFinite(Number(inputMeta.lastModified)) ? Number(inputMeta.lastModified) : 0,
            durationSec: Number.isFinite(Number(inputMeta.durationSec)) ? Number(inputMeta.durationSec) : 0,
            updatedAt: new Date().toISOString()
        };

        projects[projectIndex].videoMeta = safeMeta;
        await env.SETTINGS_KV.put(userProjectsKey, JSON.stringify(projects));

        return jsonResponse({
            success: true,
            message: 'Project video metadata synced successfully.',
            videoMeta: safeMeta
        });
    } catch (err) {
        console.error('[Worker] Save project video metadata error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

async function handleCreateProject(username, request, env) {
    try {
        const body = await request.json();
        const name = (body.name || '').trim();
        const status = normalizeProjectStatus(body.status || 'not_started');
        const speaker = (body.speaker || '').trim();
        const source = (body.source || '').trim();
        const link = (body.link || '').trim();

        if (!name) {
            return jsonResponse({ error: 'Project name is required' }, 400);
        }

        const settings = await env.SETTINGS_KV.get('app_settings', { type: 'json' }) || DEFAULT_SETTINGS;
        const gasUrlStr = settings.googleSheetsWebAppUrl;

        if (!gasUrlStr || gasUrlStr.includes('EXAMPLE_SPREADSHEET_APPS_SCRIPT_URL_ABC123')) {
            return jsonResponse({ error: 'Google Sheets Apps Script URL is not configured in Settings. Please contact the administrator.' }, 400);
        }

        // Call Google Apps Script Web App
        const gasUrl = new URL(gasUrlStr);
        gasUrl.searchParams.set('action', 'createProject');
        gasUrl.searchParams.set('name', name);
        if (settings.googleTemplateId) {
            gasUrl.searchParams.set('templateId', settings.googleTemplateId);
        }
        if (settings.googleDriveFolderId) {
            gasUrl.searchParams.set('folderId', settings.googleDriveFolderId);
        }
        gasUrl.searchParams.set('status', status);
        if (speaker) gasUrl.searchParams.set('speaker', speaker);
        if (source) gasUrl.searchParams.set('source', source);
        if (link) gasUrl.searchParams.set('link', link);

        const gasRes = await fetch(gasUrl.toString(), { redirect: 'follow' });
        if (!gasRes.ok) {
            return jsonResponse({ error: `Apps Script request failed (HTTP ${gasRes.status})` }, 500);
        }

        let gasData;
        try {
            const rawText = await gasRes.text();
            try {
                gasData = JSON.parse(rawText);
            } catch (e) {
                console.error('[Worker] Apps Script returned non-JSON:', rawText);
                return jsonResponse({ error: 'Apps Script error: ' + rawText.substring(0, 100) }, 500);
            }
        } catch (e) {
            return jsonResponse({ error: 'Failed to read response body' }, 500);
        }

        if (gasData.status !== 'success') {
            return jsonResponse({ error: gasData.message || 'Google Apps Script failed to clone sheet' }, 500);
        }

        // Construct project metadata
        const newProject = {
            id: gasData.spreadsheetId,
            name: gasData.spreadsheetName,
            url: gasData.spreadsheetUrl,
            status: status,
            speaker: speaker,
            source: source,
            link: link,
            createdAt: new Date().toISOString(),
            moveStatus: gasData.moveStatus || 'outdated_script',
            moveError: gasData.moveError || null
        };

        // Append to projects in KV
        const userProjectsKey = `user_projects:${username}`;
        let projects = await env.SETTINGS_KV.get(userProjectsKey, { type: 'json' }) || [];
        projects.unshift(newProject);
        await env.SETTINGS_KV.put(userProjectsKey, JSON.stringify(projects));

        return jsonResponse(newProject);
    } catch (err) {
        console.error('[Worker] Create project error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── PUT /api/projects — Update project metadata ──
async function handleUpdateProject(username, request, env) {
    try {
        const body = await request.json();
        const id = (body.id || '').trim();
        const name = (body.name || '').trim();
        const status = normalizeProjectStatus(body.status || 'done');
        const speaker = (body.speaker || '').trim();
        const source = (body.source || '').trim();
        const link = (body.link || '').trim();

        if (!id) {
            return jsonResponse({ error: 'Project ID is required' }, 400);
        }
        if (!name) {
            return jsonResponse({ error: 'Project name is required' }, 400);
        }

        const userProjectsKey = `user_projects:${username}`;
        let projects = await env.SETTINGS_KV.get(userProjectsKey, { type: 'json' }) || [];
        const projectIndex = projects.findIndex(p => p.id === id);

        if (projectIndex === -1) {
            return jsonResponse({ error: 'Project not found' }, 404);
        }

        const project = projects[projectIndex];
        project.name = name;
        project.status = status;
        project.speaker = speaker;
        project.source = source;
        project.link = link;

        // Sync with Google Sheets in background via Apps Script Web App
        const settings = await env.SETTINGS_KV.get('app_settings', { type: 'json' }) || DEFAULT_SETTINGS;
        const gasUrlStr = settings.googleSheetsWebAppUrl;

        if (gasUrlStr && !gasUrlStr.includes('EXAMPLE_SPREADSHEET_APPS_SCRIPT_URL_ABC123')) {
            try {
                const gasUrl = new URL(gasUrlStr);
                gasUrl.searchParams.set('action', 'updateInfo');
                gasUrl.searchParams.set('spreadsheetId', id);
                gasUrl.searchParams.set('name', name);
                gasUrl.searchParams.set('status', status);
                gasUrl.searchParams.set('speaker', speaker);
                gasUrl.searchParams.set('source', source);
                gasUrl.searchParams.set('link', link);
                const gasRes = await fetch(gasUrl.toString(), { redirect: 'follow' });
                if (!gasRes.ok) {
                    console.warn('[Worker] Apps Script metadata sync failed:', gasRes.status);
                }
            } catch (err) {
                console.warn('[Worker] Invalid Apps Script URL on update:', err);
            }
        }

        await env.SETTINGS_KV.put(userProjectsKey, JSON.stringify(projects));
        return jsonResponse({ success: true, project });
    } catch (err) {
        console.error('[Worker] Update project error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── DELETE /api/projects — Delete project from KV ──
async function handleDeleteProject(username, request, env) {
    try {
        const body = await request.json();
        const id = (body.id || '').trim();

        if (!id) {
            return jsonResponse({ error: 'Project ID is required' }, 400);
        }

        const userProjectsKey = `user_projects:${username}`;
        let projects = await env.SETTINGS_KV.get(userProjectsKey, { type: 'json' }) || [];
        const newProjects = projects.filter(p => p.id !== id);

        await env.SETTINGS_KV.put(userProjectsKey, JSON.stringify(newProjects));
        return jsonResponse({ success: true });
    } catch (err) {
        console.error('[Worker] Delete project error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}

// ── GET /api/settings — Read from KV ──
async function handleGetSettings(env) {
    try {
        const data = await env.SETTINGS_KV.get('app_settings', { type: 'json' });
        return jsonResponse(data || DEFAULT_SETTINGS);
    } catch (err) {
        console.error('[Worker] KV read error:', err);
        return jsonResponse(DEFAULT_SETTINGS);
    }
}

// ── POST /api/settings — Write to KV (Admin only) ──
async function handlePostSettings(request, env) {
    try {
        const body = await request.json();
        const settings = {
            googleSheetsWebAppUrl: (body.googleSheetsWebAppUrl || '').trim(),
            googleTemplateId: (body.googleTemplateId || '').trim(),
            googleDriveFolderId: (body.googleDriveFolderId || '').trim(),
            updatedAt: new Date().toISOString(),
        };

        await env.SETTINGS_KV.put('app_settings', JSON.stringify(settings));
        return jsonResponse({ success: true, settings });
    } catch (err) {
        console.error('[Worker] KV write error:', err);
        return jsonResponse({ error: 'Failed to save settings: ' + err.message }, 500);
    }
}

// ── Crypto Helpers ───────────────────────────────────────────
async function signToken(username) {
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const msg = `${username}:${expiry}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(msg)
    );
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Hex encode the message
    const msgHex = Array.from(encoder.encode(msg)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${msgHex}.${signatureHex}`;
}

async function verifyTokenAndGetUser(request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const cookieHeader = request.headers.get('Cookie') || '';
        const tokenFromCookie = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : tokenFromCookie;
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        
        const [msgHex, signatureHex] = parts;
        
        // Decode message
        const msgBytes = new Uint8Array(msgHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const msg = new TextDecoder().decode(msgBytes);
        
        const colonIdx = msg.lastIndexOf(':');
        if (colonIdx === -1) return null;
        const username = msg.substring(0, colonIdx);
        const expiryStr = msg.substring(colonIdx + 1);
        const expiry = parseInt(expiryStr, 10);
        
        if (isNaN(expiry) || Date.now() > expiry) return null;
        
        const encoder = new TextEncoder();
        const keyData = encoder.encode(JWT_SECRET);
        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );
        
        const verified = await crypto.subtle.verify(
            "HMAC",
            key,
            new Uint8Array(signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))),
            encoder.encode(msg)
        );
        
        if (verified) {
            return { username };
        }
    } catch (e) {
        console.error('Token verification error:', e);
    }
    return null;
}

// ── Generic Helpers ──────────────────────────────────────────
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function normalizeProjectStatus(status) {
    return ['ongoing', 'not_started', 'done'].includes(status) ? status : 'done';
}

function getCookieValue(cookieHeader, cookieName) {
    const cookieEntries = String(cookieHeader || '').split(';');
    for (const cookieEntry of cookieEntries) {
        const [name, ...rest] = cookieEntry.trim().split('=');
        if (name === cookieName) {
            return rest.join('=');
        }
    }
    return '';
}

function getProjectIdFromAppPath(pathname) {
    const segments = String(pathname || '').split('/').filter(Boolean);
    if (segments[0] !== 'app' || !segments[1]) {
        return '';
    }
    try {
        return decodeURIComponent(segments[1]);
    } catch (error) {
        return segments[1];
    }
}

function buildSessionCookie(token) {
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax; Secure`;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(),
            ...extraHeaders,
        },
    });
}

// ── Google Sheets Proxy Endpoint ──────────────────────────────────
async function handleGoogleSheetsProxy(username, request, env, url) {
    try {
        const settings = await env.SETTINGS_KV.get('app_settings', { type: 'json' }) || DEFAULT_SETTINGS;
        const gasUrlStr = settings.googleSheetsWebAppUrl;

        if (!gasUrlStr || gasUrlStr.includes('EXAMPLE_SPREADSHEET_APPS_SCRIPT_URL_ABC123')) {
            return jsonResponse({ error: 'Google Sheets Apps Script URL is not configured in Settings.' }, 400);
        }

        const gasUrl = new URL(gasUrlStr);
        let gasRes;

        if (request.method === 'GET') {
            // Forward query parameters
            url.searchParams.forEach((value, key) => {
                gasUrl.searchParams.set(key, value);
            });
            gasRes = await fetch(gasUrl.toString(), { redirect: 'follow' });
        } else if (request.method === 'POST') {
            const body = await request.json();
            gasRes = await fetch(gasUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                redirect: 'follow'
            });
        } else {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        if (!gasRes.ok) {
            return jsonResponse({ error: `Apps Script request failed (HTTP ${gasRes.status})` }, 500);
        }

        let data;
        try {
            const rawText = await gasRes.text();
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.error('[Worker] Google Sheets Proxy returned non-JSON:', rawText);
                return jsonResponse({ error: 'Proxy Apps Script error: ' + rawText.substring(0, 100) }, 500);
            }
        } catch (e) {
            return jsonResponse({ error: 'Failed to read response body' }, 500);
        }

        if (data.status === 'error') {
            return jsonResponse({ error: data.message }, 400);
        }

        return jsonResponse(data);
    } catch (err) {
        console.error('[Worker] Google Sheets Proxy error:', err);
        return jsonResponse({ error: err.message }, 500);
    }
}
