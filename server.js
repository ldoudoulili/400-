// 400售后事件记录 —— 本地小程序服务器
// 使用 Node 原生模块，无需 npm install。
// 数据保存在与本文件同一文件夹下的 data.json。

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8400;
const ROOT = __dirname;                                   // 脚本所在文件夹
// 打包成 exe 后：页面文件打进包内(用 __dirname)，数据文件放在 exe 所在真实目录，便于持久保存
const isPkg = typeof process.pkg !== 'undefined' && process.pkg !== null;
const DATA_FILE = path.join(isPkg ? path.dirname(process.execPath) : ROOT, 'data.json');
const HTML_FILE = path.join(ROOT, 'page', 'index.html');  // 页面（放在 page 子文件夹）

// 打开时：如果数据文件不存在，自动新建一个空文件
function ensureDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, '[]', 'utf8');
        console.log('数据文件不存在，已自动新建：' + DATA_FILE);
    }
}

// 写启动诊断日志（放在数据文件同一目录，方便排查双击后没反应的问题）
function writeLog(text) {
    try {
        fs.appendFileSync(path.join(path.dirname(DATA_FILE), '启动日志.txt'),
            '[' + new Date().toISOString() + ']\n' + text + '\n', 'utf8');
    } catch (e) { /* 忽略日志写入失败 */ }
}

// 打开默认浏览器（Windows）
function openBrowser(url) {
    writeLog('尝试打开浏览器: ' + url);
    try {
        exec('start "" "' + url + '"', { windowsHide: true }, (err, so, se) => {
            if (err) {
                writeLog('start 命令报错: ' + err.message + ' | stderr: ' + se);
                // 兜底：用 rundll32 的方式再试一次
                try { exec('rundll32 url.dll,FileProtocolHandler "' + url + '"', { windowsHide: true }, () => {}); } catch (e) {}
            } else {
                writeLog('start 命令执行成功');
            }
        });
    } catch (e) {
        writeLog('exec 抛出异常: ' + e.message);
    }
}

// 读取全部记录
function readRecords() {
    ensureDataFile();
    try {
        const txt = fs.readFileSync(DATA_FILE, 'utf8').trim();
        const arr = txt ? JSON.parse(txt) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        console.error('读取数据失败，返回空列表：', e.message);
        return [];
    }
}

// 写入全部记录
function writeRecords(records) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

// ===== 心跳 / 网页关闭后自动退出 =====
// 网页每隔几秒发一次心跳；一旦超过 ALIVE_TIMEOUT 没收到心跳，
// 说明网页已关闭，服务器自动退出（黑窗随之关闭）。
let lastBeat = 0;                 // 最近一次心跳时间；0 表示还没有网页连上
let started = Date.now();
const ALIVE_TIMEOUT = 12000;      // 12 秒没心跳就退出
const STARTUP_GRACE = 60000;      // 启动后 60 秒宽限期，等浏览器打开

setInterval(() => {
    const now = Date.now();
    // 启动宽限期内、且还没有任何网页连上时，不退出（等浏览器启动）
    if (lastBeat === 0) {
        if (now - started > STARTUP_GRACE) {
            console.log('长时间没有网页连接，程序退出。');
            process.exit(0);
        }
        return;
    }
    // 已经有网页连过，但心跳中断 -> 网页已关闭
    if (now - lastBeat > ALIVE_TIMEOUT) {
        console.log('检测到网页已关闭，程序自动退出。');
        process.exit(0);
    }
}, 3000);

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    // 读取数据接口
    if (pathname === '/api/records' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, records: readRecords() });
    }

    // 心跳接口：网页存活期间会不断调用
    if (pathname === '/api/heartbeat' && req.method === 'GET') {
        lastBeat = Date.now();
        return sendJson(res, 200, { ok: true });
    }

    // 网页关闭时主动通知退出（配合 sendBeacon）
    if (pathname === '/api/shutdown' && req.method === 'POST') {
        sendJson(res, 200, { ok: true });
        console.log('网页发出关闭通知，程序退出。');
        setTimeout(() => process.exit(0), 200);
        return;
    }

    // 保存数据接口
    if (pathname === '/api/records' && req.method === 'POST') {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(raw || '{}');
                const records = Array.isArray(data.records) ? data.records : [];
                writeRecords(records);
                sendJson(res, 200, { ok: true, count: records.length });
            } catch (e) {
                sendJson(res, 400, { ok: false, error: e.message });
            }
        });
        return;
    }

    // 首页 / 静态页面
    if ((pathname === '/' || pathname === '/index.html') && req.method === 'GET') {
        fs.readFile(HTML_FILE, (err, buf) => {
            if (err) {
                res.writeHead(500);
                res.end('无法读取页面文件');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(buf);
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
});

ensureDataFile();
server.listen(PORT, () => {
    console.log('====================================================');
    console.log('  400售后事件记录 本地程序已启动');
    console.log('  请在浏览器打开： http://localhost:' + PORT);
    console.log('  数据文件： ' + DATA_FILE);
    console.log('  关闭本窗口即可停止程序');
    console.log('====================================================');

    // 判断当前是否为打包成 exe 运行（SEA 单文件）：execPath 是 exe 本身，而非 node.exe
    // 用 node server.js 调试时 execPath 是 node.exe，不自动开浏览器（避免与启动脚本重复）。
    const exeName = path.basename(process.execPath).toLowerCase();
    const isSeaExe = exeName !== 'node.exe' && exeName !== 'node';
    writeLog('argv=' + JSON.stringify(process.argv));
    writeLog('execPath=' + process.execPath);
    writeLog('isSeaExe=' + isSeaExe);
    if (isSeaExe) {
        openBrowser('http://localhost:' + PORT);
    }
});
