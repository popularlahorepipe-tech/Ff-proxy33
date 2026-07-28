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

process.on('uncaughtException', (err) => console.log(`[Shield] Uncaught Exception: ${err.message}`));
process.on('unhandledRejection', (reason, promise) => console.log(`[Shield] Unhandled Rejection Prevented.`));

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
    appendLog(`<span class="text-red-500 font-medium">⚠️ TG Communications Failed: ${lastErr}</span>`);
    return false;
}

async function sendTelegramScreenshot(base64Image, uid, name, isError = false, overrideCaption = null) {
    if(!base64Image) return;
    const buffer = Buffer.from(base64Image, 'base64');
    let caption = overrideCaption || (isError ? `❌ Activation Error/Block!\n\n👤 Name: ${name}\n🆔 UID: ${uid}\n⏱️ Time (PKT): ${getPKTTime()}` : `✅ Target Activated!\n\n👤 Name: ${name}\n🆔 UID: ${uid}\n⏱️ Time (PKT): ${getPKTTime()}`);
    
    const res = await sendTgRequest("sendPhoto", { chat_id: TG_CHAT_ID, caption }, { fieldName: 'photo', buffer, filename: 'ss.jpg' });
    if(res) appendLog(`<span class="${isError ? 'text-red-500' : 'text-green-500'}">📲 Image delivered securely.</span>`);
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
                
                let isExecuting = engineStatus[uid] ? `🚀 *Status:* Executing Engine...` : `✨ *Status:* Waiting Next Cycle`;

                let text = `${liveClock} *ROMEO LIVE TRACKER* ${liveClock}\n\n👤 *Target:* ${t.name}\n🆔 *UID:* \`${uid}\`\n\n⏳ *Remaining Time:* ${m}m ${s}s\n📊 *Progress:* ${bar} ${percent.toFixed(1)}%\n\n${isExecuting}`;

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
        else return res.json({ success: false, msg: "Super User limit reached" });

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
                    msg: "Premium Plan Active. System will auto-renew before expiry."
                });
            } else if(t.isFree) {
                const timeLeft = t.freeExpiry - Date.now();
                if(timeLeft <= 0) return res.json({ active: false, msg: "Free limit reached." });
                return res.json({ 
                    active: true, plan: "Free User", time_left: timeLeft, 
                    msg: `Free User: 3 Ghante ke liye activate hui hai, automatic ${Math.floor(timeLeft/60000)} mins tak khud active rakhega.` 
                });
            } else {
                return res.json({ 
                    active: true, plan: "VIP Node", time_left: 999999999, 
                    msg: "Dashboard Node: Hamesha activate rahega. Jab time khatam hone wala hoga, us se pehle hi khud-ba-khud renew ho jayega." 
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
            if(!cookies_valid) return res.json({ success: false, msg: "Cookies/Headers verification failed." });
            
            if (path === '/step1') {
                const { data: freeUser } = await supabase.from('free_users_track').select('*').eq('uid', uid).single();
                if (freeUser) {
                    if (freeUser.activation_count >= 2) return res.json({ success: false, msg: "Free quota reached. Purchase Premium." });
                    await supabase.from('free_users_track').update({ activation_count: freeUser.activation_count + 1, last_activated: new Date().toISOString() }).eq('uid', uid);
                } else {
                    await supabase.from('free_users_track').insert([{ uid, activation_count: 1, last_activated: new Date().toISOString() }]);
                }

                if (currentRunningUid === uid || engineStatus[uid]) {
                    return res.json({ success: true, step: idx + 2, msg: "Engine already running for you." });
                }

                if(!activeTimers[uid]) {
                    startUIDCycle(uid, "Free Website User", 40, true, false, true);
                }
                
                if (currentRunningUid && currentRunningUid !== uid) {
                    if(!executionQueue.includes(uid)) executionQueue.push(uid);
                    const pos = executionQueue.indexOf(uid) + 1;
                    return res.json({ success: false, waiting: true, msg: `System Busy! Target currently active. You are #${pos} in queue. Please wait.` });
                }
                
                if(!executionQueue.includes(uid)) {
                    executionQueue.push(uid);
                    processQueue();
                }
            }

            return res.json({ success: true, step: idx + 2, msg: "Engine Sequence processing." });
        } catch(e) { res.status(500).json({ error: "Step Processor Failed" }) }
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
// PURE CYBERPUNK / HACKER TERMINAL UI
// ==========================================
const uiHead = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        
        :root { 
            --bg-color: #030303; 
            --text-color: #00ff41; 
            --glass-bg: rgba(0, 15, 0, 0.9); 
            --panel-glow: rgba(0, 255, 65, 0.15); 
            --input-bg: rgba(0, 255, 65, 0.05); 
            --input-border: rgba(0, 255, 65, 0.4); 
            --primary: #00ff41; 
            --secondary: #008f11; 
            --accent: #00ff41; 
        }
        body.light-mode { /* Alt Red Hacker Theme */
            --bg-color: #050000; 
            --text-color: #ff003c; 
            --glass-bg: rgba(15, 0, 0, 0.9); 
            --panel-glow: rgba(255, 0, 60, 0.15); 
            --input-bg: rgba(255, 0, 60, 0.05); 
            --input-border: rgba(255, 0, 60, 0.4); 
            --primary: #ff003c;
            --secondary: #8f0011;
            --accent: #ff003c;
        }
        body { 
            background-color: var(--bg-color);
            background-image: linear-gradient(rgba(0, 255, 65, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.03) 1px, transparent 1px);
            background-size: 30px 30px;
            color: var(--text-color); 
            font-family: 'Share Tech Mono', monospace; 
            overflow-x: hidden; 
            transition: all 0.3s ease; 
        }
        
        /* Scanline Overlay */
        body::before {
            content: " "; display: block; position: fixed; top: 0; left: 0; bottom: 0; right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 999; background-size: 100% 2px, 3px 100%; pointer-events: none; opacity: 0.7;
        }

        .glass-panel { 
            background: var(--glass-bg); 
            border: 1px solid var(--input-border); 
            box-shadow: 0 0 15px var(--panel-glow); 
            border-radius: 2px; 
            transition: all 0.3s ease; 
            position: relative;
        }
        .glass-panel:hover {
            box-shadow: 0 0 25px var(--primary); 
            border-color: var(--primary);
        }
        
        .text-gradient { 
            color: var(--primary);
            text-shadow: 0 0 8px var(--primary);
        }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-color); }
        ::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 0; }
        
        input, select { 
            background: var(--input-bg); 
            border: 1px solid var(--input-border); 
            color: var(--text-color); 
            transition: all 0.2s ease; 
            border-radius: 2px; 
        }
        input:focus, select:focus { 
            border-color: var(--primary); 
            outline: none; 
            background: rgba(0, 255, 65, 0.1);
            box-shadow: 0 0 10px var(--primary); 
        }
        
        .menu-open { transform: translateX(0) !important; opacity: 1 !important; pointer-events: auto !important; }
        
        .btn-hover { 
            background: transparent;
            border: 1px solid var(--primary);
            color: var(--primary);
            transition: all 0.2s ease; 
            border-radius: 2px; 
            position: relative; 
            overflow: hidden; 
            z-index: 1; 
            text-shadow: 0 0 5px var(--primary);
        }
        .btn-hover::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: var(--primary); transition: left 0.3s; z-index: -1; }
        .btn-hover:hover::before { left: 0; }
        .btn-hover:hover { color: #000; box-shadow: 0 0 20px var(--primary); }
        
        .progress-bar-container {
            width: 100%; background-color: rgba(0,255,65,0.1); border: 1px solid var(--input-border); height: 8px; margin-top: 8px;
        }
        .progress-bar-fill {
            height: 100%; background: var(--primary); transition: width 1s linear; box-shadow: 0 0 10px var(--primary);
        }
        
        .modal-sheet {
            background: var(--glass-bg);
            border: 1px solid var(--primary);
            border-radius: 2px;
            box-shadow: 0 0 30px var(--primary);
        }

        /* Hacker Glitch Text */
        .glitch-text {
            position: relative;
        }
        .glitch-text::before, .glitch-text::after {
            content: attr(data-text); position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.8;
        }
        .glitch-text::before { left: 2px; text-shadow: -2px 0 red; clip: rect(24px, 550px, 90px, 0); animation: glitch-anim 3s infinite linear alternate-reverse; }
        .glitch-text::after { left: -2px; text-shadow: -2px 0 blue; clip: rect(85px, 550px, 140px, 0); animation: glitch-anim 2.5s infinite linear alternate-reverse; }
        
        @keyframes glitch-anim {
            0% { clip: rect(10px, 9999px, 44px, 0); }
            20% { clip: rect(65px, 9999px, 98px, 0); }
            40% { clip: rect(23px, 9999px, 76px, 0); }
            60% { clip: rect(87px, 9999px, 12px, 0); }
            80% { clip: rect(45px, 9999px, 89px, 0); }
            100% { clip: rect(32px, 9999px, 54px, 0); }
        }
    </style>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            gsap.registerPlugin(ScrollTrigger);
            
            gsap.from(".animate-box", { 
                y: 20, opacity: 0, duration: 0.5, 
                stagger: 0.1, ease: "power2.out", clearProps: "all" 
            });
            
            if(localStorage.getItem('theme') === 'light') toggleTheme(true);
            const cachedAvatar = localStorage.getItem('avatar_cache');
            if(cachedAvatar && document.getElementById('admin-avatar')) document.getElementById('admin-avatar').src = cachedAvatar;
            loadAvatar();
        });

        function toggleTheme(forceLight = false) {
            const isLight = forceLight || !document.body.classList.contains('light-mode');
            if(isLight) {
                document.body.classList.add('light-mode');
                document.getElementById('theme-icon')?.classList.replace('fa-code', 'fa-bug');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.remove('light-mode');
                document.getElementById('theme-icon')?.classList.replace('fa-bug', 'fa-code');
                localStorage.setItem('theme', 'dark');
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
            document.getElementById('sys-modal-title').innerText = opts.title || 'SYSTEM.NOTIFY';
            document.getElementById('sys-modal-msg').innerHTML = opts.msg || '';
            
            const inp = document.getElementById('sys-modal-input');
            if(opts.type === 'prompt') { inp.classList.remove('hidden'); inp.value = opts.default || ''; inp.focus(); } 
            else { inp.classList.add('hidden'); }
            
            const btnContainer = document.getElementById('sys-modal-btns');
            btnContainer.innerHTML = '';
            
            if(opts.type === 'confirm') {
                btnContainer.innerHTML = \`<button class="px-6 py-2 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition" onclick="closeSysModal(false)">[ ABORT ]</button>
                                          <button class="px-6 py-2 border border-[var(--primary)] bg-[var(--primary)] text-black transition" onclick="closeSysModal(true)">[ EXECUTE ]</button>\`;
            } else if(opts.type === 'prompt') {
                btnContainer.innerHTML = \`<button class="px-6 py-2 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition" onclick="closeSysModal(null)">[ ABORT ]</button>
                                          <button class="px-6 py-2 border border-[var(--primary)] bg-[var(--primary)] text-black transition" onclick="closeSysModal(document.getElementById('sys-modal-input').value)">[ SAVE ]</button>\`;
            } else {
                btnContainer.innerHTML = \`<button class="px-8 py-2 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition w-full" onclick="closeSysModal('ok')">[ ACKNOWLEDGE ]</button>\`;
            }
            
            window.sysModalCallback = opts.cb || function(){};
            m.classList.remove('hidden');
            gsap.fromTo(m, {opacity: 0}, {opacity: 1, duration: 0.2});
            gsap.fromTo(b, {scale: 1.1, opacity: 0}, {scale: 1, opacity: 1, duration: 0.3});
        }
        function closeSysModal(val) {
            const m = document.getElementById('sys-modal');
            const b = document.getElementById('sys-modal-box');
            gsap.to(b, {scale: 0.9, opacity: 0, duration: 0.2});
            gsap.to(m, {opacity: 0, duration: 0.2, onComplete: () => {
                m.classList.add('hidden');
                if(window.sysModalCallback) window.sysModalCallback(val);
            }});
        }
    </script>
    
    <div id="sys-modal" class="fixed inset-0 bg-black/80 z-[300] hidden flex items-center justify-center">
        <div class="modal-sheet p-8 max-w-sm w-[90%] text-center" id="sys-modal-box">
            <h3 id="sys-modal-title" class="text-xl font-bold mb-2 text-gradient uppercase">>_</h3>
            <p id="sys-modal-msg" class="text-sm opacity-90 mb-6 leading-relaxed"></p>
            <input type="text" id="sys-modal-input" class="hidden w-full p-3 mb-6 text-center border focus:border-[var(--primary)] transition bg-black text-[var(--primary)]" autocomplete="off" />
            <div class="flex gap-3 justify-center" id="sys-modal-btns"></div>
        </div>
    </div>
`;

const getOrbs = () => ``; // Removed for pure terminal look

const getFloatingHeader = (title, isAdmin) => `
    <div class="fixed top-4 w-full flex justify-center z-[110] px-4 pointer-events-none">
        <div class="flex justify-between items-center w-full max-w-5xl gap-3 md:gap-4 pointer-events-auto">
            
            <button ${isAdmin ? `onclick="document.getElementById('avatar-upload').click()"` : ''} class="w-12 h-12 md:w-14 md:h-14 flex-shrink-0 glass-panel flex items-center justify-center relative group">
                <img id="admin-avatar" src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition">
                ${isAdmin ? `<div class="absolute inset-0 bg-black/80 hidden group-hover:flex items-center justify-center transition-all"><i class="fa-solid fa-terminal text-[var(--primary)]"></i></div>` : ''}
            </button>
            ${isAdmin ? `<input type="file" id="avatar-upload" class="hidden" accept="image/*" onchange="uploadAvatar(this)">` : ''}
            
            <div class="flex-1 max-w-md glass-panel h-12 md:h-14 flex items-center justify-center overflow-hidden px-6">
                <span class="font-bold text-sm md:text-lg tracking-widest text-[var(--primary)] uppercase truncate glitch-text" data-text="[ ${title} ]">[ ${title} ]</span>
            </div>

            <button onclick="document.getElementById('overlay-menu').classList.toggle('menu-open')" class="w-12 h-12 md:w-14 md:h-14 flex-shrink-0 glass-panel flex items-center justify-center hover:bg-[var(--primary)] hover:text-black text-[var(--primary)] transition cursor-pointer z-50">
                <i class="fa-solid fa-network-wired text-lg"></i>
            </button>
        </div>
    </div>
    
    <div id="overlay-menu" class="fixed top-0 right-0 h-full w-[280px] bg-black border-l border-[var(--primary)] z-[100] transform translate-x-full opacity-0 pointer-events-none transition-all duration-300 flex flex-col p-6 shadow-[0_0_30px_var(--primary)]">
        <div class="flex justify-between items-center mb-8 mt-20 border-b border-[var(--primary)] pb-2">
            <h4 class="font-bold text-xs uppercase tracking-widest text-[var(--primary)]">SYSTEM.NAV</h4>
            <button onclick="document.getElementById('overlay-menu').classList.remove('menu-open')" class="w-8 h-8 flex items-center justify-center text-sm text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black border border-transparent hover:border-[var(--primary)] transition">[X]</button>
        </div>
        
        <div class="flex flex-col gap-3 text-sm font-bold uppercase tracking-widest">
            <a href="/" class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition"><i class="fa-solid fa-satellite-dish w-5 text-center"></i> Main Grid</a>
            
            ${isAdmin ? `
            <a href="/admin" class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition"><i class="fa-solid fa-terminal w-5 text-center"></i> Root Access</a>
            <a href="/logs" class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition"><i class="fa-solid fa-file-code w-5 text-center"></i> System Dumps</a>
            <a href="/server_settings" class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition"><i class="fa-solid fa-shield-virus w-5 text-center"></i> Firewall CLI</a>
            <a href="/stats" class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition"><i class="fa-solid fa-microchip w-5 text-center"></i> Diagnostics</a>
            ` : `
            <a href="/login" class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition"><i class="fa-solid fa-key w-5 text-center"></i> Auth Required</a>
            `}
            
            <div class="p-3 border border-transparent hover:border-[var(--primary)] hover:bg-[var(--input-bg)] flex items-center gap-4 transition cursor-pointer mt-4" onclick="toggleTheme()">
                <i class="fa-solid fa-code w-5 text-center" id="theme-icon"></i> <span>Toggle Mode</span>
            </div>
            
            ${isAdmin ? `<a href="/logout" class="p-3 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black flex items-center gap-4 transition mt-4"><i class="fa-solid fa-power-off w-5 text-center"></i> Terminate Session</a>` : ''}
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
        <html lang="en"><head><title>Diagnostics</title>${uiHead}</head>
        <body class="min-h-screen pt-28 p-4 flex flex-col items-center">
            ${getFloatingHeader('DIAGNOSTICS', true)}
            <div class="w-full max-w-5xl mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 animate-box">
                <div class="glass-panel p-6 flex flex-col border-l-4 border-l-[var(--primary)]">
                    <h3 class="font-bold text-xs mb-2 opacity-70 uppercase tracking-widest">> CPU_CORE</h3>
                    <p id="cpu-stat" class="font-bold text-sm animate-pulse text-[var(--primary)]">AWAITING_DATA...</p>
                </div>
                <div class="glass-panel p-6 flex flex-col border-l-4 border-l-[var(--primary)]">
                    <h3 class="font-bold text-xs mb-2 opacity-70 uppercase tracking-widest">> RAM_ALLOC</h3>
                    <p id="ram-stat" class="font-bold text-sm animate-pulse text-[var(--primary)]">AWAITING_DATA...</p>
                </div>
                <div class="glass-panel p-6 flex flex-col border-l-4 border-l-[var(--primary)]">
                    <h3 class="font-bold text-xs mb-2 opacity-70 uppercase tracking-widest">> DISK_IO</h3>
                    <p id="storage-stat" class="font-bold text-sm animate-pulse text-[var(--primary)]">AWAITING_DATA...</p>
                </div>
                <div class="glass-panel p-6 flex flex-col border-l-4 border-l-[var(--primary)]">
                    <h3 class="font-bold text-xs mb-2 opacity-70 uppercase tracking-widest">> GPU_ENGINE</h3>
                    <p id="gpu-stat" class="font-bold text-sm animate-pulse text-[var(--primary)]">AWAITING_DATA...</p>
                </div>
                <div class="glass-panel p-6 flex flex-col md:col-span-2 border-l-4 border-l-[var(--primary)]">
                    <h3 class="font-bold text-xs mb-2 opacity-70 uppercase tracking-widest">> SYS_UPTIME</h3>
                    <p id="uptime-stat" class="font-bold text-sm animate-pulse text-[var(--primary)]">AWAITING_DATA...</p>
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
                    
                    document.querySelectorAll('.animate-pulse').forEach(el => el.classList.remove('animate-pulse'));
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
        <html lang="en"><head><title>Network Feed</title>${uiHead}</head>
        <body class="min-h-screen pt-28 p-4 flex flex-col items-center">
            ${getFloatingHeader('MAIN_GRID', isAdmin)}
            
            <div class="w-full max-w-5xl glass-panel animate-box p-6 md:p-8 mt-4">
                <div class="flex items-center mb-6 border-b border-[var(--input-border)] pb-4">
                    <i class="fa-solid fa-server mr-3 text-xl text-[var(--primary)]"></i>
                    <div>
                        <h3 class="font-bold text-lg tracking-widest uppercase">Live Nodes</h3>
                        <p class="text-xs opacity-60 uppercase tracking-widest mt-1">Real-time execution status</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead><tr class="opacity-70 text-xs uppercase tracking-widest border-b border-[var(--input-border)]"><th class="pb-3 pl-2 font-bold">Node_ID</th><th class="pb-3 font-bold">Progress</th><th class="pb-3 text-center font-bold">Trace</th></tr></thead>
                        <tbody id="status-body"><tr><td colspan="3" class="text-center py-12 opacity-50 text-sm font-bold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> CONNECTING TO CLUSTER...</td></tr></tbody>
                    </table>
                </div>
            </div>

            ${isAdmin ? `
            <div id="preview-modal" class="fixed inset-0 bg-black z-[200] hidden flex flex-col items-center justify-center opacity-0 transition-opacity duration-300">
                <div class="absolute top-0 left-0 w-full p-4 border-b border-[var(--primary)] flex justify-between items-center z-50 bg-black/80">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold tracking-widest text-red-500 animate-pulse">[ REC ]</span>
                        <span class="text-sm font-bold tracking-wide">STREAM: <span id="modal-uid" class="text-[var(--primary)] ml-1"></span></span>
                    </div>
                    <button onclick="closePreview()" class="px-4 py-1 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition text-xs font-bold">
                        [ DISCONNECT ]
                    </button>
                </div>
                <div class="relative w-full max-w-[360px] h-[640px] max-h-[85vh] overflow-hidden border-2 border-[var(--primary)] shadow-[0_0_30px_var(--primary)] bg-[#050505] flex items-center justify-center mt-12">
                    <div class="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.1)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none z-10"></div>
                    <img id="live-screen" src="" class="absolute inset-0 w-full h-full object-cover hidden transition-opacity duration-300 filter contrast-125" />
                    <div id="no-signal" class="opacity-50 flex flex-col items-center z-10 text-[var(--primary)]">
                        <i class="fa-solid fa-satellite-dish text-4xl mb-4 glitch-text" data-text="NO SIGNAL"></i>
                        <span class="tracking-widest text-xs font-bold uppercase">Awaiting Feed...</span>
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
                    if(keys.length === 0) return tbody.innerHTML = '<tr><td colspan="3" class="text-center py-12 opacity-50 font-bold uppercase">> No active nodes found.</td></tr>';
                    
                    let html = '';
                    for (let uid in data) {
                        let info = data[uid];
                        
                        let previewBtn = '<button class="border border-[var(--input-border)] text-[var(--input-border)] px-3 py-1 text-xs opacity-50 cursor-not-allowed">[ LOCKED ]</button>';
                        
                        if (isAdmin) {
                            previewBtn = info.isRunning 
                                ? \`<button onclick="openPreview('\${uid}')" class="border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition px-3 py-1 text-xs font-bold">[ VIEW ]</button>\`
                                : \`<button class="border border-[var(--input-border)] text-[var(--input-border)] px-3 py-1 text-xs opacity-50 cursor-not-allowed">[ IDLE ]</button>\`;
                        }

                        let statusBadge = !info.autoActivate ? '<span class="text-red-500 text-[10px] ml-3 font-bold border border-red-500 px-1 uppercase tracking-wide">HALTED</span>' : '';

                        let barHtml = \`<div class="progress-bar-container"><div class="progress-bar-fill" style="width: \${info.percent}%;"></div></div>\`;

                        html += '<tr class="border-b border-[var(--input-border)] hover:bg-[var(--input-bg)] transition-colors">' +
                            '<td class="py-4 pl-2">' + 
                                '<div class="font-bold text-sm flex items-center uppercase">' + info.name + statusBadge + '</div>' + 
                                '<div class="text-[10px] opacity-70 mt-1 font-mono tracking-widest">' + uid + '</div>' +
                            '</td>' +
                            '<td class="py-4 pr-6">' + 
                                '<div class="font-bold text-xs mb-1 uppercase">' + info.remaining + '</div>' + 
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
        <html lang="en"><head><title>ROOT_AUTH</title>${uiHead}</head>
        <body class="flex items-center justify-center min-h-screen relative">
            <div id="auth-panel" class="modal-sheet p-8 w-[90%] max-w-sm text-center z-10 transition-all duration-300 border-l-4 border-l-[var(--primary)]">
                <div class="mb-4">
                    <i class="fa-solid fa-terminal text-4xl text-[var(--primary)] glitch-text" data-text="Terminal"></i>
                </div>
                <h2 class="text-lg font-bold mb-6 tracking-widest uppercase text-[var(--primary)]">>_ ROOT_ACCESS</h2>
                <form action="/login" method="POST" class="flex flex-col gap-4">
                    <input type="password" name="password" placeholder="Passphrase" required class="w-full p-3 text-center tracking-widest bg-black border-[var(--input-border)] text-[var(--primary)] focus:border-[var(--primary)] font-bold"/>
                    <button type="submit" class="btn-hover w-full p-3 uppercase tracking-widest text-sm mt-2 font-bold">[ INITIATE ]</button>
                </form>
                <div class="mt-6 text-[10px] font-bold opacity-60 cursor-pointer hover:opacity-100 transition uppercase tracking-widest" onclick="showForgot()">> OVERRIDE_KEY</div>
            </div>

            <div id="forgot-panel" class="modal-sheet p-8 w-[90%] max-w-sm text-center z-10 hidden absolute transition-all duration-300 border-l-4 border-l-red-500" style="border-color: red !important; box-shadow: 0 0 30px rgba(255,0,0,0.3);">
                <div class="mb-4">
                    <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
                </div>
                <h2 class="text-md font-bold mb-2 tracking-widest uppercase text-red-500">> EMERGENCY_RECOVERY</h2>
                <p class="text-[10px] opacity-70 mb-6 font-bold uppercase">OTP routed to Master Comms.</p>
                
                <button onclick="sendOTP()" id="otp-btn" class="w-full p-3 mb-4 font-bold uppercase tracking-widest text-xs border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition">[ REQUEST_OTP ]</button>
                <form id="reset-form" class="hidden flex flex-col gap-4" onsubmit="event.preventDefault(); resetPass();">
                    <input type="text" id="otp-code" placeholder="ENTER_OTP" required class="w-full p-3 text-center tracking-widest bg-black border-red-500/50 text-red-500 focus:border-red-500 font-bold"/>
                    <input type="password" id="new-pass" placeholder="NEW_PASSPHRASE" required class="w-full p-3 text-center tracking-widest bg-black border-red-500/50 text-red-500 focus:border-red-500 font-bold"/>
                    <button type="submit" class="w-full p-3 uppercase tracking-widest text-xs mt-2 font-bold border border-red-500 bg-red-500 text-black hover:bg-transparent hover:text-red-500 transition">[ UPDATE_KEY ]</button>
                </form>
                <div class="mt-6 text-[10px] font-bold opacity-60 cursor-pointer hover:text-red-500 hover:opacity-100 transition uppercase tracking-widest" onclick="hideForgot()">[ ABORT ]</div>
            </div>
            
            <script>
                if(localStorage.getItem('authErr')) {
                    showSysModal({title: "ACCESS_DENIED", msg: "Invalid passphrase. Incident logged.", type: "alert"});
                    localStorage.removeItem('authErr');
                }
                function showForgot() { 
                    const auth = document.getElementById('auth-panel');
                    const forg = document.getElementById('forgot-panel');
                    gsap.to(auth, {scale: 0.9, opacity: 0, duration: 0.2, onComplete: () => {
                        auth.classList.add('hidden');
                        forg.classList.remove('hidden');
                        gsap.fromTo(forg, {scale: 1.1, opacity: 0}, {scale: 1, opacity: 1, duration: 0.2});
                    }});
                }
                function hideForgot() { 
                    const auth = document.getElementById('auth-panel');
                    const forg = document.getElementById('forgot-panel');
                    gsap.to(forg, {scale: 0.9, opacity: 0, duration: 0.2, onComplete: () => {
                        forg.classList.add('hidden');
                        auth.classList.remove('hidden');
                        gsap.fromTo(auth, {scale: 1.1, opacity: 0}, {scale: 1, opacity: 1, duration: 0.2});
                    }});
                }
                
                async function sendOTP() {
                    document.getElementById('otp-btn').innerText = "[ TRANSMITTING... ]";
                    await fetch('/api/auth/forgot', {method: 'POST'});
                    document.getElementById('otp-btn').classList.add('hidden');
                    document.getElementById('reset-form').classList.remove('hidden');
                    gsap.fromTo("#reset-form", {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.2});
                }
                
                async function resetPass() {
                    const otp = document.getElementById('otp-code').value;
                    const pass = document.getElementById('new-pass').value;
                    const res = await fetch('/api/auth/reset', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({otp, pass})});
                    const data = await res.json();
                    if(data.success) { 
                        showSysModal({title:"SYS_UPDATED", msg:"Key updated successfully.", cb: () => window.location.reload() });
                    } else { 
                        showSysModal({title:"ERROR", msg:"Invalid Verification OTP."}); 
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
    await sendTgRequest("sendMessage", { chat_id: TG_CHAT_ID, text: `🔐 *ROMEO ADMIN SECURITY*\n\nYour Password Reset OTP is: \`${resetOTP}\``, parse_mode: "Markdown" });
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
            let activeColor = u.auto_activate ? 'text-[var(--primary)] border-[var(--primary)]' : 'text-gray-500 border-gray-600 opacity-60';
            
            usersHtml += `<div class="bg-[var(--input-bg)] border border-[var(--input-border)] p-4 flex flex-col md:flex-row justify-between items-center gap-3 mb-2 hover:border-[var(--primary)] transition group">
                <div class="text-center md:text-left w-full md:w-auto">
                    <b class="text-sm font-bold uppercase text-white flex items-center justify-center md:justify-start">> ${u.name}</b>
                    <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                        <span class="text-[10px] font-bold opacity-80 bg-black px-2 py-1 border border-[var(--input-border)]">[ ${u.uid} ]</span>
                        <span class="text-[10px] font-bold text-[var(--primary)] bg-black border border-[var(--primary)] px-2 py-1 cursor-pointer hover:bg-[var(--primary)] hover:text-black transition" onclick="editTime('${u.uid}', ${u.interval_mins})">
                            <i class="fa-solid fa-clock mr-1"></i> ${u.interval_mins}m 
                        </span>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto justify-center md:justify-end">
                    <button class="border ${activeColor} px-3 py-1.5 transition font-bold text-[10px] flex items-center hover:bg-[var(--primary)] hover:text-black uppercase" onclick="toggleAuto('${u.uid}', ${!u.auto_activate})">[ AUTO ]</button>
                    <button class="border border-red-500 text-red-500 hover:bg-red-500 hover:text-black px-3 py-1.5 transition text-[10px] font-bold" onclick="delUser('${u.id}', '${u.uid}')">[ DEL ]</button>
                </div>
            </div>`;
        });
    }

    let licensesHtml = '';
    if (licenses && licenses.length > 0) {
        licenses.forEach(l => {
            const timeDiff = new Date(l.expires_at).getTime() - Date.now();
            const daysLeft = timeDiff > 0 ? (timeDiff / (1000 * 60 * 60 * 24)).toFixed(1) + 'd' : '<span class="text-red-500 font-bold">EXPIRED</span>';
            const bindInfo = l.ip_address ? `<span class="opacity-90 font-bold text-[10px] text-[var(--primary)]" title="${l.device_fingerprint}">${l.ip_address}</span>` : '<span class="opacity-50 text-[10px]">UNBOUND</span>';
            licensesHtml += `<div class="bg-[var(--input-bg)] border border-[var(--input-border)] p-4 flex flex-col gap-2 mb-2 hover:border-[var(--primary)] transition group">
                <div class="flex justify-between items-center"><b class="text-xs tracking-widest text-white">> ${l.license_key}</b> <span class="uppercase text-[9px] font-bold border border-[var(--primary)] text-[var(--primary)] px-1.5 py-0.5">${l.plan_type}</span></div>
                <div class="flex justify-between text-[10px] font-bold opacity-80 mt-1"><span>TTL: ${daysLeft}</span> <span>IP: ${bindInfo}</span></div>
                <div class="flex gap-2 mt-2 justify-end border-t border-[var(--input-border)] pt-2">
                    <button onclick="flushDevice('${l.license_key}')" class="border border-yellow-500 text-yellow-500 px-2 py-1 text-[9px] hover:bg-yellow-500 hover:text-black transition font-bold">[ FLUSH ]</button>
                    <button onclick="delLicense('${l.license_key}')" class="border border-red-500 text-red-500 px-2 py-1 text-[9px] hover:bg-red-500 hover:text-black transition font-bold">[ PURGE ]</button>
                </div>
            </div>`;
        });
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>ROOT_ACCESS</title>${uiHead}</head>
        <body class="min-h-screen pt-28 p-4 flex flex-col items-center">
            ${getFloatingHeader('ROOT_CONTROL', true)}
            
            <div class="w-full max-w-7xl mt-4">
                <div class="flex justify-start items-center mb-6 pl-2 animate-box">
                    <button onclick="changeAdminPass()" class="border border-[var(--primary)] bg-black hover:bg-[var(--primary)] hover:text-black text-[var(--primary)] px-4 py-2 font-bold transition text-xs flex items-center shadow-[0_0_10px_var(--panel-glow)]">
                        [ UPDATE_PASSPHRASE ]
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="flex flex-col gap-4">
                        <div class="glass-panel animate-box p-6 border-l-4 border-l-[var(--primary)]">
                            <h3 class="text-xs font-bold mb-4 uppercase tracking-widest text-white">> DEPLOY_NODE</h3>
                            <input type="text" id="name" placeholder="ALIAS_NAME" class="w-full p-2.5 mb-2 text-center bg-black border border-[var(--input-border)] text-xs focus:border-[var(--primary)] font-bold uppercase" />
                            <input type="text" id="uid" placeholder="TARGET_UID" class="w-full p-2.5 mb-2 text-center bg-black border border-[var(--input-border)] text-xs focus:border-[var(--primary)] font-bold uppercase" />
                            <input type="number" id="interval" placeholder="INTERVAL (MINS)" class="w-full p-2.5 mb-4 text-center bg-black border border-[var(--input-border)] text-xs focus:border-[var(--primary)] font-bold" />
                            <button onclick="addUser()" class="btn-hover w-full p-2.5 font-bold uppercase tracking-widest text-xs">[ INITIATE ]</button>
                        </div>
                        
                        <div class="glass-panel animate-box p-6 border-l-4 border-l-yellow-500">
                            <h3 class="text-xs font-bold mb-4 uppercase tracking-widest text-white">> GEN_LICENSE</h3>
                            <select id="plan_type" class="w-full p-2.5 mb-2 text-center bg-black border border-yellow-500/50 text-yellow-500 text-xs focus:border-yellow-500 font-bold uppercase">
                                <option value="trial" class="bg-black">Trial (1 Day)</option>
                                <option value="weekly" class="bg-black">Weekly (7 Days)</option>
                                <option value="monthly" class="bg-black">Monthly (30 Days)</option>
                                <option value="superuser" class="bg-black text-[var(--primary)]">Super User (10 UIDs)</option>
                            </select>
                            <input type="number" step="0.1" id="plan_days" placeholder="CUSTOM_TTL (DAYS)" class="w-full p-2.5 mb-4 text-center bg-black border border-yellow-500/50 text-yellow-500 text-xs focus:border-yellow-500 font-bold" />
                            <button onclick="genLicense()" class="w-full p-2.5 font-bold uppercase tracking-widest text-xs border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition shadow-[0_0_10px_rgba(234,179,8,0.2)]">[ GENERATE_KEY ]</button>
                        </div>
                    </div>

                    <div class="glass-panel animate-box p-6 md:col-span-1 flex flex-col max-h-[750px] border-t-4 border-t-[var(--primary)]">
                        <h3 class="text-xs font-bold mb-4 uppercase tracking-widest border-b border-[var(--input-border)] pb-2 text-white">> ACTIVE_NODES</h3>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">${usersHtml || '<div class="text-center py-12 opacity-50 font-bold text-xs uppercase">NO NODES DEPLOYED.</div>'}</div>
                    </div>

                    <div class="glass-panel animate-box p-6 md:col-span-1 flex flex-col max-h-[750px] border-t-4 border-t-[var(--primary)]">
                        <h3 class="text-xs font-bold mb-4 uppercase tracking-widest border-b border-[var(--input-border)] pb-2 text-white">> LICENSE_REGISTRY</h3>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">${licensesHtml || '<div class="text-center py-12 opacity-50 font-bold text-xs uppercase">REGISTRY EMPTY.</div>'}</div>
                    </div>
                </div>
            </div>
            <script>
                async function addUser() {
                    const name = document.getElementById('name').value;
                    const uid = document.getElementById('uid').value;
                    const interval = document.getElementById('interval').value || 40;
                    if(!name || !uid) return showSysModal({msg: "PARAMETERS MISSING!"});
                    await fetch('/api/target/add', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, uid, interval}) });
                    window.location.reload();
                }
                function delUser(id, uid) {
                    showSysModal({title: "SYS.WARN", msg: "PURGE NODE DEFINITELY?", type: "confirm", cb: async (res) => {
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
                    showSysModal({title: "UPDATE_CRON", msg: "ENTER NEW INTERVAL (MINS):", type: "prompt", default: oldTime, cb: async (newTime) => {
                        if(newTime && !isNaN(newTime) && newTime != oldTime) {
                            await fetch('/api/target/edit_time', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({uid, interval: parseInt(newTime)}) });
                            window.location.reload();
                        }
                    }});
                }
                function changeAdminPass() {
                    showSysModal({title: "SEC_UPDATE", msg: "ENTER NEW PASSPHRASE:", type: "prompt", cb: async (newPass) => {
                        if(newPass && newPass.length >= 6) {
                            await fetch('/api/auth/change_pass', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({newPass}) });
                            showSysModal({title: "SUCCESS", msg: "KEY UPDATED."});
                        } else if (newPass) showSysModal({title: "ERR", msg: "KEY TOO WEAK."});
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
                    showSysModal({title: "PURGE_KEY", msg: "DESTROY LICENSE FOREVER?", type: "confirm", cb: async (res) => {
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
        <html lang="en"><head><title>Firewall_CLI</title>${uiHead}</head>
        <body class="min-h-screen pt-28 p-4 flex flex-col items-center">
            ${getFloatingHeader('FIREWALL_CLI', true)}
            
            <div class="w-full max-w-7xl mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="glass-panel animate-box p-6 flex flex-col border-t-4 border-t-yellow-500">
                    <h3 class="font-bold uppercase tracking-widest text-white text-xs mb-4 border-b border-[var(--input-border)] pb-2">> CORS_SECURITY</h3>
                    
                    <div class="flex items-center justify-between bg-black border border-[var(--input-border)] p-4 mb-4">
                        <div>
                            <div class="font-bold text-xs tracking-widest text-white">ALLOW_ALL_ORIGINS (*)</div>
                            <div class="text-[9px] opacity-70 font-bold mt-1 text-yellow-500 uppercase">Warning: Unrestricted Access</div>
                        </div>
                        <button id="cors-toggle" onclick="toggleCors()" class="px-3 py-1 border font-bold text-xs transition uppercase ${ALLOW_ALL_CORS ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-transparent text-gray-500 border-gray-600 hover:border-white'}">
                            ${ALLOW_ALL_CORS ? '[ ACTIVE ]' : '[ BLOCKED ]'}
                        </button>
                    </div>

                    <div class="flex gap-2 mb-4">
                        <input type="text" id="new-cors-url" placeholder="https://domain.com" class="flex-1 p-2 text-xs bg-black border border-[var(--input-border)] focus:border-[var(--primary)] font-bold uppercase" />
                        <button onclick="addCorsUrl()" class="px-4 border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black font-bold text-xs transition uppercase">[ ADD ]</button>
                    </div>

                    <div id="cors-list" class="flex-1 overflow-y-auto space-y-2 max-h-[300px] custom-scrollbar"></div>
                </div>

                <div class="glass-panel animate-box p-6 flex flex-col h-[65vh] border-t-4 border-t-[var(--primary)]">
                    <div class="flex justify-between items-center border-b border-[var(--input-border)] pb-2 mb-4">
                        <h3 class="font-bold uppercase tracking-widest text-white text-xs">> TRAFFIC_LOGS</h3>
                        <button onclick="fetchApiLogs()" class="text-[10px] border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black px-2 py-1 transition font-bold uppercase">[ SYNC ]</button>
                    </div>
                    <div id="api-logs-container" class="flex-1 overflow-y-auto space-y-2 custom-scrollbar"></div>
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
                    if(urls.length === 0) return list.innerHTML = '<div class="text-center opacity-50 py-4 text-xs font-bold uppercase">NO WHITELIST DOMAINS.</div>';
                    list.innerHTML = urls.map(u => \`<div class="flex justify-between items-center bg-black p-3 border border-[var(--input-border)]">
                        <span class="text-xs font-bold text-white">\${u}</span>
                        <button onclick="removeCorsUrl('\${u}')" class="text-red-500 hover:bg-red-500 hover:text-black transition border border-red-500 px-2 text-xs font-bold">[ RM ]</button>
                    </div>\`).join('');
                }

                async function toggleCors() {
                    const btn = document.getElementById('cors-toggle');
                    const isCurrentlyOn = btn.innerText.includes('ACTIVE');
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
                    if(data.logs.length === 0) return container.innerHTML = '<div class="text-center opacity-50 py-10 text-xs font-bold uppercase">NO TRAFFIC DETECTED.</div>';
                    
                    container.innerHTML = data.logs.map(log => {
                        const statusColor = log.status >= 400 ? 'text-red-500 border-red-500/50' : 'text-[var(--primary)] border-[var(--input-border)]';
                        return \`<div class="bg-black p-3 border \${statusColor}">
                            <div class="flex justify-between mb-2 border-b border-gray-800 pb-2">
                                <span class="font-bold text-xs uppercase text-white">\${log.method} <span class="opacity-60 lowercase ml-2 font-normal text-[10px]">\${log.url}</span></span>
                                <span class="text-[10px] font-bold">\${log.timeTaken} | <span class="\${log.status >= 400 ? 'text-red-500' : 'text-[var(--primary)]'}">\${log.status}</span></span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-2">
                                <div class="bg-[#050505] p-2 border border-gray-800"><div class="text-[8px] opacity-70 mb-1 uppercase font-bold">> PAYLOAD_IN</div><pre class="text-[9px] opacity-80 overflow-x-auto">\${JSON.stringify(log.reqBody, null, 2)}</pre></div>
                                <div class="bg-[#050505] p-2 border border-gray-800"><div class="text-[8px] opacity-70 mb-1 uppercase font-bold">> PAYLOAD_OUT</div><pre class="text-[9px] opacity-80 overflow-x-auto">\${JSON.stringify(log.resBody, null, 2)}</pre></div>
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
        <html lang="en"><head><title>SYS_DUMPS</title>${uiHead}</head>
        <body class="min-h-screen pt-28 p-4 flex flex-col items-center">
            ${getFloatingHeader('SYS_DUMPS', true)}
            
            <div class="w-full max-w-7xl mt-4">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div class="glass-panel animate-box flex flex-col h-[50vh] overflow-hidden border-t-4 border-t-[var(--primary)]">
                        <div class="flex justify-between items-center p-4 border-b border-[var(--input-border)]">
                            <h3 class="font-bold uppercase tracking-widest text-white text-xs">> ENGINE_STDOUT</h3>
                            <button onclick="copyContent('sys-logs')" class="text-[9px] border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black px-2 py-1 transition font-bold uppercase">[ COPY ]</button>
                        </div>
                        <div class="text-[11px] flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar" id="sys-logs"></div>
                    </div>
                    
                    <div class="glass-panel animate-box flex flex-col h-[50vh] overflow-hidden border-t-4 border-t-blue-500">
                        <div class="flex justify-between items-center p-4 border-b border-[var(--input-border)]">
                            <h3 class="font-bold uppercase tracking-widest text-white text-xs">> NET_STDOUT</h3>
                            <button onclick="copyContent('net-logs')" class="text-[9px] border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black px-2 py-1 transition font-bold uppercase">[ COPY ]</button>
                        </div>
                        <div class="text-[10px] flex-1 overflow-y-auto p-4 opacity-80 break-all space-y-1 custom-scrollbar text-blue-400" id="net-logs"></div>
                    </div>
                </div>

                <div class="glass-panel animate-box p-6 border-t-4 border-t-[var(--primary)]">
                     <h3 class="font-bold uppercase tracking-widest text-white text-xs mb-4 border-b border-[var(--input-border)] pb-2">> MATRIX_SNAPSHOTS</h3>
                     <div id="matrix-grid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"></div>
                </div>
            </div>
            
            <div id="img-modal" class="fixed inset-0 bg-black/90 z-[500] hidden flex-col items-center justify-center p-4">
                <button onclick="document.getElementById('img-modal').classList.add('hidden')" class="absolute top-4 right-4 bg-transparent border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black px-4 py-1 text-xs font-bold transition uppercase">[ CLOSE ]</button>
                <img id="modal-img-src" src="" class="max-w-full max-h-[85vh] object-contain border-2 border-[var(--primary)] shadow-[0_0_20px_var(--primary)] filter contrast-125" />
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
                            let isErr = snap.isError ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.3)]' : 'border-[var(--input-border)] hover:border-[var(--primary)] hover:shadow-[0_0_10px_var(--primary)]';
                            let titleCol = snap.isError ? 'text-red-500 font-bold' : 'text-[var(--primary)] opacity-80';
                            grid.innerHTML += \`<div class="p-2 border \${isErr} cursor-pointer transition bg-black" onclick="showImg('data:image/jpeg;base64,\${snap.img}')">
                                <div class="text-[10px] font-bold uppercase truncate mb-1 text-white">\${uid}</div>
                                <div class="text-[8px] \${titleCol} truncate mb-2">>\${snap.step} | \${snap.time}</div>
                                <div class="relative overflow-hidden border border-gray-800">
                                    <img src="data:image/jpeg;base64,\${snap.img}" class="w-full aspect-[9/16] object-cover filter contrast-125" />
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
                    showSysModal({title: "SYS.COPY", msg: "DATA COPIED TO CLIPBOARD."});
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
            if (isRunning) remainingStr = '<span class="text-[var(--primary)] font-bold glitch-text" data-text="EXECUTING...">EXECUTING...</span>';
            else {
                if(diff > 0) remainingStr = '<span class="opacity-90 font-bold">T-' + Math.floor(diff/60000) + 'm ' + Math.floor((diff%60000)/1000) + 's</span>';
                else remainingStr = '<span class="text-yellow-500 font-bold animate-pulse">BOOT_SEQ_INIT...</span>';
            }
        } else {
            if(!timerObj.autoActivate) remainingStr = '<span class="text-red-500 font-bold">HALTED</span>';
            else if (isRunning) remainingStr = '<span class="text-[var(--primary)] font-bold glitch-text" data-text="EXECUTING...">EXECUTING...</span>';
            else if (diff > 0) remainingStr = '<span class="opacity-90 font-bold">T-' + Math.floor(diff/60000) + 'm ' + Math.floor((diff%60000)/1000) + 's</span>';
            else remainingStr = '<span class="text-yellow-500 font-bold animate-pulse">BOOT_SEQ_INIT...</span>';
        }
        
        uiData[uid] = { name: timerObj.name, remaining: remainingStr, isRunning, autoActivate: timerObj.autoActivate !== false, percent: percent };
    }
    io.emit('update_ui', uiData);
}, 1000);

function appendLog(html, type = 'sys') {
    const fullLog = `<div class="pb-1 mb-1 border-b border-[var(--input-border)]"><span class="text-[var(--primary)] px-1 mr-1 text-[9px] bg-black border border-[var(--input-border)]">[${getPKTTime()}]</span> ${html}</div>`;
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
            if(attempt > 1) appendLog(`<span class="text-yellow-500 font-bold">> SYSTEM_REBOOT (Attempt ${attempt}/${maxRetries})...</span>`);
            await runGhostActivator(uid, name);
            success = true; 
        } catch (error) {
            if (attempt < maxRetries) {
                appendLog(`<span class="text-red-500 font-bold">> EXEC_FAILED. REBOOTING_IN_5S...</span>`);
                await new Promise(r => setTimeout(r, 5000));
            } else {
                appendLog(`<span class="text-red-600 font-bold uppercase">> FATAL_ERR. TASK_ABORTED.</span>`);
            }
        }
    }

    if(target && !target.isSub && target.autoActivate) {
        appendLog(`<span class="opacity-80 font-bold text-white">> AUTO_RESUME SCHEDULED (T-${target.intervalMins}m)...</span>`);
        scheduleNextRun(uid);
    } else if(target && target.isSub) {
        appendLog(`<span class="opacity-80 font-bold text-white">> SUB_RESUME SCHEDULED (T-${target.intervalMins}m)...</span>`);
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
            appendLog('<span class="text-[var(--primary)] opacity-90 font-bold">> RESTORING_DATABASE_STATE...</span>');
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
    if(engineStatus[uid]) throw new Error("Engine already running for this UID");
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
        appendLog(`<b class="text-white">UID:[${uid}]</b> ${msg}`); 
        fs.appendFileSync(actionLogFile, `[${getPKTTime()}] ${msg.replace(/<[^>]*>?/gm, '')}\n`);
    };
    const netLog = (msg) => {
        appendLog(`<b class="text-blue-400">NET:[${uid}]</b> ${msg}`, 'net');
        fs.appendFileSync(netLogFile, `[${getPKTTime()}] ${msg.replace(/<[^>]*>?/gm, '')}\n`);
    };

    try {
        sysLog('<span class="text-[var(--primary)] font-bold">> ENGINE_BOOT_SEQ_INIT...</span>'); 
        
        try {
            await sendTgRequest("sendSticker", { chat_id: TG_CHAT_ID, sticker: TG_LIVE_STICKER_ID });
            await sendTelegramText(`🚀 *[ ${uid} ] ACTIVATION STARTED*\n\n[▓▓▓▓░░░░░░] 40%\n\n⏱️ PKT Time: ${getPKTTime()}`);
        } catch(e) {}

        let execPath = undefined;
        if (IS_TERMUX) {
            execPath = '/data/data/com.termux/files/usr/bin/chromium-browser';
        } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        // HEAVY OPTIMIZATION ARGS APPLIED HERE FOR RESOURCE ERROR FIX
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--window-size=360,640',
                '--single-process',          // FIX FOR PTHREAD_CREATE RESOURCE ERROR
                '--no-zygote',               // SAVES RAM
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-features=dbus'    // FIX FOR DBUS ERRORS
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
                recordingFrames[uid].push(evt.data); // Collect frames for GIF recording
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
                        sysLog('<span class="text-red-500 font-bold">> POPUP_INTERCEPTED & TERMINATED.</span>');
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
                    netLog(`<span class="text-red-500 font-bold">> HIJACK_BLOCKED: ${urlStr.substring(0, 40)}...</span>`);
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
                    let statusColor = status >= 400 ? 'text-red-500' : (status >= 300 ? 'text-yellow-500' : 'text-[var(--primary)]');
                    netLog(`<div class="bg-black p-1 border-l-2 border-[var(--input-border)] mb-1"><span class="${statusColor} font-bold mr-2">[${status}]</span> <span class="opacity-80">${urlStr.substring(0,60)}...</span></div>`);
                }
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
        page.on('dialog', async dialog => { await dialog.dismiss(); }); 

        await page.goto('https://unlockffbeta.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        sysLog('<span class="text-blue-400 font-bold">> TARGET_LOCKED. DOM_INJECTED.</span>');
        await saveMatrixScreen("INIT_DOM_LOAD");

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
            if(popupDestroyed) { sysLog('<span class="text-yellow-500 font-bold">> OVERLAY_REMOVED.</span>'); }

            await page.evaluate(() => {
                const reloadBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(b => b.innerText && b.innerText.toLowerCase().includes('i fixed it'));
                if(reloadBtn) reloadBtn.click();
            });

            const isInitializing = await page.evaluate(() => {
                const text = document.body.innerText ? document.body.innerText.toLowerCase() : "";
                return (text.includes('please wait') || text.includes('initializing...')) && !text.includes('access granted');
            });

            if (isInitializing) {
                sysLog('<span class="text-yellow-500 font-bold">> SPIN_LOCK DETECTED. [▓▓▓▓▓▓▓░░░] 70%</span>');
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
                sysLog('<span class="text-[var(--primary)] font-bold">> TARGET_BYPASSED. SUCCESS! [██████████] 100%</span>');
                await saveMatrixScreen("SUCCESS_VERIFIED");

                let extractedMs = (resultData.h * 60 * 60 * 1000) + (resultData.m * 60 * 1000) + (resultData.s * 1000);
                if (extractedMs < 60000) extractedMs = 60 * 60 * 1000; 

                let safeIntervalMs = extractedMs - (5 * 60 * 1000);
                if(safeIntervalMs < 60000) safeIntervalMs = 60000; 

                if (activeTimers[uid]) {
                    if(!activeTimers[uid].totalTime) activeTimers[uid].totalTime = 0;
                    activeTimers[uid].totalTime += extractedMs;
                    activeTimers[uid].intervalMins = Math.floor(safeIntervalMs / 60000);
                    sysLog(`TTL: ${resultData.timeStr}. CRON_SET: ${activeTimers[uid].intervalMins}m.`);
                }

                // =====================================
                // 15-SECOND GIF/VIDEO RECORDING LOGIC
                // =====================================
                try {
                    sysLog('> INITIATING 15S TELEMETRY CAPTURE...');
                    recordingStatus[uid] = true;
                    
                    // Allow CDP to capture frames for exactly 15 seconds
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    
                    recordingStatus[uid] = false;
                    sysLog('> CAPTURE DONE. COMPILING_DATA...');

                    const recDir = path.join(__dirname, `rec_tmp_${uid}_${Date.now()}`);
                    if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

                    // Save all collected frames as JPEGs
                    let frameCount = 0;
                    recordingFrames[uid].forEach((base64Str, i) => {
                        const filePath = path.join(recDir, `frame_${i.toString().padStart(4, '0')}.jpg`);
                        fs.writeFileSync(filePath, base64Str, 'base64');
                        frameCount++;
                    });

                    let caption = `✅ *Target Activated!*\n\n👤 Name: ${name}\n🆔 UID: \`${uid}\`\n⏱️ Time Granted: ${resultData.timeStr}\n🚀 System: Online`;

                    if(frameCount > 0) {
                        try {
                            const outVid = path.join(recDir, 'output.mp4');
                            // Use ffmpeg to stitch frames into an MP4 (Telegram treats this as a GIF if sent via sendAnimation)
                            execSync(`ffmpeg -y -framerate 4 -i ${recDir}/frame_%04d.jpg -c:v libx264 -pix_fmt yuv420p ${outVid} > /dev/null 2>&1`);
                            
                            sysLog('> DISPATCHING_FEED TO TG_NODE...');
                            await sendTgRequest("sendAnimation", { chat_id: TG_CHAT_ID, caption: caption, parse_mode: "Markdown" }, { fieldName: 'animation', buffer: fs.readFileSync(outVid), filename: 'proof.mp4' });
                        } catch(err) {
                            sysLog('<span class="text-yellow-500">> FFMPEG_MISSING. SENDING_STILL_FRAME.</span>');
                            await sendTelegramScreenshot(lastStreamFrame, uid, name, false, caption);
                        }
                    } else {
                        await sendTelegramScreenshot(lastStreamFrame, uid, name, false, caption);
                    }

                    // Clean up temp directory
                    try { fs.rmSync(recDir, { recursive: true, force: true }); } catch(e){}
                    recordingFrames[uid] = []; // clear memory

                    // Initialize the Live Tracker message and store ID
                    let liveInitMsg = `⏳ *LIVE TRACKER INIT...*\nUID: \`${uid}\``;
                    let tgRes = await sendTgRequest("sendMessage", { chat_id: TG_CHAT_ID, text: liveInitMsg, parse_mode: "Markdown" });
                    
                    if (tgRes && tgRes.result && tgRes.result.message_id) {
                        if (activeTimers[uid]) activeTimers[uid].tgMsgId = tgRes.result.message_id;
                    }
                } catch(e) {
                    console.log("TG Recording Push Error:", e.message);
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
                    sysLog('<span class="text-yellow-500 font-bold">> UID_INJECTED. [▓▓▓▓▓░░░░░] 50%</span>');
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
                sysLog(`<span class="text-white">> TRIGGER: "${clicked}"</span>`);
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
                throw new Error("Blocked by Target (Invalid ID)");
            }
        }
        await saveMatrixScreen("ERROR_TIMEOUT", true);
        throw new Error("Execution Timeout! Target flow got stuck.");
    } catch (error) {
        sysLog(`<span class="text-red-500 font-bold uppercase">> ERR: ${error.message}</span>`);
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
        sysLog('<span class="opacity-50 text-red-500 font-bold uppercase">> ENGINE_TERMINATED.</span>');
        
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
    console.log(`⚡ ROMEO ROOT SERVER INITIALIZED`);
    console.log(`📡 ENVIRONMENT: ${HOST_ENV}`);
    console.log(`👉 Front: http://localhost:${PORT}/`);
    console.log('=========================================\n');
});
