/* ============================================================
 * 400电话记录 - 安卓离线版前端逻辑
 * 数据存储：localStorage，key = calllog400_records
 * 记录结构：{ id, tel, hm, fullTime, desc, result, needFollow }
 * ============================================================ */

const STORAGE_KEY = 'calllog400_records';

let recordList = [];
let editingId = null;

/* ---------- 工具函数 ---------- */
function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getNowHM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeColon(str) {
    return String(str || '').replace(/：/g, ':').trim();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function toast(msg, duration) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration || 2200);
}

/* ---------- localStorage 读写 ---------- */
function loadRecords() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        recordList = raw ? JSON.parse(raw) : [];
    } catch (e) {
        recordList = [];
    }
    recordList.forEach(r => {
        if (!r.id) r.id = genId();
        if (r.hm) r.hm = normalizeColon(r.hm);
        if (r.fullTime) r.fullTime = normalizeColon(r.fullTime);
    });
}

function saveRecords() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recordList));
        return true;
    } catch (e) {
        toast('保存失败：' + e.message);
        return false;
    }
}

/* ---------- 统计卡片 ---------- */
function updateStats() {
    const today = getTodayStr();
    const todayList = recordList.filter(r => (r.fullTime || '').indexOf(today) === 0);
    const followCount = todayList.filter(r => r.needFollow).length;
    document.getElementById('statToday').textContent = todayList.length;
    document.getElementById('statFollow').textContent = followCount;
    document.getElementById('statTotal').textContent = recordList.length;
}

/* ---------- 列表筛选 ---------- */
function getFilteredList() {
    const dateVal = document.getElementById('filterDate').value || getTodayStr();
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
    const onlyFollow = document.getElementById('onlyFollow').checked;

    let list = recordList.filter(r => (r.fullTime || '').indexOf(dateVal) === 0);
    if (onlyFollow) list = list.filter(r => r.needFollow);
    if (keyword) {
        list = list.filter(r =>
            (r.tel || '').toLowerCase().includes(keyword) ||
            (r.desc || '').toLowerCase().includes(keyword) ||
            (r.result || '').toLowerCase().includes(keyword)
        );
    }
    list.sort((a, b) => (a.fullTime || '').localeCompare(b.fullTime || ''));
    return list;
}

/* ---------- 记录列表渲染（移动端卡片式） ---------- */
function renderList() {
    const dom = document.getElementById('recordList');
    const list = getFilteredList();
    const dateVal = document.getElementById('filterDate').value || getTodayStr();
    const totalDay = recordList.filter(r => (r.fullTime || '').indexOf(dateVal) === 0).length;

    document.getElementById('filterCount').textContent =
        `显示 ${list.length}/${totalDay} 条`;

    if (list.length === 0) {
        dom.innerHTML = `<div class="empty-tip">该日期暂无符合条件的记录</div>`;
        return;
    }

    let html = '<div class="record-list">';
    list.forEach(item => {
        const followTag = item.needFollow ? `<span class="tag-follow">需跟进</span>` : '';
        html += `
        <div class="record-card">
            <div class="record-top">
                <span class="record-tel">${escapeHtml(item.tel || '')}${followTag}</span>
                <span class="record-time">${escapeHtml(item.hm || '')}</span>
            </div>
            <div class="record-row"><span class="lbl">描述</span>${escapeHtml(item.desc || '')}</div>
            <div class="record-row"><span class="lbl">结论</span>${escapeHtml(item.result || '')}</div>
            <div class="record-ops">
                <button class="btn-edit" data-edit="${item.id}">修改</button>
                <button class="btn-del" data-del="${item.id}">删除</button>
            </div>
        </div>
        `;
    });
    html += '</div>';
    dom.innerHTML = html;
}

/* ---------- 表单操作 ---------- */
function clearForm() {
    document.getElementById('tel').value = '';
    document.getElementById('callHM').value = getNowHM();
    document.getElementById('desc').value = '';
    document.getElementById('result').value = '';
    document.getElementById('needFollow').checked = false;
}

function submitRecord() {
    const tel = document.getElementById('tel').value.trim();
    const hm = normalizeColon(document.getElementById('callHM').value);
    const desc = document.getElementById('desc').value.trim();
    const result = document.getElementById('result').value.trim();
    const needFollow = document.getElementById('needFollow').checked;

    if (!tel) {
        toast('请填写来电电话');
        document.getElementById('tel').focus();
        return;
    }
    const today = getTodayStr();
    const fullTime = hm ? `${today} ${hm}` : today;

    if (editingId) {
        const rec = recordList.find(r => r.id === editingId);
        if (rec) {
            rec.tel = tel; rec.hm = hm; rec.fullTime = fullTime;
            rec.desc = desc; rec.result = result; rec.needFollow = needFollow;
        }
        exitEditMode();
    } else {
        recordList.push({ id: genId(), tel, hm, fullTime, desc, result, needFollow });
    }

    saveRecords();
    clearForm();
    updateStats();
    renderList();
    toast(editingId ? '记录已更新' : '已添加记录');
}

function startEdit(id) {
    const rec = recordList.find(r => r.id === id);
    if (!rec) return;
    editingId = id;
    document.getElementById('tel').value = rec.tel || '';
    document.getElementById('callHM').value = rec.hm || '';
    document.getElementById('desc').value = rec.desc || '';
    document.getElementById('result').value = rec.result || '';
    document.getElementById('needFollow').checked = !!rec.needFollow;

    document.getElementById('submitBtn').textContent = '保存修改';
    document.getElementById('cancelBtn').style.display = '';
    document.getElementById('editingTip').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEditMode() {
    editingId = null;
    document.getElementById('submitBtn').textContent = '添加记录';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('editingTip').style.display = 'none';
}

function cancelEdit() {
    exitEditMode();
    clearForm();
}

function delRecord(id) {
    if (!confirm('确定删除这条记录？')) return;
    if (editingId === id) cancelEdit();
    recordList = recordList.filter(r => r.id !== id);
    saveRecords();
    updateStats();
    renderList();
    toast('已删除');
}

/* ---------- 导出 CSV ---------- */
function exportCsv() {
    if (recordList.length === 0) {
        toast('没有记录可导出');
        return;
    }
    // 按 fullTime 排序导出
    const sorted = recordList.slice().sort((a, b) => (a.fullTime || '').localeCompare(b.fullTime || ''));
    let csvContent = "\uFEFF来电电话,来电时间,事件描述,处理结论,是否需要跟进\n";
    sorted.forEach(r => {
        const tel = `"${(r.tel || "").replace(/"/g, '""')}"`;
        const ft = `"${(r.fullTime || "").replace(/"/g, '""')}"`;
        const de = `"${(r.desc || "").replace(/"/g, '""')}"`;
        const re = `"${(r.result || "").replace(/"/g, '""')}"`;
        const follow = r.needFollow ? "是" : "否";
        csvContent += `${tel},${ft},${de},${re},"${follow}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `400电话记录_${getTodayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('CSV 已导出');
}

/* ============================================================
 * 通话记录选择（Capacitor 原生插件）
 * ============================================================ */
function isCapacitorAvailable() {
    return typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins &&
           window.Capacitor.Plugins.CallLogPlugin;
}

function openSheet() {
    document.getElementById('sheetMask').classList.add('show');
    document.getElementById('sheet').classList.add('show');
}
function closeSheet() {
    document.getElementById('sheetMask').classList.remove('show');
    document.getElementById('sheet').classList.remove('show');
}

async function onPickCall() {
    // 浏览器调试环境
    if (!isCapacitorAvailable()) {
        toast('请在安卓 App 中使用此功能');
        return;
    }
    const { CallLogPlugin } = window.Capacitor.Plugins;

    openSheet();
    const body = document.getElementById('sheetBody');
    body.innerHTML = '<div class="sheet-loading">正在请求权限并加载通话记录…</div>';

    try {
        // 1. 请求权限
        const permResult = await CallLogPlugin.requestPermission();
        if (!permResult || !permResult.granted) {
            body.innerHTML = `<div class="sheet-empty">
                未获得通话记录权限。<br><br>
                请在 <b>系统设置 → 应用 → 400电话记录 → 权限</b><br>
                中手动开启「读取通话记录」后重试。
            </div>`;
            return;
        }

        // 2. 获取最近30条来电
        const res = await CallLogPlugin.getCallLogs({ limit: 30 });
        const logs = (res && res.logs) ? res.logs : [];

        if (logs.length === 0) {
            body.innerHTML = '<div class="sheet-empty">最近没有来电记录</div>';
            return;
        }

        // 3. 渲染列表
        let html = '';
        logs.forEach(item => {
            const typeCls = item.type === 1 ? 'in' : (item.type === 2 ? 'out' : 'miss');
            const typeName = item.typeName || '通话';
            const dur = item.duration ? `时长 ${item.duration}秒` : '';
            const name = item.name ? ` · ${escapeHtml(item.name)}` : '';
            html += `
            <div class="call-item" data-number="${escapeHtml(item.number)}" data-date="${escapeHtml(item.dateStr || '')}">
                <div class="call-item-top">
                    <span class="call-number">${escapeHtml(item.number || '未知号码')}${name}</span>
                    <span class="call-type ${typeCls}">${escapeHtml(typeName)}</span>
                </div>
                <div class="call-meta">${escapeHtml(item.dateStr || '')} ${dur}</div>
            </div>
            `;
        });
        body.innerHTML = html;
    } catch (e) {
        body.innerHTML = `<div class="sheet-empty">读取失败：${escapeHtml(e.message || e)}</div>`;
    }
}

function onSheetBodyClick(e) {
    const item = e.target.closest('.call-item');
    if (!item) return;
    const number = item.getAttribute('data-number') || '';
    const dateStr = item.getAttribute('data-date') || ''; // YYYY-MM-DD HH:mm

    // 从 dateStr 提取 HH:MM
    let hm = getNowHM();
    if (dateStr && dateStr.length >= 16) {
        hm = dateStr.substring(11, 16);
    }

    document.getElementById('tel').value = number;
    document.getElementById('callHM').value = hm;
    closeSheet();
    toast(`已填入 ${number} ${hm}`);
    document.getElementById('desc').focus();
}

/* ---------- 初始化 & 事件绑定 ---------- */
function init() {
    // 默认值
    document.getElementById('filterDate').value = getTodayStr();
    document.getElementById('callHM').value = getNowHM();

    // 数据加载
    loadRecords();
    updateStats();
    renderList();

    // 按钮事件
    document.getElementById('submitBtn').addEventListener('click', submitRecord);
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    document.getElementById('exportBtn').addEventListener('click', exportCsv);
    document.getElementById('pickCallBtn').addEventListener('click', onPickCall);

    // 筛选事件（实时）
    document.getElementById('filterDate').addEventListener('change', renderList);
    document.getElementById('searchInput').addEventListener('input', renderList);
    document.getElementById('onlyFollow').addEventListener('change', renderList);

    // 列表内按钮（事件委托）
    document.getElementById('recordList').addEventListener('click', e => {
        const editId = e.target.getAttribute('data-edit');
        const delId = e.target.getAttribute('data-del');
        if (editId) startEdit(editId);
        if (delId) delRecord(delId);
    });

    // 通话记录面板
    document.getElementById('sheetClose').addEventListener('click', closeSheet);
    document.getElementById('sheetMask').addEventListener('click', closeSheet);
    document.getElementById('sheetBody').addEventListener('click', onSheetBodyClick);

    // 浏览器环境下提示
    if (!isCapacitorAvailable()) {
        const btn = document.getElementById('pickCallBtn');
        btn.classList.add('disabled');
        btn.textContent = '📞 从通话记录选择（请在App中使用）';
    }
}

window.addEventListener('DOMContentLoaded', init);
