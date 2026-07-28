const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const FormData = require('form-data');
const cookieSession = require('cookie-session');
const https = require('https');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

puppeteer.use(StealthPlugin());

// ==========================================
// HOST ENVIRONMENT DETECTION
// ==========================================
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID ? true : false;
const IS_TERMUX = process.env.PREFIX && process.env.PREFIX.includes('com.termux') ? true : false;
const HOST_ENV = IS_RAILWAY ? 'Railway' : (IS_TERMUX ? 'Termux' : 'Local/Other');
console.log(`[System Engine] Running on Host: ${HOST_ENV}`);

// ==========================================
// CONFIGURATIONS
// ==========================================
const SUPABASE_URL = 'https://nebwfonyhfgxnfkiisvs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYndmb255aGZneG5ma2lpc3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjc0MjMsImV4cCI6MjA5MDk0MzQyM30.me-P_mhC3droVGrHSlD_G3h9-ZgGgR3hy8VyDLFTp58';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let ADMIN_PASSWORD = '@ROMEOPROXY789';

// TELEGRAM CONFIGURATION
const TG_BOT_TOKEN = '6349510394:AAFZNXCdU6glkXiXlg42_y58DNpYHEM-8Aw'; 
const TG_CHAT_ID = '6383817850';
const TG_LIVE_STICKER_ID = 'CAACAgIAAxkBAAE...'; 

const TG_API_ENDPOINTS = [
    "https://api.telegram.org",
    "https://teleapi.vercel.app",
    "https://tg-proxy.romania.workers.dev", 
    "https://api.telegram.org.bot.vercel.app"
];
let stickyProxy = null; 

// HTTPS Agent
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

const activeTimers = {}; 
const systemLogs = []; 
const networkLogs = [];
const licenseStepScreenshots = {}; 
const engineStatus = {}; 
global.watchingUID = null; 
let resetOTP = null;

// RECORDING STATES FOR GIF
const recordingStatus = {};
const recordingFrames = {};

// ==========================================
// PAKISTAN TIME HELPER
// ==========================================
function getPKTTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour12: true });
}

// ==========================================
// GLOBAL QUEUE SYSTEM FOR ACTIVATION
// ==========================================
const executionQueue = [];
let currentRunningUid = null;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.set('trust proxy', true); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieSession({
    name: 'romeo_auth',
    keys: ['super_secret_uchiha_key_2026'],
    maxAge: 24 * 60 * 60 * 1000 
}));

// ==========================================
// DYNAMIC CORS SYSTEM
// ==========================================
let ALLOW_ALL_CORS = true;
const CORS_FILE = 'cors_urls.txt';
if(!fs.existsSync(CORS_FILE)) fs.writeFileSync(CORS_FILE, '', 'utf8');

app.use((req, res, next) => {
    try {
        if (ALLOW_ALL_CORS) {
            res.header('Access-Control-Allow-Origin', '*');
        } else {
            const allowedOrigins = fs.readFileSync(CORS_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
            const origin = req.headers.origin;
            if (allowedOrigins.includes(origin)) {
                res.header('Access-Control-Allow-Origin', origin);
            }
        }
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        
        if (req.method === 'OPTIONS') return res.sendStatus(200);
        next();
    } catch(e) {
        next(e);
    }
});

// ==========================================
// API REQUEST/RESPONSE LOGGER
// ==========================================
const backendApiLogs = [];
app.use((req, res, next) => {
    const isApiRoute = req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ping') || req.originalUrl.startsWith('/step') || req.originalUrl.startsWith('/ch_uid');
    
    if (isApiRoute && !req.originalUrl.includes('api_logs_fetch')) {
        const start = Date.now();
        const oldJson = res.json;
        res.json = function(data) {
            const duration = Date.now() - start;
            let safeReqBody = req.body ? {...req.body} : {};
            if(safeReqBody.password) safeReqBody.password = "***";
            if(safeReqBody.payload) safeReqBody.payload = "[ENCRYPTED_PAYLOAD]";
            
            let safeData = typeof data === 'object' ? {...data} : data;
            if(safeData && safeData.payload) safeData.payload = "[ENCRYPTED_RESPONSE]";
            
            backendApiLogs.unshift({
                time: getPKTTime(),
                method: req.method,
                url: req.originalUrl,
                reqBody: safeReqBody,
                resBody: safeData,
                status: res.statusCode,
                timeTaken: duration + 'ms'
            });
            
            if(backendApiLogs.length > 200) backendApiLogs.pop();
            return oldJson.call(this, data);
        };
    }
    next();
});

process.on('uncaughtException', (err) => console.log(`[System] Uncaught Exception: ${err.message}`));
process.on('unhandledRejection', (reason, promise) => console.log(`[System] Unhandled Rejection Prevented.`));

setTimeout(async () => {
    try {
        const { data } = await supabase.from('settings').select('*').in('key', ['admin_pass']);
        if(data) data.forEach(d => { if(d.key === 'admin_pass') ADMIN_PASSWORD = d.value; });
    } catch(e) { console.log("DB Init Error"); }
}, 2000);

// ==========================================
// AES-256-CBC ENCRYPTION SYSTEM
// ==========================================
const ENCRYPTION_PASSPHRASE = "ROMEO_KING_2026"; 
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_PASSPHRASE).digest();

function encryptData(dataObj, customKey = ENCRYPTION_KEY) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', customKey, iv);
        let encrypted = cipher.update(JSON.stringify(dataObj), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch(e) { return null; }
}

function decryptData(encryptedStr, customKey = ENCRYPTION_KEY) {
    try {
        const parts = encryptedStr.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', customKey, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (e) { return null; }
}

const secureMiddleware = (req, res, next) => {
    try {
        if (req.body && req.body.payload) {
            const decrypted = decryptData(req.body.payload);
            if (!decrypted) return res.status(400).json({ error: "Invalid Encryption Payload" });
            req.body = decrypted;
        }
        const originalJson = res.json;
        res.json = function(data) {
            if(data.error || data.raw) return originalJson.call(this, data);
            return originalJson.call(this, { payload: encryptData(data) });
        };
        next();
    } catch(e) { next(e); }
};

const STRICT_KEY = crypto.createHash('sha256').update('@ROmEo<890>').digest();

const strictSecureMiddleware = (req, res, next) => {
    try {
        const ua = req.headers['user-agent'] || '';
        if (ua.includes('HeadlessChrome') || ua.includes('Puppeteer')) return res.status(403).json({ error: "Bots Blocked" });

        if (req.body && req.body.payload) {
            const decrypted = decryptData(req.body.payload, STRICT_KEY);
            if (!decrypted) return res.status(400).json({ error: "Strict Decryption Failed." });
            
            const strBody = JSON.stringify(decrypted);
            if(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)|(--\s*')/gi.test(strBody)) {
                return res.status(403).json({ error: "SQL Injection Blocked." });
            }
            req.body = decrypted;
        } else if(req.method === 'POST') {
            return res.status(400).json({ error: "Plaintext body completely denied." });
        }

        const originalJson = res.json;
        res.json = function(data) {
            if(data.error || data.raw) return originalJson.call(this, data);
            return originalJson.call(this, { raw: true, payload: encryptData(data, STRICT_KEY) });
        };
        next();
    } catch(e) { next(e); }
};

// ==========================================
// TELEGRAM CORE WITH LIVE TRACKER
// ==========================================
async function sendTgRequest(method, payload, fileData = null) {
    let endpointsToTry = stickyProxy ? [stickyProxy, ...TG_API_ENDPOINTS.filter(e => e !== stickyProxy)] : TG_API_ENDPOINTS;
    let lastErr = "";

    for (let endpoint of endpointsToTry) {
        try {
            let url = `${endpoint}/bot${TG_BOT_TOKEN}/${method}`;
            let res;
            if (fileData) {
                const form = new FormData();
                if (payload) for (let k in payload) form.append(k, payload[k]);
                form.append(fileData.fieldName, fileData.buffer, fileData.filename);
                res = await axios.post(url, form, { headers: form.getHeaders(), timeout: 35000, httpsAgent });
            } else {
                res = await axios.post(url, payload, { headers: {'Content-Type': 'application/json'}, timeout: 15000, httpsAgent });
            }
            if (res.status === 200) { 
                stickyProxy = endpoint; 
                return res.data; 
            }
        } catch (e) {
            lastErr = e.code === 'ECONNRESET' ? 'Connection Reset' : (e.response ? `HTTP ${e.response.status}` : e.message);
        }
    }
    appendLog(`<span style="color: #ef4444; font-weight: 500;">Connection Failed: ${lastErr}</span>`);
    return false;
}

async function sendTelegramScreenshot(base64Image, uid, name, isError = false, overrideCaption = null) {
    if(!base64Image) return;
    const buffer = Buffer.from(base64Image, 'base64');
    let caption = overrideCaption || (isError ? `❌ Action Failed\n\n👤 Name: ${name}\n🆔 UID: ${uid}\n⏱️ Time (PKT): ${getPKTTime()}` : `✅ Success\n\n👤 Name: ${name}\n🆔 UID: ${uid}\n⏱️ Time (PKT): ${getPKTTime()}`);
    
    const res = await sendTgRequest("sendPhoto", { chat_id: TG_CHAT_ID, caption }, { fieldName: 'photo', buffer, filename: 'ss.jpg' });
    if(res) appendLog(`<span style="color: ${isError ? '#ef4444' : '#10b981'};">Screenshot synced.</span>`);
    return res;
}

async function sendTelegramText(text) {
    return await sendTgRequest("sendMessage", { chat_id: TG_CHAT_ID, text, parse_mode: "Markdown" });
}

// TELEGRAM LIVE TRACKER INTERVAL (FAST - 5 Seconds)
setInterval(async () => {
    const clocks = ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'];
    const liveClock = clocks[Math.floor(Date.now() / 1000) % 12];
    
    for (let uid in activeTimers) {
        let t = activeTimers[uid];
        if (t.tgMsgId) {
            try {
                let remainingMs = t.nextRun - Date.now();
                if (remainingMs < 0) remainingMs = 0;
                
                let totalMs = t.intervalMins * 60000;
                if (totalMs <= 0) totalMs = 1;
                
                let percent = Math.max(0, Math.min(100, ((totalMs - remainingMs) / totalMs) * 100));
                
                let barLen = 14;
                let filled = Math.round((percent / 100) * barLen);
                let bar = '▰'.repeat(filled) + '▱'.repeat(barLen - filled);
                
                let m = Math.floor(remainingMs / 60000);
                let s = Math.floor((remainingMs % 60000) / 1000);
                
                let isExecuting = engineStatus[uid] ? `🟢 *Status:* Active` : `⏳ *Status:* Standby`;

                let text = `${liveClock} *NODE TRACKER* ${liveClock}\n\n👤 *Target:* ${t.name}\n🆔 *UID:* \`${uid}\`\n\n⏱️ *Time Left:* ${m}m ${s}s\n📊 *Progress:* ${bar} ${percent.toFixed(1)}%\n\n${isExecuting}`;

                await sendTgRequest("editMessageText", {
                    chat_id: TG_CHAT_ID,
                    message_id: t.tgMsgId,
                    text: text,
                    parse_mode: "Markdown"
                });
            } catch(e) {} 
        }
    }
}, 5000);

// ==========================================
// VERCEL EXTERNAL API ROUTES
// ==========================================
app.post('/api/auth/register', secureMiddleware, async (req, res) => {
    try {
        const { full_name, email, password, uid } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { data: user, error } = await supabase.from('romeo_users').insert([{ full_name, email, password: hashedPassword }]).select().single();
        if (error) return res.json({ success: false, msg: "Email already exists!" });

        const { data: sub } = await supabase.from('romeo_subs').insert([{ user_id: user.id, uid: uid || null, plan_type: 'free' }]).select().single();
        res.json({ success: true, user_id: user.id, role: user.role });
    } catch(e) { res.status(500).json({ success: false, msg: "Server Error" }); }
});

app.post('/api/auth/login', secureMiddleware, async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data: user } = await supabase.from('romeo_users').select('*').eq('email', email).single();
        if (!user) return res.json({ success: false, msg: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, msg: "Invalid Credentials!" });

        const { data: sub } = await supabase.from('romeo_subs').select('*').eq('user_id', user.id).single();
        res.json({ success: true, user_id: user.id, role: user.role, plan: sub.plan_type, uid: sub.uid, expires_at: sub.expires_at });
    } catch(e) { res.status(500).json({ success: false, msg: "Server Error" }); }
});

app.post('/api/user/update_uid', secureMiddleware, async (req, res) => {
    try {
        const { user_id, new_uid } = req.body;
        const { data: sub } = await supabase.from('romeo_subs').update({ uid: new_uid }).eq('user_id', user_id).select().single();
        
        if(sub.plan_type !== 'free') {
            for (let oldUid in activeTimers) {
                if(activeTimers[oldUid].isSub && activeTimers[oldUid].user_id === user_id) {
                    clearTimeout(activeTimers[oldUid].timer);
                    delete activeTimers[oldUid];
                }
            }
            startPremiumCycle(sub.user_id, new_uid, "Premium Pro", sub.expires_at);
        }
        res.json({ success: true, msg: "UID Updated Successfully!" });
    } catch(e) { res.status(500).json({ success: false, msg: "Server Error" }); }
});

app.post('/api/engine/manual_start', secureMiddleware, async (req, res) => {
    try {
        const { user_id, uid } = req.body;
        const { data: sub } = await supabase.from('romeo_subs').select('*, romeo_users(full_name)').eq('user_id', user_id).single();
        if (sub.plan_type !== 'free') return res.json({ success: false, msg: "Pro users auto-activate!" });
        
        if(!executionQueue.includes(uid)) executionQueue.push(uid);
        processQueue();
        res.json({ success: true, msg: "Manual Cycle Started!" });
    } catch(e) { res.status(500).json({ success: false, msg: "Server Error" }); }
});

app.post('/api/admin/upgrade_sub', secureMiddleware, async (req, res) => {
    try {
        const { admin_id, user_id, plan_type, days } = req.body; 
        const { data: admin } = await supabase.from('romeo_users').select('role').eq('id', admin_id).single();
        if(admin.role !== 'admin') return res.json({ success: false, msg: "Unauthorized" });

        const expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + parseInt(days));

        const { data: sub } = await supabase.from('romeo_subs').update({ plan_type, expires_at: expires_at.toISOString() }).eq('user_id', user_id).select().single();
        if(sub.uid) startPremiumCycle(sub.user_id, sub.uid, "Premium User", sub.expires_at);
        res.json({ success: true, msg: "User Upgraded Successfully!" });
    } catch(e) { res.status(500).json({ success: false, msg: "Server Error" }); }
});

// ==========================================
// ENGINE QUEUE PROCESSOR
// ==========================================
async function processQueue() {
    if(currentRunningUid || executionQueue.length === 0) return;
    currentRunningUid = executionQueue.shift();
    try {
        let name = "Website User";
        if (activeTimers[currentRunningUid]) name = activeTimers[currentRunningUid].name;
        await executeEngineWithRetry(currentRunningUid, name);
    } catch(e) {
        console.error("Queue execution error:", e);
    } finally {
        currentRunningUid = null;
        processQueue(); 
    }
}

// ==========================================
// NEW STRICT API ENDPOINTS (Website Client)
// ==========================================
app.post('/ping', strictSecureMiddleware, async (req, res) => {
    try {
        const { license_key, device_fingerprint } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;

        const { data: license } = await supabase.from('licenses').select('*').eq('license_key', license_key).single();
        if (!license) return res.json({ valid: false, msg: "License key is invalid" });

        if (new Date(license.expires_at).getTime() < Date.now()) {
            return res.json({ valid: false, msg: "License timeline has expired" });
        }

        if (license.device_fingerprint && license.device_fingerprint !== device_fingerprint) {
            return res.json({ valid: false, msg: "License key is locked to another device!" });
        }

        if (!license.device_fingerprint) {
            await supabase.from('licenses').update({ device_fingerprint, ip_address: clientIp }).eq('license_key', license_key);
        } else if (license.ip_address !== clientIp) {
            await supabase.from('licenses').update({ ip_address: clientIp }).eq('license_key', license_key);
        }

        const remainingMs = new Date(license.expires_at).getTime() - Date.now();
        return res.json({ valid: true, plan_type: license.plan_type, allowed_uids: license.allowed_uids, uids: license.uids, time_remaining: remainingMs });
    } catch(e) { res.status(500).json({ error: "Ping Processing Error" }) }
});

app.post('/ch_uid', strictSecureMiddleware, async (req, res) => {
    try {
        const { license_key, device_fingerprint, old_uid, new_uid } = req.body;
        const { data: license } = await supabase.from('licenses').select('*').eq('license_key', license_key).single();

        if (!license || license.device_fingerprint !== device_fingerprint) {
            return res.json({ success: false, msg: "Device/Key Mismatch Unauthorized" });
        }

        let updatedUids = [...license.uids || []];
        const idx = updatedUids.indexOf(old_uid);
        if (idx > -1) updatedUids[idx] = new_uid;
        else if (updatedUids.length < license.allowed_uids) updatedUids.push(new_uid);
        else return res.json({ success: false, msg: "Limit reached" });

        await supabase.from('licenses').update({ uids: updatedUids }).eq('license_key', license_key);
        
        if (activeTimers[old_uid]) { clearTimeout(activeTimers[old_uid].timer); delete activeTimers[old_uid]; }
        startPremiumCycle(license_key, new_uid, license.plan_type, license.expires_at, true); 
        
        return res.json({ success: true, msg: "UID Swapped Successfully" });
    } catch(e) { res.status(500).json({ error: "UID Change Processing Error" }) }
});

app.post('/api/uid_status', strictSecureMiddleware, async (req, res) => {
    try {
        const { uid } = req.body;
        if(activeTimers[uid]) {
            const t = activeTimers[uid];
            if(t.isSub) {
                const diff = t.expires_at - Date.now();
                return res.json({ 
                    active: true, plan: "Premium", time_left: diff, 
                    msg: "Plan Active. Auto-renewal enabled."
                });
            } else if(t.isFree) {
                const timeLeft = t.freeExpiry - Date.now();
                if(timeLeft <= 0) return res.json({ active: false, msg: "Limit reached." });
                return res.json({ 
                    active: true, plan: "Free", time_left: timeLeft, 
                    msg: `Session active for ${Math.floor(timeLeft/60000)} mins.` 
                });
            } else {
                return res.json({ 
                    active: true, plan: "Admin Node", time_left: 999999999, 
                    msg: "Continuous session enabled." 
                });
            }
        }
        return res.json({ active: false });
    } catch(e) { res.status(500).json({ error: "Status Error" }) }
});

['/step1', '/step2', '/step3', '/step4', '/step5'].forEach((path, idx) => {
    app.post(path, strictSecureMiddleware, async (req, res) => {
        try {
            const { uid, cookies_valid } = req.body;
            if(!cookies_valid) return res.json({ success: false, msg: "Verification failed." });
            
            if (path === '/step1') {
                const { data: freeUser } = await supabase.from('free_users_track').select('*').eq('uid', uid).single();
                if (freeUser) {
                    if (freeUser.activation_count >= 2) return res.json({ success: false, msg: "Quota reached." });
                    await supabase.from('free_users_track').update({ activation_count: freeUser.activation_count + 1, last_activated: new Date().toISOString() }).eq('uid', uid);
                } else {
                    await supabase.from('free_users_track').insert([{ uid, activation_count: 1, last_activated: new Date().toISOString() }]);
                }

                if (currentRunningUid === uid || engineStatus[uid]) {
                    return res.json({ success: true, step: idx + 2, msg: "Processing." });
                }

                if(!activeTimers[uid]) {
                    startUIDCycle(uid, "Free User", 40, true, false, true);
                }
                
                if (currentRunningUid && currentRunningUid !== uid) {
                    if(!executionQueue.includes(uid)) executionQueue.push(uid);
                    const pos = executionQueue.indexOf(uid) + 1;
                    return res.json({ success: false, waiting: true, msg: `Queue position: #${pos}. Please wait.` });
                }
                
                if(!executionQueue.includes(uid)) {
                    executionQueue.push(uid);
                    processQueue();
                }
            }

            return res.json({ success: true, step: idx + 2, msg: "Processing." });
        } catch(e) { res.status(500).json({ error: "Processor Failed" }) }
    });
});

app.post('/api/auth/destroy', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

function startPremiumCycle(user_id_or_key, uid, name, expires_at, isNewLicenseSys = false) {
    if(!uid) return;
    const expiryDate = new Date(expires_at).getTime();
    if (Date.now() > expiryDate) {
        if (activeTimers[uid]) delete activeTimers[uid];
        return;
    }
    if (activeTimers[uid]) clearTimeout(activeTimers[uid].timer);
    activeTimers[uid] = { isSub: true, user_id: user_id_or_key, name, expires_at: expiryDate, timer: null, autoActivate: true, intervalMins: 40, nextRun: Date.now(), isNewLicenseSys, tgMsgId: null };
    
    if(!executionQueue.includes(uid)) executionQueue.push(uid);
    processQueue();
}

// ==========================================
// MODERN CLEAN UI (SAAS DASHBOARD STYLE)
// ==========================================
const uiHead = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        :root { 
            --bg-color: #f8fafc; 
            --surface: #ffffff; 
            --text-main: #0f172a; 
            --text-muted: #64748b; 
            --border: #e2e8f0; 
            --primary: #4f46e5; 
            --primary-hover: #4338ca;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }
        
        body.dark-mode { 
            --bg-color: #0f172a; 
            --surface: #1e293b; 
            --text-main: #f8fafc; 
            --text-muted: #94a3b8; 
            --border: #334155; 
            --primary: #6366f1; 
            --primary-hover: #818cf8;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
        }
        
        body { 
            background-color: var(--bg-color);
            color: var(--text-main); 
            font-family: 'Inter', sans-serif; 
            overflow-x: hidden; 
            transition: background-color 0.3s ease, color 0.3s ease; 
        }
        
        .card { 
            background-color: var(--surface); 
            border: 1px solid var(--border); 
            border-radius: 16px; 
            box-shadow: var(--shadow);
            transition: all 0.3s ease; 
        }
        
        .text-primary { color: var(--primary); }
        .bg-primary { background-color: var(--primary); }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
        
        input, select { 
            background-color: var(--bg-color); 
            border: 1px solid var(--border); 
            color: var(--text-main); 
            transition: all 0.2s ease; 
            border-radius: 10px; 
            padding: 0.875rem;
            width: 100%;
        }
        input:focus, select:focus { 
            border-color: var(--primary); 
            outline: none; 
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); 
        }
        
        .menu-open { transform: translateX(0) !important; opacity: 1 !important; pointer-events: auto !important; }
        
        .btn-primary { 
            background-color: var(--primary);
            color: white;
            transition: all 0.2s ease; 
            border-radius: 10px; 
            font-weight: 600;
            padding: 0.875rem;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
        }
        .btn-primary:hover { 
            background-color: var(--primary-hover); 
            transform: translateY(-1px);
        }
        
        .progress-bar-container {
            width: 100%; background-color: var(--border); border-radius: 999px; height: 6px; margin-top: 8px; overflow: hidden;
        }
        .progress-bar-fill {
            height: 100%; background-color: var(--primary); transition: width 0.5s ease;
        }
        
        .modal-sheet {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
    </style>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            gsap.registerPlugin(ScrollTrigger);
            
            gsap.from(".animate-box", { 
                y: 15, opacity: 0, duration: 0.4, 
                stagger: 0.05, ease: "power2.out", clearProps: "all" 
            });
            
            if(localStorage.getItem('theme') === 'dark') toggleTheme(true);
            const cachedAvatar = localStorage.getItem('avatar_cache');
            if(cachedAvatar && document.getElementById('admin-avatar')) document.getElementById('admin-avatar').src = cachedAvatar;
            loadAvatar();
        });

        function toggleTheme(forceDark = false) {
            const isDark = forceDark || !document.body.classList.contains('dark-mode');
            if(isDark) {
                document.body.classList.add('dark-mode');
                document.getElementById('theme-icon')?.classList.replace('fa-moon', 'fa-sun');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                document.getElementById('theme-icon')?.classList.replace('fa-sun', 'fa-moon');
                localStorage.setItem('theme', 'light');
            }
        }

        async function loadAvatar() {
            try {
                const res = await fetch('/api/avatar'); 
                const data = await res.json();
                if(data.url) {
                    localStorage.setItem('avatar_cache', data.url);
                    if(document.getElementById('admin-avatar')) document.getElementById('admin-avatar').src = data.url;
                }
            } catch(e) {}
        }
        
        function showSysModal(opts) {
            const m = document.getElementById('sys-modal');
            const b = document.getElementById('sys-modal-box');
            document.getElementById('sys-modal-title').innerText = opts.title || 'Notification';
            document.getElementById('sys-modal-msg').innerHTML = opts.msg || '';
            
            const inp = document.getElementById('sys-modal-input');
            if(opts.type === 'prompt') { inp.classList.remove('hidden'); inp.value = opts.default || ''; inp.focus(); } 
            else { inp.classList.add('hidden'); }
            
            const btnContainer = document.getElementById('sys-modal-btns');
            btnContainer.innerHTML = '';
            
            if(opts.type === 'confirm') {
                btnContainer.innerHTML = \`<button class="px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-color)] transition font-medium" onclick="closeSysModal(false)">Cancel</button>
                                          <button class="px-6 py-2.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition font-medium" onclick="closeSysModal(true)">Confirm</button>\`;
            } else if(opts.type === 'prompt') {
                btnContainer.innerHTML = \`<button class="px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-color)] transition font-medium" onclick="closeSysModal(null)">Cancel</button>
                                          <button class="px-6 py-2.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition font-medium" onclick="closeSysModal(document.getElementById('sys-modal-input').value)">Save</button>\`;
            } else {
                btnContainer.innerHTML = \`<button class="px-8 py-2.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition font-medium w-full" onclick="closeSysModal('ok')">Okay</button>\`;
            }
            
            window.sysModalCallback = opts.cb || function(){};
            m.classList.remove('hidden');
            gsap.fromTo(m, {opacity: 0}, {opacity: 1, duration: 0.2});
            gsap.fromTo(b, {scale: 0.95, opacity: 0}, {scale: 1, opacity: 1, duration: 0.2, ease: "power2.out"});
        }
        function closeSysModal(val) {
            const m = document.getElementById('sys-modal');
            const b = document.getElementById('sys-modal-box');
            gsap.to(b, {scale: 0.95, opacity: 0, duration: 0.15});
            gsap.to(m, {opacity: 0, duration: 0.15, onComplete: () => {
                m.classList.add('hidden');
                if(window.sysModalCallback) window.sysModalCallback(val);
            }});
        }
    </script>
    
    <div id="sys-modal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[300] hidden flex items-center justify-center">
        <div class="modal-sheet p-8 max-w-sm w-[90%] text-center" id="sys-modal-box">
            <h3 id="sys-modal-title" class="text-xl font-semibold mb-2 text-[var(--text-main)]"></h3>
            <p id="sys-modal-msg" class="text-sm text-[var(--text-muted)] mb-6 leading-relaxed"></p>
            <input type="text" id="sys-modal-input" class="hidden mb-6" autocomplete="off" />
            <div class="flex gap-3 justify-center" id="sys-modal-btns"></div>
        </div>
    </div>
`;

const getFloatingHeader = (title, isAdmin) => `
    <header class="fixed top-0 w-full z-[110] bg-[var(--surface)] border-b border-[var(--border)] shadow-sm px-4 md:px-8 py-3 flex justify-between items-center transition-colors duration-300">
        <div class="flex items-center gap-4">
            <button ${isAdmin ? `onclick="document.getElementById('avatar-upload').click()"` : ''} class="w-10 h-10 rounded-full overflow-hidden border border-[var(--border)] relative group">
                <img id="admin-avatar" src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="w-full h-full object-cover">
                ${isAdmin ? `<div class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all"><i class="fa-solid fa-camera text-white text-xs"></i></div>` : ''}
            </button>
            ${isAdmin ? `<input type="file" id="avatar-upload" class="hidden" accept="image/*" onchange="uploadAvatar(this)">` : ''}
            <h1 class="font-semibold text-lg text-[var(--text-main)]">${title}</h1>
        </div>
        
        <button onclick="document.getElementById('overlay-menu').classList.toggle('menu-open')" class="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-color)] hover:text-[var(--text-main)] transition cursor-pointer">
            <i class="fa-solid fa-bars text-lg"></i>
        </button>
    </header>
    
    <div id="overlay-menu" class="fixed top-0 right-0 h-full w-[280px] bg-[var(--surface)] border-l border-[var(--border)] z-[120] transform translate-x-full opacity-0 pointer-events-none transition-all duration-300 flex flex-col p-6 shadow-2xl">
        <div class="flex justify-between items-center mb-8 pb-4 border-b border-[var(--border)]">
            <h4 class="font-semibold text-sm text-[var(--text-muted)] uppercase tracking-wider">Navigation</h4>
            <button onclick="document.getElementById('overlay-menu').classList.remove('menu-open')" class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-color)] transition"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div class="flex flex-col gap-2 text-sm font-medium text-[var(--text-main)]">
            <a href="/" class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition"><i class="fa-solid fa-chart-line w-5 text-center text-[var(--text-muted)]"></i> Overview</a>
            
            ${isAdmin ? `
            <a href="/admin" class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition"><i class="fa-solid fa-layer-group w-5 text-center text-[var(--text-muted)]"></i> Manage Nodes</a>
            <a href="/logs" class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition"><i class="fa-solid fa-file-lines w-5 text-center text-[var(--text-muted)]"></i> System Logs</a>
            <a href="/server_settings" class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition"><i class="fa-solid fa-shield-halved w-5 text-center text-[var(--text-muted)]"></i> Security Settings</a>
            <a href="/stats" class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition"><i class="fa-solid fa-server w-5 text-center text-[var(--text-muted)]"></i> Metrics</a>
            ` : `
            <a href="/login" class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition"><i class="fa-solid fa-lock w-5 text-center text-[var(--text-muted)]"></i> Admin Login</a>
            `}
            
            <div class="p-3 rounded-lg hover:bg-[var(--bg-color)] flex items-center gap-3 transition cursor-pointer mt-2" onclick="toggleTheme()">
                <i class="fa-solid fa-moon w-5 text-center text-[var(--text-muted)]" id="theme-icon"></i> <span>Toggle Theme</span>
            </div>
            
            ${isAdmin ? `<a href="/logout" class="p-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition mt-4"><i class="fa-solid fa-arrow-right-from-bracket w-5 text-center"></i> Sign Out</a>` : ''}
        </div>
    </div>
    
    <script>
        async function uploadAvatar(input) {
            if(input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result;
                    document.getElementById('admin-avatar').src = base64;
                    localStorage.setItem('avatar_cache', base64);
                    await fetch('/api/avatar', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ image: base64 }) });
                };
                reader.readAsDataURL(input.files[0]);
            }
        }
    </script>
`;

// ==========================================
// NEW ROUTE: SYSTEM STATS (UPTIME, CPU, RAM, STORAGE)
// ==========================================
app.get('/api/system/stats_data', (req, res) => {
    if(!req.session.isAdmin) return res.status(403).json({});
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(1);

    const uptime = os.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown CPU';
    
    let storage = 'N/A';
    try {
        if(IS_TERMUX) storage = execSync('df -h /data | awk "NR==2 {print \\$3 \\" / \\" \\$2}"').toString().trim();
        else storage = execSync('df -h / | awk "NR==2 {print \\$3 \\" / \\" \\$2}"').toString().trim();
    } catch(e) {}
    
    let gpu = 'Integrated / N/A';
    if(IS_TERMUX) {
        try {
            const glinfo = execSync('getprop ro.hardware.egl || echo "Mali/Adreno"').toString().trim();
            gpu = glinfo || 'Mali/Adreno';
        } catch(e){}
    } else {
        gpu = "Server Node";
    }

    res.json({
        uptime: `${hours}h ${minutes}m`,
        cpu: `${cpuModel} (${cpus.length} Cores)`,
        ram: `${(usedMem / 1e9).toFixed(2)}GB / ${(totalMem / 1e9).toFixed(2)}GB (${memUsage}%)`,
        storage: storage,
        gpu: gpu
    });
});

app.get('/stats', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>System Metrics</title>${uiHead}</head>
        <body class="min-h-screen pt-24 pb-8 px-4 flex flex-col items-center">
            ${getFloatingHeader('System Metrics', true)}
            <div class="w-full max-w-5xl mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-box">
                <div class="card p-6 flex flex-col">
                    <div class="flex items-center gap-3 mb-2 text-[var(--text-muted)]"><i class="fa-solid fa-microchip"></i> <h3 class="font-medium text-sm">Processor</h3></div>
                    <p id="cpu-stat" class="font-semibold text-lg text-[var(--text-main)]">Loading...</p>
                </div>
                <div class="card p-6 flex flex-col">
                    <div class="flex items-center gap-3 mb-2 text-[var(--text-muted)]"><i class="fa-solid fa-memory"></i> <h3 class="font-medium text-sm">Memory Usage</h3></div>
                    <p id="ram-stat" class="font-semibold text-lg text-[var(--text-main)]">Loading...</p>
                </div>
                <div class="card p-6 flex flex-col">
                    <div class="flex items-center gap-3 mb-2 text-[var(--text-muted)]"><i class="fa-solid fa-hard-drive"></i> <h3 class="font-medium text-sm">Storage</h3></div>
                    <p id="storage-stat" class="font-semibold text-lg text-[var(--text-main)]">Loading...</p>
                </div>
                <div class="card p-6 flex flex-col">
                    <div class="flex items-center gap-3 mb-2 text-[var(--text-muted)]"><i class="fa-solid fa-display"></i> <h3 class="font-medium text-sm">Graphics</h3></div>
                    <p id="gpu-stat" class="font-semibold text-lg text-[var(--text-main)]">Loading...</p>
                </div>
                <div class="card p-6 flex flex-col md:col-span-2">
                    <div class="flex items-center gap-3 mb-2 text-[var(--text-muted)]"><i class="fa-solid fa-clock"></i> <h3 class="font-medium text-sm">System Uptime</h3></div>
                    <p id="uptime-stat" class="font-semibold text-lg text-[var(--text-main)]">Loading...</p>
                </div>
            </div>
            <script>
                async function loadStats() {
                    const res = await fetch('/api/system/stats_data');
                    const data = await res.json();
                    document.getElementById('cpu-stat').innerText = data.cpu;
                    document.getElementById('ram-stat').innerText = data.ram;
                    document.getElementById('storage-stat').innerText = data.storage;
                    document.getElementById('gpu-stat').innerText = data.gpu;
                    document.getElementById('uptime-stat').innerText = data.uptime;
                }
                loadStats();
                setInterval(loadStats, 5000);
            </script>
        </body></html>
    `);
});

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================
app.get('/', (req, res) => {
    const isAdmin = req.session.isAdmin;
    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>Overview</title>${uiHead}</head>
        <body class="min-h-screen pt-24 pb-8 px-4 flex flex-col items-center">
            ${getFloatingHeader('Overview', isAdmin)}
            
            <div class="w-full max-w-5xl card animate-box p-6 md:p-8 mt-4">
                <div class="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
                    <div>
                        <h3 class="font-semibold text-lg text-[var(--text-main)]">Active Sessions</h3>
                        <p class="text-sm text-[var(--text-muted)] mt-1">Real-time status of connected nodes.</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead><tr class="text-xs uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]"><th class="pb-3 pl-2 font-medium">Node Details</th><th class="pb-3 font-medium">Status & Progress</th><th class="pb-3 text-center font-medium">Preview</th></tr></thead>
                        <tbody id="status-body"><tr><td colspan="3" class="text-center py-12 text-[var(--text-muted)] text-sm"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Connecting to server...</td></tr></tbody>
                    </table>
                </div>
            </div>

            ${isAdmin ? `
            <div id="preview-modal" class="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] hidden flex flex-col items-center justify-center opacity-0 transition-opacity duration-300">
                <div class="absolute top-0 w-full p-4 flex justify-between items-center z-50">
                    <div class="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-white">
                        <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span class="text-sm font-medium">Live Feed: <span id="modal-uid" class="ml-1 opacity-80"></span></span>
                    </div>
                    <button onclick="closePreview()" class="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="relative w-full max-w-[360px] h-[640px] max-h-[80vh] bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center mt-12 border border-white/10">
                    <img id="live-screen" src="" class="absolute inset-0 w-full h-full object-cover hidden transition-opacity duration-300" />
                    <div id="no-signal" class="text-white/50 flex flex-col items-center z-10">
                        <i class="fa-solid fa-video-slash text-3xl mb-3"></i>
                        <span class="text-sm font-medium">Waiting for video stream...</span>
                    </div>
                </div>
            </div>` : ''}

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const isAdmin = ${isAdmin ? 'true' : 'false'};
                let currentWatch = null;

                socket.on('update_ui', function(data) {
                    const tbody = document.getElementById('status-body');
                    const keys = Object.keys(data);
                    if(keys.length === 0) return tbody.innerHTML = '<tr><td colspan="3" class="text-center py-12 text-[var(--text-muted)] text-sm">No active sessions found.</td></tr>';
                    
                    let html = '';
                    for (let uid in data) {
                        let info = data[uid];
                        
                        let previewBtn = '<button class="px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-muted)] text-xs opacity-50 cursor-not-allowed">Locked</button>';
                        
                        if (isAdmin) {
                            previewBtn = info.isRunning 
                                ? \`<button onclick="openPreview('\${uid}')" class="px-3 py-1.5 rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition text-xs font-medium">View Screen</button>\`
                                : \`<button class="px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--text-muted)] text-xs opacity-50 cursor-not-allowed">Offline</button>\`;
                        }

                        let statusBadge = !info.autoActivate ? '<span class="ml-2 px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Paused</span>' : '';

                        let barHtml = \`<div class="progress-bar-container"><div class="progress-bar-fill" style="width: \${info.percent}%;"></div></div>\`;

                        html += '<tr class="border-b border-[var(--border)] hover:bg-[var(--bg-color)] transition-colors">' +
                            '<td class="py-4 pl-2">' + 
                                '<div class="font-medium text-sm text-[var(--text-main)] flex items-center">' + info.name + statusBadge + '</div>' + 
                                '<div class="text-xs text-[var(--text-muted)] mt-1 font-mono">' + uid + '</div>' +
                            '</td>' +
                            '<td class="py-4 pr-6">' + 
                                '<div class="text-sm font-medium text-[var(--text-main)] mb-1.5">' + info.remaining + '</div>' + 
                                barHtml + 
                            '</td>' +
                            '<td class="py-4 text-center">' + previewBtn + '</td>' +
                        '</tr>';
                    }
                    tbody.innerHTML = html;
                });

                ${isAdmin ? `
                socket.on('live_frame', function(data) {
                    if(currentWatch === data.uid) {
                        document.getElementById('no-signal').classList.add('hidden');
                        const img = document.getElementById('live-screen');
                        img.classList.remove('hidden');
                        img.src = 'data:image/jpeg;base64,' + data.frame;
                    }
                });

                function openPreview(uid) {
                    currentWatch = uid;
                    document.getElementById('modal-uid').innerText = uid;
                    const modal = document.getElementById('preview-modal');
                    modal.classList.remove('hidden');
                    setTimeout(() => modal.classList.remove('opacity-0'), 10);
                    socket.emit('start_watch', {uid: uid, token: 'session'});
                }

                function closePreview() {
                    const modal = document.getElementById('preview-modal');
                    modal.classList.add('opacity-0');
                    setTimeout(() => modal.classList.add('hidden'), 300);
                    socket.emit('stop_watch');
                    currentWatch = null;
                    document.getElementById('live-screen').classList.add('hidden');
                    document.getElementById('no-signal').classList.remove('hidden');
                }
                ` : ''}
            </script>
        </body></html>
    `);
});

app.get('/login', (req, res) => {
    if(req.session.isAdmin) return res.redirect('/admin');
    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>Admin Login</title>${uiHead}</head>
        <body class="flex items-center justify-center min-h-screen relative">
            <div id="auth-panel" class="modal-sheet p-8 w-[90%] max-w-sm text-center z-10 transition-all duration-300">
                <div class="mb-6 inline-flex w-16 h-16 rounded-2xl bg-[var(--primary)] text-white items-center justify-center shadow-lg">
                    <i class="fa-solid fa-shield-halved text-2xl"></i>
                </div>
                <h2 class="text-xl font-semibold mb-6 text-[var(--text-main)]">Admin Access</h2>
                <form action="/login" method="POST" class="flex flex-col gap-4">
                    <input type="password" name="password" placeholder="Enter Master Password" required />
                    <button type="submit" class="btn-primary mt-2">Sign In</button>
                </form>
                <div class="mt-6 text-xs font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--primary)] transition" onclick="showForgot()">Recover Access</div>
            </div>

            <div id="forgot-panel" class="modal-sheet p-8 w-[90%] max-w-sm text-center z-10 hidden absolute transition-all duration-300">
                <div class="mb-6 inline-flex w-16 h-16 rounded-2xl bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400 items-center justify-center">
                    <i class="fa-solid fa-key text-2xl"></i>
                </div>
                <h2 class="text-xl font-semibold mb-2 text-[var(--text-main)]">Account Recovery</h2>
                <p class="text-xs text-[var(--text-muted)] mb-6">A verification code will be sent to the master telegram channel.</p>
                
                <button onclick="sendOTP()" id="otp-btn" class="btn-primary w-full bg-orange-500 hover:bg-orange-600 shadow-none mb-4">Request Code</button>
                <form id="reset-form" class="hidden flex flex-col gap-4" onsubmit="event.preventDefault(); resetPass();">
                    <input type="text" id="otp-code" placeholder="Enter OTP Code" required class="text-center font-mono tracking-widest"/>
                    <input type="password" id="new-pass" placeholder="Enter New Password" required />
                    <button type="submit" class="btn-primary mt-2 bg-orange-500 hover:bg-orange-600">Update Password</button>
                </form>
                <div class="mt-6 text-xs font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-main)] transition" onclick="hideForgot()">Back to Login</div>
            </div>
            
            <script>
                if(localStorage.getItem('authErr')) {
                    showSysModal({title: "Access Denied", msg: "Incorrect password provided. Please try again.", type: "alert"});
                    localStorage.removeItem('authErr');
                }
                function showForgot() { 
                    const auth = document.getElementById('auth-panel');
                    const forg = document.getElementById('forgot-panel');
                    gsap.to(auth, {y: -10, opacity: 0, duration: 0.2, onComplete: () => {
                        auth.classList.add('hidden');
                        forg.classList.remove('hidden');
                        gsap.fromTo(forg, {y: 10, opacity: 0}, {y: 0, opacity: 1, duration: 0.2});
                    }});
                }
                function hideForgot() { 
                    const auth = document.getElementById('auth-panel');
                    const forg = document.getElementById('forgot-panel');
                    gsap.to(forg, {y: 10, opacity: 0, duration: 0.2, onComplete: () => {
                        forg.classList.add('hidden');
                        auth.classList.remove('hidden');
                        gsap.fromTo(auth, {y: -10, opacity: 0}, {y: 0, opacity: 1, duration: 0.2});
                    }});
                }
                
                async function sendOTP() {
                    document.getElementById('otp-btn').innerText = "Sending...";
                    await fetch('/api/auth/forgot', {method: 'POST'});
                    document.getElementById('otp-btn').classList.add('hidden');
                    document.getElementById('reset-form').classList.remove('hidden');
                }
                
                async function resetPass() {
                    const otp = document.getElementById('otp-code').value;
                    const pass = document.getElementById('new-pass').value;
                    const res = await fetch('/api/auth/reset', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({otp, pass})});
                    const data = await res.json();
                    if(data.success) { 
                        showSysModal({title:"Success", msg:"Password updated successfully.", cb: () => window.location.reload() });
                    } else { 
                        showSysModal({title:"Error", msg:"Invalid OTP code entered."}); 
                    }
                }
            </script>
        </body></html>
    `);
});

app.post('/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) { req.session.isAdmin = true; res.redirect('/admin'); } 
    else { res.send(`<script>localStorage.setItem('authErr', '1'); window.location.href='/login';</script>`); }
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

app.post('/api/auth/forgot', async (req, res) => {
    resetOTP = Math.floor(1000 + Math.random() * 9000).toString();
    await sendTgRequest("sendMessage", { chat_id: TG_CHAT_ID, text: `🔐 *Admin Access Recovery*\n\nYour OTP is: \`${resetOTP}\``, parse_mode: "Markdown" });
    res.json({success: true});
});

app.post('/api/auth/reset', async (req, res) => {
    if(req.body.otp === resetOTP && resetOTP !== null) {
        ADMIN_PASSWORD = req.body.pass;
        await supabase.from('settings').upsert({ key: 'admin_pass', value: ADMIN_PASSWORD });
        resetOTP = null;
        res.json({success: true});
    } else res.json({success: false});
});

app.get('/admin', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');

    const { data: users } = await supabase.from('targets').select('*');
    const { data: licenses } = await supabase.from('licenses').select('*');
    
    let usersHtml = '';
    if (users && users.length > 0) {
        users.forEach(u => {
            let activeColor = u.auto_activate ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' : 'text-[var(--text-muted)] bg-[var(--bg-color)]';
            
            usersHtml += `<div class="p-4 rounded-xl border border-[var(--border)] flex flex-col md:flex-row justify-between items-center gap-3 mb-3 bg-[var(--bg-color)]">
                <div class="text-center md:text-left w-full md:w-auto">
                    <b class="text-sm font-medium text-[var(--text-main)]">${u.name}</b>
                    <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                        <span class="text-xs text-[var(--text-muted)] font-mono">${u.uid}</span>
                        <span class="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer hover:opacity-80" onclick="editTime('${u.uid}', ${u.interval_mins})">
                            <i class="fa-regular fa-clock mr-1"></i> ${u.interval_mins}m 
                        </span>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto justify-center md:justify-end">
                    <button class="px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeColor}" onclick="toggleAuto('${u.uid}', ${!u.auto_activate})">${u.auto_activate ? 'Active' : 'Paused'}</button>
                    <button class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition" onclick="delUser('${u.id}', '${u.uid}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        });
    }

    let licensesHtml = '';
    if (licenses && licenses.length > 0) {
        licenses.forEach(l => {
            const timeDiff = new Date(l.expires_at).getTime() - Date.now();
            const daysLeft = timeDiff > 0 ? (timeDiff / (1000 * 60 * 60 * 24)).toFixed(1) + 'd' : '<span class="text-red-500 font-medium">Expired</span>';
            const bindInfo = l.ip_address ? `<span class="text-[var(--text-main)]" title="${l.device_fingerprint}">${l.ip_address}</span>` : '<span class="text-[var(--text-muted)]">Unbound</span>';
            licensesHtml += `<div class="p-4 rounded-xl border border-[var(--border)] flex flex-col gap-2 mb-3 bg-[var(--bg-color)]">
                <div class="flex justify-between items-center"><b class="text-xs font-mono text-[var(--text-main)]">${l.license_key}</b> <span class="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">${l.plan_type}</span></div>
                <div class="flex justify-between text-xs text-[var(--text-muted)] mt-1"><span>Time left: ${daysLeft}</span> <span>IP: ${bindInfo}</span></div>
                <div class="flex gap-2 mt-2 pt-3 border-t border-[var(--border)] justify-end">
                    <button onclick="flushDevice('${l.license_key}')" class="px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 rounded transition">Reset Device</button>
                    <button onclick="delLicense('${l.license_key}')" class="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded transition">Delete</button>
                </div>
            </div>`;
        });
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>Admin Panel</title>${uiHead}</head>
        <body class="min-h-screen pt-24 pb-8 px-4 flex flex-col items-center">
            ${getFloatingHeader('Control Center', true)}
            
            <div class="w-full max-w-7xl mt-4">
                <div class="flex justify-end mb-6 animate-box">
                    <button onclick="changeAdminPass()" class="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] text-sm font-medium hover:bg-[var(--bg-color)] transition shadow-sm">
                        <i class="fa-solid fa-lock mr-2 text-[var(--text-muted)]"></i> Change Password
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="flex flex-col gap-6">
                        <div class="card animate-box p-6">
                            <h3 class="text-sm font-semibold mb-4 text-[var(--text-main)]">Add New Node</h3>
                            <input type="text" id="name" placeholder="Name or Alias" class="mb-3" />
                            <input type="text" id="uid" placeholder="Target Identifier (UID)" class="mb-3 font-mono text-sm" />
                            <input type="number" id="interval" placeholder="Check Interval (Minutes)" class="mb-4" />
                            <button onclick="addUser()" class="btn-primary w-full">Deploy Node</button>
                        </div>
                        
                        <div class="card animate-box p-6">
                            <h3 class="text-sm font-semibold mb-4 text-[var(--text-main)]">Generate License Key</h3>
                            <select id="plan_type" class="mb-3">
                                <option value="trial">Trial Access (1 Day)</option>
                                <option value="weekly">Weekly Pass (7 Days)</option>
                                <option value="monthly">Monthly Subscription (30 Days)</option>
                                <option value="superuser">Super User (10 UIDs)</option>
                            </select>
                            <input type="number" step="0.1" id="plan_days" placeholder="Custom Duration (Days)" class="mb-4" />
                            <button onclick="genLicense()" class="btn-primary w-full bg-purple-600 hover:bg-purple-700">Create Key</button>
                        </div>
                    </div>

                    <div class="card animate-box p-6 lg:col-span-1 flex flex-col max-h-[750px]">
                        <h3 class="text-sm font-semibold mb-4 text-[var(--text-main)] border-b border-[var(--border)] pb-3">Deployed Nodes</h3>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">${usersHtml || '<div class="text-center py-12 text-[var(--text-muted)] text-sm">No nodes have been added yet.</div>'}</div>
                    </div>

                    <div class="card animate-box p-6 lg:col-span-1 flex flex-col max-h-[750px]">
                        <h3 class="text-sm font-semibold mb-4 text-[var(--text-main)] border-b border-[var(--border)] pb-3">License Registry</h3>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">${licensesHtml || '<div class="text-center py-12 text-[var(--text-muted)] text-sm">No licenses have been generated.</div>'}</div>
                    </div>
                </div>
            </div>
            <script>
                async function addUser() {
                    const name = document.getElementById('name').value;
                    const uid = document.getElementById('uid').value;
                    const interval = document.getElementById('interval').value || 40;
                    if(!name || !uid) return showSysModal({msg: "Please fill in all required fields."});
                    await fetch('/api/target/add', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, uid, interval}) });
                    window.location.reload();
                }
                function delUser(id, uid) {
                    showSysModal({title: "Remove Node", msg: "Are you sure you want to delete this node?", type: "confirm", cb: async (res) => {
                        if(res) {
                            await fetch('/api/target/del', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, uid}) });
                            window.location.reload();
                        }
                    }});
                }
                async function toggleAuto(uid, status) {
                    await fetch('/api/target/toggle', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({uid, status}) });
                    window.location.reload();
                }
                function editTime(uid, oldTime) {
                    showSysModal({title: "Update Schedule", msg: "Enter new interval time (minutes):", type: "prompt", default: oldTime, cb: async (newTime) => {
                        if(newTime && !isNaN(newTime) && newTime != oldTime) {
                            await fetch('/api/target/edit_time', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({uid, interval: parseInt(newTime)}) });
                            window.location.reload();
                        }
                    }});
                }
                function changeAdminPass() {
                    showSysModal({title: "Update Security", msg: "Enter new master password:", type: "prompt", cb: async (newPass) => {
                        if(newPass && newPass.length >= 6) {
                            await fetch('/api/auth/change_pass', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({newPass}) });
                            showSysModal({title: "Success", msg: "Password updated successfully."});
                        } else if (newPass) showSysModal({title: "Error", msg: "Password must be at least 6 characters long."});
                    }});
                }
                
                async function genLicense() {
                    const plan = document.getElementById('plan_type').value;
                    const days = document.getElementById('plan_days').value;
                    await fetch('/api/admin/issue_key', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({plan, days}) });
                    window.location.reload();
                }
                async function flushDevice(key) {
                    await fetch('/api/admin/flush_device', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key}) });
                    window.location.reload();
                }
                async function delLicense(key) {
                    showSysModal({title: "Delete License", msg: "Are you sure you want to delete this license key?", type: "confirm", cb: async (res) => {
                        if(res) {
                            await fetch('/api/admin/purge_key', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key}) });
                            window.location.reload();
                        }
                    }});
                }
            </script>
        </body></html>
    `);
});

app.post('/api/auth/change_pass', async (req, res) => {
    if(!req.session.isAdmin) return res.json({success:false});
    ADMIN_PASSWORD = req.body.newPass;
    await supabase.from('settings').upsert({ key: 'admin_pass', value: ADMIN_PASSWORD });
    res.json({success:true});
});

app.post('/api/target/edit_time', async (req, res) => {
    if(!req.session.isAdmin) return res.json({success:false});
    const { uid, interval } = req.body;
    await supabase.from('targets').update({ interval_mins: interval }).eq('uid', uid);
    if(activeTimers[uid]) {
        const t = activeTimers[uid];
        t.intervalMins = interval;
        if(t.autoActivate) scheduleNextRun(uid); 
    }
    res.json({ success: true });
});

app.post('/api/admin/issue_key', async (req, res) => {
    if(!req.session.isAdmin) return res.json({success:false});
    const { plan, days } = req.body;
    
    let finalDays = plan === 'trial' ? 1 : (plan === 'weekly' ? 7 : 30);
    if(days && !isNaN(parseFloat(days))) finalDays = parseFloat(days);

    const generatedKey = 'ROMEO-' + crypto.randomBytes(3).toString('hex').toUpperCase().substring(0,5) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const expiry = new Date(); 
    expiry.setHours(expiry.getHours() + (finalDays * 24)); 

    const slots = plan === 'superuser' ? 10 : 1;

    await supabase.from('licenses').insert([{ license_key: generatedKey, plan_type: plan, expires_at: expiry.toISOString(), allowed_uids: slots }]);
    res.json({ success: true });
});
app.post('/api/admin/flush_device', async (req, res) => {
    if(!req.session.isAdmin) return res.json({success:false});
    await supabase.from('licenses').update({ device_fingerprint: null, ip_address: null }).eq('license_key', req.body.key);
    res.json({ success: true });
});
app.post('/api/admin/purge_key', async (req, res) => {
    if(!req.session.isAdmin) return res.json({success:false});
    await supabase.from('licenses').delete().eq('license_key', req.body.key);
    res.json({ success: true });
});

app.get('/server_settings', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');
    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>Security Settings</title>${uiHead}</head>
        <body class="min-h-screen pt-24 pb-8 px-4 flex flex-col items-center">
            ${getFloatingHeader('Security Settings', true)}
            
            <div class="w-full max-w-7xl mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card animate-box p-6 flex flex-col">
                    <h3 class="font-semibold text-[var(--text-main)] mb-4 border-b border-[var(--border)] pb-3">CORS Configuration</h3>
                    
                    <div class="flex items-center justify-between bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-4 mb-5">
                        <div>
                            <div class="font-medium text-sm text-[var(--text-main)]">Allow Global Access (*)</div>
                            <div class="text-xs text-[var(--text-muted)] mt-1">If disabled, only domains below are allowed.</div>
                        </div>
                        <button id="cors-toggle" onclick="toggleCors()" class="px-4 py-2 rounded-lg text-xs font-medium transition ${ALLOW_ALL_CORS ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]'}">
                            ${ALLOW_ALL_CORS ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>

                    <div class="flex gap-3 mb-5">
                        <input type="text" id="new-cors-url" placeholder="e.g. https://example.com" class="text-sm" />
                        <button onclick="addCorsUrl()" class="btn-primary px-6 whitespace-nowrap">Add URL</button>
                    </div>

                    <div id="cors-list" class="flex-1 overflow-y-auto space-y-2 max-h-[300px] custom-scrollbar"></div>
                </div>

                <div class="card animate-box p-6 flex flex-col h-[65vh]">
                    <div class="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-4">
                        <h3 class="font-semibold text-[var(--text-main)]">API Traffic Logs</h3>
                        <button onclick="fetchApiLogs()" class="px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--bg-color)] text-[var(--text-muted)] text-xs font-medium transition">Refresh Data</button>
                    </div>
                    <div id="api-logs-container" class="flex-1 overflow-y-auto space-y-3 custom-scrollbar"></div>
                </div>
            </div>

            <script>
                async function fetchSettings() {
                    const res = await fetch('/api/system/settings_fetch');
                    const data = await res.json();
                    renderCorsList(data.urls);
                }
                
                function renderCorsList(urls) {
                    const list = document.getElementById('cors-list');
                    if(urls.length === 0) return list.innerHTML = '<div class="text-center text-[var(--text-muted)] py-6 text-sm">No domains added to the whitelist.</div>';
                    list.innerHTML = urls.map(u => \`<div class="flex justify-between items-center bg-[var(--bg-color)] rounded-lg p-3 border border-[var(--border)]">
                        <span class="text-sm text-[var(--text-main)]">\${u}</span>
                        <button onclick="removeCorsUrl('\${u}')" class="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 p-2 rounded-md transition"><i class="fa-solid fa-trash-can text-sm"></i></button>
                    </div>\`).join('');
                }

                async function toggleCors() {
                    const btn = document.getElementById('cors-toggle');
                    const isCurrentlyOn = btn.innerText.includes('Enabled');
                    const res = await fetch('/api/system/cors_toggle', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status: !isCurrentlyOn}) });
                    const data = await res.json();
                    if(data.success) window.location.reload();
                }

                async function addCorsUrl() {
                    const url = document.getElementById('new-cors-url').value;
                    if(!url) return;
                    await fetch('/api/system/cors_add', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url}) });
                    document.getElementById('new-cors-url').value = '';
                    fetchSettings();
                }

                async function removeCorsUrl(url) {
                    await fetch('/api/system/cors_remove', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url}) });
                    fetchSettings();
                }

                async function fetchApiLogs() {
                    const res = await fetch('/api/system/api_logs_fetch');
                    const data = await res.json();
                    const container = document.getElementById('api-logs-container');
                    if(data.logs.length === 0) return container.innerHTML = '<div class="text-center text-[var(--text-muted)] py-10 text-sm">No recent API traffic found.</div>';
                    
                    container.innerHTML = data.logs.map(log => {
                        const statusClass = log.status >= 400 ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' : 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
                        return \`<div class="bg-[var(--bg-color)] rounded-xl p-4 border border-[var(--border)]">
                            <div class="flex justify-between items-center mb-3 border-b border-[var(--border)] pb-3">
                                <span class="font-medium text-sm text-[var(--text-main)]">\${log.method} <span class="text-[var(--text-muted)] font-normal text-xs ml-2">\${log.url}</span></span>
                                <div class="flex items-center gap-3">
                                    <span class="text-xs text-[var(--text-muted)]">\${log.timeTaken}</span>
                                    <span class="px-2 py-0.5 rounded text-xs font-medium \${statusClass}">\${log.status}</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 mt-2">
                                <div class="bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)]"><div class="text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-wider font-semibold">Request Body</div><pre class="text-[10px] text-[var(--text-main)] overflow-x-auto font-mono">\${JSON.stringify(log.reqBody, null, 2)}</pre></div>
                                <div class="bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)]"><div class="text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-wider font-semibold">Response</div><pre class="text-[10px] text-[var(--text-main)] overflow-x-auto font-mono">\${JSON.stringify(log.resBody, null, 2)}</pre></div>
                            </div>
                        </div>\`;
                    }).join('');
                }

                fetchSettings();
                fetchApiLogs();
                setInterval(fetchApiLogs, 5000);
            </script>
        </body></html>
    `);
});

app.get('/api/system/settings_fetch', (req, res) => {
    if(!req.session.isAdmin) return res.json({error: "Unauthorized"});
    const urls = fs.readFileSync(CORS_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    res.json({ allowAllCors: ALLOW_ALL_CORS, urls, hostEnv: HOST_ENV });
});
app.post('/api/system/cors_toggle', (req, res) => {
    if(!req.session.isAdmin) return res.json({error: "Unauthorized"});
    ALLOW_ALL_CORS = req.body.status;
    res.json({success: true});
});
app.post('/api/system/cors_add', (req, res) => {
    if(!req.session.isAdmin) return res.json({error: "Unauthorized"});
    const urls = fs.readFileSync(CORS_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    if(!urls.includes(req.body.url)) { urls.push(req.body.url); fs.writeFileSync(CORS_FILE, urls.join('\n'), 'utf8'); }
    res.json({success: true});
});
app.post('/api/system/cors_remove', (req, res) => {
    if(!req.session.isAdmin) return res.json({error: "Unauthorized"});
    let urls = fs.readFileSync(CORS_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    urls = urls.filter(u => u !== req.body.url);
    fs.writeFileSync(CORS_FILE, urls.join('\n'), 'utf8');
    res.json({success: true});
});
app.get('/api/system/api_logs_fetch', (req, res) => {
    if(!req.session.isAdmin) return res.json({error: "Unauthorized"});
    res.json({ logs: backendApiLogs });
});

app.get('/logs', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/login');

    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>System Logs</title>${uiHead}</head>
        <body class="min-h-screen pt-24 pb-8 px-4 flex flex-col items-center">
            ${getFloatingHeader('System Logs', true)}
            
            <div class="w-full max-w-7xl mt-4">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div class="card animate-box flex flex-col h-[50vh] overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-[var(--border)]">
                            <h3 class="font-semibold text-[var(--text-main)] text-sm"><i class="fa-solid fa-microchip mr-2 text-[var(--text-muted)]"></i> Application Output</h3>
                            <button onclick="copyContent('sys-logs')" class="text-xs bg-[var(--bg-color)] border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-main)] px-3 py-1.5 rounded-md transition font-medium">Copy Text</button>
                        </div>
                        <div class="text-[12px] flex-1 overflow-y-auto p-4 space-y-2 font-mono custom-scrollbar text-[var(--text-main)]" id="sys-logs"></div>
                    </div>
                    
                    <div class="card animate-box flex flex-col h-[50vh] overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-[var(--border)]">
                            <h3 class="font-semibold text-[var(--text-main)] text-sm"><i class="fa-solid fa-network-wired mr-2 text-[var(--text-muted)]"></i> Network Events</h3>
                            <button onclick="copyContent('net-logs')" class="text-xs bg-[var(--bg-color)] border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-main)] px-3 py-1.5 rounded-md transition font-medium">Copy Text</button>
                        </div>
                        <div class="text-[11px] flex-1 overflow-y-auto p-4 opacity-80 break-all space-y-2 font-mono custom-scrollbar text-[var(--text-main)]" id="net-logs"></div>
                    </div>
                </div>

                <div class="card animate-box p-6">
                     <h3 class="font-semibold text-[var(--text-main)] text-sm mb-4 border-b border-[var(--border)] pb-3"><i class="fa-solid fa-camera mr-2 text-[var(--text-muted)]"></i> Execution Snapshots</h3>
                     <div id="matrix-grid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"></div>
                </div>
            </div>
            
            <div id="img-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] hidden flex-col items-center justify-center p-4">
                <button onclick="document.getElementById('img-modal').classList.add('hidden')" class="absolute top-6 right-6 bg-white/10 w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/20 transition"><i class="fa-solid fa-xmark"></i></button>
                <img id="modal-img-src" src="" class="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                socket.on('init_logs', function(data) {
                    document.getElementById('sys-logs').innerHTML = data.sys.join('');
                    document.getElementById('net-logs').innerHTML = data.net.join('');
                    renderMatrix(data.matrix);
                });
                socket.on('cron_log', function(data) {
                    const el = document.getElementById(data.type === 'net' ? 'net-logs' : 'sys-logs');
                    el.innerHTML += data.html; el.scrollTop = el.scrollHeight;
                });
                socket.on('step_matrix_update', function(matrix) { renderMatrix(matrix); });

                function renderMatrix(matrix) {
                    const grid = document.getElementById('matrix-grid');
                    grid.innerHTML = '';
                    for(let uid in matrix) {
                        matrix[uid].forEach(snap => {
                            let isErr = snap.isError ? 'border-red-400 bg-red-50/5' : 'border-[var(--border)] bg-[var(--bg-color)] hover:border-[var(--primary)]';
                            let titleCol = snap.isError ? 'text-red-500' : 'text-[var(--text-muted)]';
                            grid.innerHTML += \`<div class="rounded-xl p-3 border \${isErr} cursor-pointer transition-all duration-200 hover:shadow-md" onclick="showImg('data:image/jpeg;base64,\${snap.img}')">
                                <div class="text-[11px] font-semibold truncate mb-1 text-[var(--text-main)]">\${uid}</div>
                                <div class="text-[9px] \${titleCol} truncate mb-2 font-mono">\${snap.step} | \${snap.time}</div>
                                <div class="relative overflow-hidden rounded-lg border border-[var(--border)]">
                                    <img src="data:image/jpeg;base64,\${snap.img}" class="w-full aspect-[9/16] object-cover" />
                                </div>
                            </div>\`;
                        });
                    }
                }
                function showImg(src) {
                    document.getElementById('modal-img-src').src = src;
                    document.getElementById('img-modal').classList.remove('hidden');
                    document.getElementById('img-modal').classList.add('flex');
                }
                function copyContent(id) {
                    navigator.clipboard.writeText(document.getElementById(id).innerText);
                    showSysModal({title: "Copied", msg: "Data copied to clipboard."});
                }
            </script>
        </body></html>
    `);
});

// ==========================================
// SOCKET.IO & TIMING LOGIC
// ==========================================
io.on('connection', (socket) => {
    socket.emit('init_logs', { sys: systemLogs, net: networkLogs, matrix: licenseStepScreenshots });
    socket.on('start_watch', (data) => { if(data.token) global.watchingUID = data.uid; });
    socket.on('stop_watch', () => { global.watchingUID = null; });
});

setInterval(() => {
    const uiData = {};
    const now = Date.now();
    for (const uid in activeTimers) {
        const timerObj = activeTimers[uid];
        
        let remainingStr = '';
        let isRunning = engineStatus[uid] || false;
        let diff = timerObj.nextRun - now;
        if(diff < 0) diff = 0;
        
        let totalMs = timerObj.intervalMins * 60000;
        if(totalMs <= 0) totalMs = 1;
        let percent = Math.max(0, Math.min(100, ((totalMs - diff) / totalMs) * 100));

        if(timerObj.isSub) {
            if (isRunning) remainingStr = '<span class="text-[var(--primary)] font-medium flex items-center text-xs"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Processing</span>';
            else {
                if(diff > 0) remainingStr = '<span class="text-[var(--text-muted)] font-medium text-xs"><i class="fa-regular fa-clock mr-1"></i> ' + Math.floor(diff/60000) + 'm ' + Math.floor((diff%60000)/1000) + 's</span>';
                else remainingStr = '<span class="text-orange-500 font-medium text-xs">Initializing...</span>';
            }
        } else {
            if(!timerObj.autoActivate) remainingStr = '<span class="text-red-500 font-medium text-xs">Suspended</span>';
            else if (isRunning) remainingStr = '<span class="text-[var(--primary)] font-medium flex items-center text-xs"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Processing</span>';
            else if (diff > 0) remainingStr = '<span class="text-[var(--text-muted)] font-medium text-xs"><i class="fa-regular fa-clock mr-1"></i> ' + Math.floor(diff/60000) + 'm ' + Math.floor((diff%60000)/1000) + 's</span>';
            else remainingStr = '<span class="text-orange-500 font-medium text-xs">Initializing...</span>';
        }
        
        uiData[uid] = { name: timerObj.name, remaining: remainingStr, isRunning, autoActivate: timerObj.autoActivate !== false, percent: percent };
    }
    io.emit('update_ui', uiData);
}, 1000);

function appendLog(html, type = 'sys') {
    const fullLog = `<div class="pb-2 mb-2 border-b border-[var(--border)]"><span class="text-[var(--text-muted)] text-[10px] bg-[var(--bg-color)] px-1.5 py-0.5 rounded mr-2 border border-[var(--border)]">${getPKTTime()}</span> <span class="text-sm">${html}</span></div>`;
    if (type === 'net') { networkLogs.push(fullLog); if(networkLogs.length > 500) networkLogs.shift(); } 
    else { systemLogs.push(fullLog); if(systemLogs.length > 300) systemLogs.shift(); }
    io.emit('cron_log', { html: fullLog, type });
}

app.get('/api/avatar', async (req, res) => {
    try { const { data } = await supabase.from('settings').select('value').eq('key', 'admin_avatar').single(); res.json({ url: data ? data.value : null }); } 
    catch(e) { res.json({ url: null }); }
});

app.post('/api/avatar', async (req, res) => {
    if(!req.session.isAdmin) return res.status(403).json({});
    try { await supabase.from('settings').upsert({ key: 'admin_avatar', value: req.body.image }); res.json({ success: true }); } 
    catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/target/add', async (req, res) => {
    if(!req.session.isAdmin) return res.status(403).json({});
    const { name, uid, interval } = req.body;
    await supabase.from('targets').insert([{ name, uid, interval_mins: interval || 40 }]);
    startUIDCycle(uid, name, interval || 40, true, true, false);
    res.json({ success: true });
});

app.post('/api/target/del', async (req, res) => {
    if(!req.session.isAdmin) return res.status(403).json({});
    const { uid } = req.body;
    await supabase.from('targets').delete().eq('uid', uid);
    if (activeTimers[uid]) { clearTimeout(activeTimers[uid].timer); delete activeTimers[uid]; engineStatus[uid] = false; }
    res.json({ success: true });
});

app.post('/api/target/toggle', async (req, res) => {
    if(!req.session.isAdmin) return res.status(403).json({});
    const { uid, status } = req.body;
    await supabase.from('targets').update({ auto_activate: status }).eq('uid', uid);
    if(activeTimers[uid]) {
        activeTimers[uid].autoActivate = status;
        if(!status) clearTimeout(activeTimers[uid].timer); else scheduleNextRun(uid);
    }
    res.json({ success: true });
});

function scheduleNextRun(uid) {
    if(!activeTimers[uid] || !activeTimers[uid].autoActivate) return;
    const intervalMs = activeTimers[uid].intervalMins * 60 * 1000;
    activeTimers[uid].nextRun = Date.now() + intervalMs;
    clearTimeout(activeTimers[uid].timer); 
    activeTimers[uid].timer = setTimeout(() => executeEngineWithRetry(uid), intervalMs);
}

// ----------------------------------------------------
// CRASH & RETRY WRAPPER
// ----------------------------------------------------
async function executeEngineWithRetry(uid, forcedName = null) {
    const target = activeTimers[uid];
    if(target && target.isSub && !target.autoActivate) return;
    if(!target && !forcedName) return; 
    
    const name = forcedName || target.name;
    let maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
        attempt++;
        try {
            if(attempt > 1) appendLog(`<span style="color: #f59e0b; font-weight: 500;">Restarting task (Attempt ${attempt}/${maxRetries})...</span>`);
            await runGhostActivator(uid, name);
            success = true; 
        } catch (error) {
            if (attempt < maxRetries) {
                appendLog(`<span style="color: #ef4444; font-weight: 500;">Execution failed. Retrying in 5 seconds...</span>`);
                await new Promise(r => setTimeout(r, 5000));
            } else {
                appendLog(`<span style="color: #ef4444; font-weight: 600;">Task completely failed after multiple attempts.</span>`);
            }
        }
    }

    if(target && !target.isSub && target.autoActivate) {
        appendLog(`<span style="color: var(--text-muted); font-size: 0.875rem;">Next execution scheduled in ${target.intervalMins} minutes.</span>`);
        scheduleNextRun(uid);
    } else if(target && target.isSub) {
        appendLog(`<span style="color: var(--text-muted); font-size: 0.875rem;">Subscription resume scheduled in ${target.intervalMins} minutes.</span>`);
        scheduleNextRun(uid);
    }
}

function startUIDCycle(uid, name, intervalMins, autoActivate, runImmediate = false, isFree = false) {
    if (activeTimers[uid]) clearTimeout(activeTimers[uid].timer);
    activeTimers[uid] = { name, intervalMins, autoActivate, totalTime: 0, nextRun: Date.now(), timer: null, isSub: false, isFree: isFree, tgMsgId: null };

    if(isFree) {
        activeTimers[uid].freeExpiry = Date.now() + (3 * 60 * 60 * 1000); 
        setTimeout(() => {
            if(activeTimers[uid]) {
                clearTimeout(activeTimers[uid].timer);
                delete activeTimers[uid];
                engineStatus[uid] = false;
                console.log(`[Free Quota] UID ${uid} auto-removed after 3 hours.`);
            }
        }, 3 * 60 * 60 * 1000);
    }

    if(!autoActivate) return;
    if(runImmediate) {
        if(!executionQueue.includes(uid)) executionQueue.push(uid);
        processQueue();
    } else scheduleNextRun(uid);
}

setTimeout(async () => {
    try {
        const { data: users } = await supabase.from('targets').select('*');
        if (users && users.length > 0) {
            appendLog('<span style="color: var(--primary); font-weight: 500;">Restoring database state and tasks...</span>');
            users.forEach((u, index) => {
                setTimeout(() => startUIDCycle(u.uid, u.name, u.interval_mins, u.auto_activate, u.auto_activate, false), index * 10000);
            });
        }

        const { data: licenses } = await supabase.from('licenses').select('*');
        if (licenses) {
            licenses.forEach(l => {
                if(new Date(l.expires_at).getTime() > Date.now() && l.uids && l.uids.length > 0) {
                    startPremiumCycle(l.license_key, l.uids, l.plan_type, l.expires_at, true);
                }
            });
        }
    } catch(e) {}
}, 4000);

// ==========================================
// CHROMIUM ENGINE (PUPPETEER)
// ==========================================
async function runGhostActivator(uid, name) {
    if(engineStatus[uid]) throw new Error("Task already running for this UID");
    let browser;
    engineStatus[uid] = true;
    
    // Setup GIF Recording State
    recordingStatus[uid] = false;
    recordingFrames[uid] = [];
    
    const actionLogFile = `actions_${uid}.txt`;
    const netLogFile = `network_${uid}.txt`;
    const dumpLogFile = `dump_${uid}.txt`; 
    
    fs.writeFileSync(actionLogFile, `=== ACTION LOGS FOR ${uid} ===\n`);
    fs.writeFileSync(netLogFile, `=== NETWORK LOGS FOR ${uid} ===\n`);
    fs.writeFileSync(dumpLogFile, `=== DEEP DUMP FOR ${uid} (PAYLOADS & COOKIES) ===\n\n`);

    const sysLog = (msg) => {
        appendLog(`<strong>[${uid}]</strong> ${msg}`); 
        fs.appendFileSync(actionLogFile, `[${getPKTTime()}] ${msg.replace(/<[^>]*>?/gm, '')}\n`);
    };
    const netLog = (msg) => {
        appendLog(`<span style="color: #64748b;">[NET]</span> ${msg}`, 'net');
        fs.appendFileSync(netLogFile, `[${getPKTTime()}] ${msg.replace(/<[^>]*>?/gm, '')}\n`);
    };

    try {
        sysLog('<span style="color: var(--primary); font-weight: 500;">Starting processing sequence...</span>'); 
        
        try {
            await sendTgRequest("sendSticker", { chat_id: TG_CHAT_ID, sticker: TG_LIVE_STICKER_ID });
            await sendTelegramText(`🚀 *[ ${uid} ] ACTION INITIATED*\n\n[▓▓▓▓░░░░░░] 40%\n\n⏱️ PKT Time: ${getPKTTime()}`);
        } catch(e) {}

        let execPath = undefined;
        if (IS_TERMUX) {
            execPath = '/data/data/com.termux/files/usr/bin/chromium-browser';
        } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        browser = await puppeteer.launch({
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--window-size=360,640',
                '--single-process',
                '--no-zygote',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-features=dbus'
            ],
            headless: 'new',
            executablePath: execPath 
        });

        const page = (await browser.pages())[0] || await browser.newPage();
        await page.setViewport({ width: 360, height: 640, isMobile: true, hasTouch: true });

        let lastStreamFrame = null;
        const cdpClient = await page.target().createCDPSession();
        await cdpClient.send('Page.startScreencast', { format: 'jpeg', quality: 50, everyNthFrame: 1 });
        
        cdpClient.on('Page.screencastFrame', async (evt) => {
            lastStreamFrame = evt.data;
            if(global.watchingUID === uid) {
                io.emit('live_frame', { uid, frame: evt.data, timestamp: Date.now() });
            }
            if(recordingStatus[uid]) {
                recordingFrames[uid].push(evt.data);
            }
            await cdpClient.send('Page.screencastFrameAck', { sessionId: evt.sessionId }).catch(()=>{});
        });

        const saveMatrixScreen = async (stepName, isError = false) => {
            if(!lastStreamFrame) return; 
            if(!licenseStepScreenshots[uid]) licenseStepScreenshots[uid] = [];
            licenseStepScreenshots[uid].push({ step: stepName, img: lastStreamFrame, time: getPKTTime(), isError });
            if(licenseStepScreenshots[uid].length > 8) licenseStepScreenshots[uid].shift(); 
            io.emit('step_matrix_update', licenseStepScreenshots);
        };

        await page.evaluateOnNewDocument(() => { window.open = function() { return null; }; });

        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                try {
                    const newPage = await target.page();
                    if (newPage && newPage.url() !== 'about:blank') {
                        setTimeout(() => newPage.close().catch(() => {}), 500);
                        sysLog('<span style="color: #ef4444;">Popup intercepted and closed.</span>');
                    }
                } catch(e) {}
            }
        });
        
        await page.setRequestInterception(true);
        page.on('request', req => {
            const rType = req.resourceType();
            const urlStr = req.url().toLowerCase();
            const method = req.method();
            const postData = req.postData();

            try {
                if (['POST', 'PUT', 'PATCH'].includes(method) || postData) {
                    fs.appendFileSync(dumpLogFile, `[PAYLOAD OUT] ${method} ${urlStr}\nHeaders: ${JSON.stringify(req.headers())}\nPayload: ${postData}\n\n`);
                }
            } catch(e) {}

            if (rType === 'media') return req.abort(); 
            if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
                if (!urlStr.includes('unlockffbeta.com') && !urlStr.includes('google.com')) {
                    netLog(`<span style="color: #ef4444;">Navigation Blocked: ${urlStr.substring(0, 40)}...</span>`);
                    return req.abort('aborted'); 
                }
            }
            req.continue(); 
        });

        page.on('response', async (res) => {
            const rType = res.request().resourceType();
            const urlStr = res.url();
            const status = res.status();

            try {
                if (status >= 400 || urlStr.includes('api')) {
                    fs.appendFileSync(dumpLogFile, `[RESPONSE IN] ${status} ${urlStr}\n\n`);
                }
            } catch(e) {}

            if(rType === 'xhr' || rType === 'fetch' || rType === 'document') {
                if(!['google-analytics', 'doubleclick', 'facebook', 'bing'].some(j => urlStr.includes(j))) {
                    let statusColor = status >= 400 ? 'color: #ef4444;' : (status >= 300 ? 'color: #f59e0b;' : 'color: var(--primary);');
                    netLog(`<div style="background: var(--bg-color); padding: 4px 8px; border-radius: 6px; margin-bottom: 4px; font-size: 11px;"><span style="font-weight: 600; ${statusColor} margin-right: 8px;">[${status}]</span> <span style="opacity: 0.8;">${urlStr.substring(0,60)}...</span></div>`);
                }
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        page.on('dialog', async dialog => { await dialog.dismiss(); }); 

        await page.goto('https://unlockffbeta.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        sysLog('<span style="color: var(--primary);">Connected to target page.</span>');
        await saveMatrixScreen("INIT_DOM_LOAD");
        
        // ==========================================
        // SMART CLOUDFLARE BYPASS LOGIC
        // ==========================================
        sysLog('<span style="color: #f59e0b; font-weight: 500;">Checking security protocols...</span>');
        for(let c = 0; c < 20; c++) {
            const pageTitle = await page.title();
            const text = await page.evaluate(() => document.body.innerText || '');
            
            // Check if passed CF
            if (!text.toLowerCase().includes('security verification') && !pageTitle.toLowerCase().includes('just a moment')) {
                break;
            }
            
            sysLog(`<span style="color: #f59e0b;">Evaluating challenge [${c+1}/20]...</span>`);
            try {
                // Method 1: Target Turnstile widget in iframes
                let clicked = false;
                const frames = page.frames();
                for (const frame of frames) {
                    if (frame.url().includes('cloudflare') || frame.url().includes('turnstile')) {
                        const widget = await frame.$('.cb-tc, input[type="checkbox"], #challenge-stage');
                        if (widget) {
                            await widget.hover();
                            await page.mouse.down();
                            await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
                            await page.mouse.up();
                            sysLog('<span style="color: #10b981;">Challenge widget interacted successfully.</span>');
                            clicked = true;
                            break;
                        }
                    }
                }
                
                // Method 2: Offset click if element not found in frame directly
                if(!clicked) {
                    const cfIframe = await page.$('iframe[src*="cloudflare"], iframe[src*="turnstile"]');
                    if(cfIframe) {
                        const box = await cfIframe.boundingBox();
                        if(box) {
                            // Smart offset calculation for the checkbox position
                            const x = box.x + 30 + Math.random() * 20; 
                            const y = box.y + box.height / 2;
                            await page.mouse.move(x, y, {steps: 10});
                            await page.mouse.click(x, y, { delay: 100 });
                        }
                    }
                }
            } catch(e) {}
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
        }

        let safetyCounter = 0;
        let uidInjected = false;
        
        while (safetyCounter < 45) { 
            safetyCounter++;
            await saveMatrixScreen(`LOOP_STEP_${safetyCounter}`); 
            
            const allPages = await browser.pages();
            if (allPages.length > 1) {
                for (let i = 0; i < allPages.length; i++) {
                    if (allPages[i] !== page) await allPages[i].close().catch(() => {});
                }
                await page.bringToFront();
            }

            const popupDestroyed = await page.evaluate(() => {
                let killed = false;
                document.querySelectorAll('div, iframe, section').forEach(el => {
                    const text = el.innerText ? el.innerText.toLowerCase() : '';
                    const z = window.getComputedStyle(el).zIndex;
                    if(text.includes('bonus available') || text.includes('congratulations') || (parseInt(z) > 999 && (el.id.includes('ad') || el.className.includes('ad')))) {
                        el.remove();
                        killed = true;
                    }
                });
                return killed;
            });
            if(popupDestroyed) { sysLog('<span style="color: #f59e0b;">Overlay removed.</span>'); }

            await page.evaluate(() => {
                const reloadBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(b => b.innerText && b.innerText.toLowerCase().includes('i fixed it'));
                if(reloadBtn) reloadBtn.click();
            });

            const isInitializing = await page.evaluate(() => {
                const text = document.body.innerText ? document.body.innerText.toLowerCase() : "";
                return (text.includes('please wait') || text.includes('initializing...')) && !text.includes('access granted');
            });

            if (isInitializing) {
                sysLog('<span style="color: #f59e0b;">Initialization in progress... [▓▓▓▓▓▓▓░░░] 70%</span>');
                await saveMatrixScreen("WAITING_INITIALIZATION");
                await new Promise(r => setTimeout(r, 2000));
                continue; 
            }

            const resultData = await page.evaluate(() => {
                const result = { success: false, timeStr: "1h 0m 0s", h: 0, m: 0, s: 0 };
                const text = document.body.innerText ? document.body.innerText.toLowerCase() : "";
                
                if (text.includes('step ') && text.includes(' of ')) return result;
                
                if (text.includes('access granted') || text.includes('successfully') || text.includes('expires in')) {
                    result.success = true;
                    
                    const hMatch = text.match(/(\d+)\s*h/i);
                    const mMatch = text.match(/(\d+)\s*m/i);
                    const sMatch = text.match(/(\d+)\s*s/i);

                    if(hMatch) result.h = parseInt(hMatch[1]);
                    if(mMatch) result.m = parseInt(mMatch[1]);
                    if(sMatch) result.s = parseInt(sMatch[1]);

                    if(result.h === 0 && result.m === 0 && result.s === 0) {
                        const fallback = text.match(/(\d+)\s*min/i);
                        if(fallback) result.m = parseInt(fallback[1]);
                        else result.m = 60; 
                    }
                    
                    result.timeStr = `${result.h}h ${result.m}m ${result.s}s`;
                }
                return result;
            });

            if (resultData.success) {
                sysLog('<span style="color: #10b981; font-weight: 600;">Operation successful. Process completed! [██████████] 100%</span>');
                await saveMatrixScreen("SUCCESS_VERIFIED");

                let extractedMs = (resultData.h * 60 * 60 * 1000) + (resultData.m * 60 * 1000) + (resultData.s * 1000);
                if (extractedMs < 60000) extractedMs = 60 * 60 * 1000; 

                let safeIntervalMs = extractedMs - (5 * 60 * 1000);
                if(safeIntervalMs < 60000) safeIntervalMs = 60000; 

                if (activeTimers[uid]) {
                    if(!activeTimers[uid].totalTime) activeTimers[uid].totalTime = 0;
                    activeTimers[uid].totalTime += extractedMs;
                    activeTimers[uid].intervalMins = Math.floor(safeIntervalMs / 60000);
                    sysLog(`Session valid for: ${resultData.timeStr}. Next schedule in: ${activeTimers[uid].intervalMins}m.`);
                }

                // =====================================
                // 15-SECOND GIF/VIDEO RECORDING LOGIC
                // =====================================
                try {
                    sysLog('Starting telemetry recording (15s)...');
                    recordingStatus[uid] = true;
                    
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    
                    recordingStatus[uid] = false;
                    sysLog('Recording completed. Compiling data...');

                    const recDir = path.join(__dirname, `rec_tmp_${uid}_${Date.now()}`);
                    if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

                    let frameCount = 0;
                    recordingFrames[uid].forEach((base64Str, i) => {
                        const filePath = path.join(recDir, `frame_${i.toString().padStart(4, '0')}.jpg`);
                        fs.writeFileSync(filePath, base64Str, 'base64');
                        frameCount++;
                    });

                    let caption = `✅ *Session Active*\n\n👤 Name: ${name}\n🆔 UID: \`${uid}\`\n⏱️ Duration: ${resultData.timeStr}`;

                    if(frameCount > 0) {
                        try {
                            const outVid = path.join(recDir, 'output.mp4');
                            execSync(`ffmpeg -y -framerate 4 -i ${recDir}/frame_%04d.jpg -c:v libx264 -pix_fmt yuv420p ${outVid} > /dev/null 2>&1`);
                            
                            sysLog('Uploading confirmation to Telegram...');
                            await sendTgRequest("sendAnimation", { chat_id: TG_CHAT_ID, caption: caption, parse_mode: "Markdown" }, { fieldName: 'animation', buffer: fs.readFileSync(outVid), filename: 'proof.mp4' });
                        } catch(err) {
                            sysLog('<span style="color: #f59e0b;">Video compilation failed. Sending still image.</span>');
                            await sendTelegramScreenshot(lastStreamFrame, uid, name, false, caption);
                        }
                    } else {
                        await sendTelegramScreenshot(lastStreamFrame, uid, name, false, caption);
                    }

                    try { fs.rmSync(recDir, { recursive: true, force: true }); } catch(e){}
                    recordingFrames[uid] = [];

                    let liveInitMsg = `⏳ *Tracker Initiated*\nUID: \`${uid}\``;
                    let tgRes = await sendTgRequest("sendMessage", { chat_id: TG_CHAT_ID, text: liveInitMsg, parse_mode: "Markdown" });
                    
                    if (tgRes && tgRes.result && tgRes.result.message_id) {
                        if (activeTimers[uid]) activeTimers[uid].tgMsgId = tgRes.result.message_id;
                    }
                } catch(e) {
                    console.log("Telemetry Error:", e.message);
                }
                
                return true; 
            }

            if (!uidInjected) {
                const injected = await page.evaluate((val) => {
                    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])'));
                    if (inputs.length > 0 && inputs[0].value !== val) {
                        inputs[0].focus(); inputs[0].value = val;
                        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                    return false;
                }, uid);
                if (injected) { 
                    uidInjected = true; 
                    sysLog('<span style="color: var(--primary);">UID entered successfully. [▓▓▓▓▓░░░░░] 50%</span>');
                    await saveMatrixScreen("UID_TYPED");
                    await new Promise(r => setTimeout(r, 1000)); 
                }
            }

            const clicked = await page.evaluate(() => {
                const closeWords = ['close', 'x', 'skip ad', 'no thanks'];
                const targets = ['continue without discord', 'continue (an ad will open)', 'continue', 'proceed', 'next', 'submit'];
                const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));

                for (let btn of buttons) {
                    if (!btn || typeof btn.innerText !== 'string') continue;
                    const text = btn.innerText.toLowerCase().trim();
                    if (btn.offsetHeight > 0 && window.getComputedStyle(btn).display !== 'none') {
                        if (closeWords.includes(text) || (text === 'x' && btn.clientWidth < 50)) {
                            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                            if (typeof btn.click === 'function') btn.click();
                            return "Closed Ad (" + text + ")";
                        }
                    }
                }
                for (let btn of buttons) {
                    if (!btn || typeof btn.innerText !== 'string') continue;
                    const text = btn.innerText.toLowerCase().trim();
                    if (btn.offsetHeight > 0 && window.getComputedStyle(btn).display !== 'none') {
                        if (targets.some(t => text === t || text.includes(t))) {
                            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                            if (typeof btn.click === 'function') btn.click();
                            return text;
                        }
                    }
                }
                return null;
            });

            if (clicked) {
                sysLog(`Action registered: "${clicked}"`);
                await saveMatrixScreen("ACTION_CLICKED");
                await new Promise(r => setTimeout(r, 2000));
            } else {
                await new Promise(r => setTimeout(r, 1000)); 
            }
            
            const isBlocked = await page.evaluate(() => {
                const text = document.body.innerText ? document.body.innerText.toLowerCase() : "";
                return text.includes('invalid id');
            });
            if(isBlocked) {
                await saveMatrixScreen("ERROR_INVALID_ID", true);
                throw new Error("Target blocked the request (Invalid ID).");
            }
        }
        await saveMatrixScreen("ERROR_TIMEOUT", true);
        throw new Error("Process timed out.");
    } catch (error) {
        sysLog(`<span style="color: #ef4444; font-weight: 500;">Process Error: ${error.message}</span>`);
        try {
            await sendTelegramScreenshot(lastStreamFrame, uid, name, true); 
        } catch(e){}
        throw error;
    } finally {
        try {
            if(page && !page.isClosed()) {
                const cookies = await page.cookies();
                const ls = await page.evaluate(() => JSON.stringify(window.localStorage));
                fs.appendFileSync(dumpLogFile, `\n=== FINAL BROWSER COOKIES ===\n${JSON.stringify(cookies, null, 2)}\n`);
                fs.appendFileSync(dumpLogFile, `\n=== LOCAL STORAGE DATA ===\n${ls}\n`);
            }
        } catch(e) {}

        if (browser) await browser.close();
        engineStatus[uid] = false; 
        sysLog('<span style="color: var(--text-muted);">Process ended.</span>');
        
        try {
            if(fs.existsSync(actionLogFile)) {
                await sendTgRequest("sendDocument", { chat_id: TG_CHAT_ID, caption: `📜 *Action Logs* - ${uid}\n⏱️ PKT: ${getPKTTime()}`, parse_mode: "Markdown" }, { fieldName: 'document', buffer: fs.readFileSync(actionLogFile), filename: actionLogFile });
                fs.unlinkSync(actionLogFile);
            }
            if(fs.existsSync(netLogFile)) {
                await sendTgRequest("sendDocument", { chat_id: TG_CHAT_ID, caption: `🌐 *Network Logs* - ${uid}\n⏱️ PKT: ${getPKTTime()}`, parse_mode: "Markdown" }, { fieldName: 'document', buffer: fs.readFileSync(netLogFile), filename: netLogFile });
                fs.unlinkSync(netLogFile); 
            }
            if(fs.existsSync(dumpLogFile)) {
                await sendTgRequest("sendDocument", { chat_id: TG_CHAT_ID, caption: `🗄️ *Deep Payload & Cookies Dump* - ${uid}\n⏱️ PKT: ${getPKTTime()}`, parse_mode: "Markdown" }, { fieldName: 'document', buffer: fs.readFileSync(dumpLogFile), filename: dumpLogFile });
                fs.unlinkSync(dumpLogFile); 
            }
        } catch(e) { console.log(e); }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n=========================================');
    console.log(`⚡ SERVER INITIALIZED`);
    console.log(`📡 ENVIRONMENT: ${HOST_ENV}`);
    console.log(`👉 Front: http://localhost:${PORT}/`);
    console.log('=========================================\n');
});
