// ====================================================================
// ฟอร์มยื่นใบลา — ตรรกะฝั่ง client
// อ่าน mode จาก query string: ?mode=normal | ?mode=intraday
// ====================================================================

const qs = new URLSearchParams(window.location.search);
const mode = qs.get('mode') || 'normal';

// เส้นตายยื่นลาแบบล่วงหน้า — ต้องตรงกับ CUTOFF_NORMAL ในชีต Config
// ค่านี้ใช้แสดงผลบนหน้าจอเท่านั้น เซิร์ฟเวอร์อ่านจาก Config และตัดสินจริงอีกครั้งเสมอ
const CUTOFF_HOUR = 7;
const CUTOFF_MINUTE = 30;
const CUTOFF_LABEL = '07:30 น.';

const els = {
  loading: document.getElementById('loadingMsg'),
  notConfigured: document.getElementById('notConfiguredMsg'),
  error: document.getElementById('errorMsg'),
  success: document.getElementById('successMsg'),
  form: document.getElementById('leaveForm'),
  leaveType: document.getElementById('leaveType'),
  startDT: document.getElementById('startDT'),
  endDT: document.getElementById('endDT'),
  daysPreview: document.getElementById('daysPreview'),
  reason: document.getElementById('reason'),
  emergencyNote: document.getElementById('emergencyNote'),
  delegateList: document.getElementById('delegateList'),
  submitBtn: document.getElementById('submitBtn'),
  quotaCard: document.getElementById('quotaCard'),
  quotaHeader: document.getElementById('quotaHeader'),
  quotaList: document.getElementById('quotaList')
};

// เก็บโควตาของผู้ใช้ไว้ เพื่อไฮไลต์แถวตามประเภทการลาที่เลือก
let myQuotas = [];

function showError(msg) {
  els.error.textContent = msg;
  els.error.classList.remove('hidden');
}

function hideError() {
  els.error.classList.add('hidden');
}

// แสดงเฉพาะประเภทที่พนักงานคนนี้มีสิทธิ์จริง
// ประเภทที่โควตาเป็น 0 (เช่น ลาคลอด / ลาช่วยเลี้ยงดูบุตร ที่ HR ยังไม่ได้เปิดให้)
// จะถูกซ่อน เพื่อไม่ให้เลือกแล้วไปเจอ error ตอนกดส่ง
// หมายเหตุ: 'ลาไม่รับค่าจ้าง' ไม่มีโควตา จึงแสดงเสมอ
function populateLeaveTypes(quotas) {
  els.leaveType.innerHTML = '';

  const quotaByType = {};
  (quotas || []).forEach(function (q) { quotaByType[q.leaveType] = q; });

  let shown = 0;
  CONFIG.LEAVE_TYPES.forEach(function (t) {
    if (t !== 'ลาไม่รับค่าจ้าง') {
      const q = quotaByType[t];
      // ยังไม่มีข้อมูลโควตาเลย → แสดงไว้ก่อน ให้เซิร์ฟเวอร์เป็นคนบอกเหตุผล
      if (q && q.hasData && !(q.quota > 0)) return;
    }
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    els.leaveType.appendChild(opt);
    shown += 1;
  });

  if (shown === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'ยังไม่มีสิทธิ์การลา — ติดต่อฝ่ายบุคคล';
    els.leaveType.appendChild(opt);
  }
}

// ระบบตัดสินเองว่าเป็นลาฉุกเฉินหรือลาล่วงหน้า จากวันที่เริ่มลา
// (เซิร์ฟเวอร์คำนวณซ้ำอีกครั้งเสมอ ค่าตรงนี้แสดงให้ผู้ใช้ทราบล่วงหน้าเท่านั้น)
function updateEmergencyNote() {
  if (!els.startDT.value) {
    els.emergencyNote.textContent = '';
    return;
  }
  const start = new Date(els.startDT.value);
  if (isNaN(start.getTime())) {
    els.emergencyNote.textContent = '';
    return;
  }
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (startDay.getTime() < todayDay.getTime()) {
    els.emergencyNote.textContent = '⛔ ไม่อนุญาตให้ยื่นลาย้อนหลัง กรุณาเลือกตั้งแต่วันนี้เป็นต้นไป';
    return;
  }

  // เส้นตายยื่นแบบล่วงหน้า = CUTOFF_NORMAL ของวันที่เริ่มลา (ค่าเริ่มต้น 07:30)
  const cutoff = new Date(startDay.getTime());
  cutoff.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);

  if (new Date().getTime() > cutoff.getTime()) {
    els.emergencyNote.textContent =
      '🚨 ระบบจะบันทึกเป็น "ลาฉุกเฉิน/ระหว่างวัน" เพราะเลยเวลา ' + CUTOFF_LABEL + ' ของวันที่เริ่มลาแล้ว';
  } else {
    els.emergencyNote.textContent =
      '📅 ระบบจะบันทึกเป็น "ลาล่วงหน้า" (ยื่นก่อน ' + CUTOFF_LABEL + ' ของวันที่เริ่มลา)';
  }
}

function updateDaysPreview() {
  updateEmergencyNote();
  if (!els.startDT.value || !els.endDT.value) {
    els.daysPreview.textContent = '';
    return;
  }
  const start = new Date(els.startDT.value);
  const end = new Date(els.endDT.value);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    els.daysPreview.textContent = 'ช่วงวันที่ไม่ถูกต้อง';
    return;
  }
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const rawHours = (end.getTime() - start.getTime()) / 3600000;
    els.daysPreview.textContent =
      'ช่วงที่เลือกประมาณ ' + (Math.round(rawHours * 10) / 10) + ' ชั่วโมง — ' +
      'ระบบจะหักเวลาพักเที่ยงและปัดขึ้นทีละ 30 นาทีหลังกดส่ง';
  } else {
    const msPerDay = 24 * 60 * 60 * 1000;
    const rawDays = Math.floor((new Date(end.toDateString()) - new Date(start.toDateString())) / msPerDay) + 1;
    els.daysPreview.textContent =
      'ครอบคลุม ' + rawDays + ' วันตามปฏิทิน — ระบบจะนับเฉพาะวันและเวลาทำงานจริงของคุณหลังกดส่ง';
  }
}

// ⚠️ แก้ไข 10 ส.ค. 2026 — โควตาที่แสดงไม่อัปเดต และ "เด้งกลับ" เป็นค่าเดิมหลังอนุมัติ
// สาเหตุ: URL นี้เปลี่ยนตาม idToken อย่างเดียว ซึ่ง LINE ออกให้มีอายุ 1 ชั่วโมง
// WebView ในแอป LINE (WKWebView) จึงถือว่าเป็น URL เดิมและคืนคำตอบที่ cache ไว้
// ทั้งที่เซิร์ฟเวอร์มีข้อมูลใหม่แล้ว
// แก้: เติม _ts กันแคช + สั่ง no-store ทั้งฝั่ง fetch และ header
async function fetchFormData(idToken) {
  const url = CONFIG.EMPLOYEE_LIST_URL +
    '?idToken=' + encodeURIComponent(idToken) +
    '&_ts=' + Date.now();
  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });
  const data = await res.json().catch(function () { return { ok: false, message: 'อ่านข้อมูลพนักงานไม่สำเร็จ' }; });
  if (!res.ok || !data.ok) {
    throw new Error(data.message || 'โหลดรายชื่อพนักงานไม่สำเร็จ');
  }
  return data;
}

// แปลงจำนวนวัน (ทศนิยม) เป็นข้อความอ่านง่าย เช่น 3.25 → "3 วัน 2 ชม."
const HOURS_PER_DAY = 8;
function fmtDuration(days) {
  const d = Number(days) || 0;
  if (d <= 0) return '0 วัน';
  const whole = Math.floor(d + 1e-9);
  const hours = Math.round((d - whole) * HOURS_PER_DAY * 10) / 10;
  if (whole > 0 && hours > 0) return whole + ' วัน ' + hours + ' ชม.';
  if (whole > 0) return whole + ' วัน';
  return hours + ' ชม.';
}

function renderQuota(data) {
  myQuotas = data.quotas || [];

  if (!data.me) {
    els.quotaCard.style.display = 'none';
    return;
  }

  els.quotaHeader.textContent =
    'สิทธิ์คงเหลือของคุณ ปี ' + data.year + ' — ' + data.me.fullName + ' (' + data.me.empId + ')';

  if (!data.hasQuotaData) {
    els.quotaList.innerHTML =
      '<div class="hint" style="padding:8px 0">ยังไม่มีข้อมูลโควตาปี ' + data.year +
      ' ของคุณในระบบ กรุณาติดต่อฝ่ายบุคคลก่อนยื่นลา</div>';
    els.quotaCard.style.display = '';
    return;
  }

  els.quotaList.innerHTML = '';
  myQuotas.forEach(function (q) {
    if (!q.hasData) return;
    if (!q.quota && !q.used && !q.pending) return; // ไม่แสดงประเภทที่ไม่มีสิทธิ์เลย

    const cls = q.available <= 0 ? 'none' : (q.available <= 1 ? 'low' : 'ok');
    const pendingNote = q.pending > 0 ? '<span class="qsub">รออนุมัติ ' + fmtDuration(q.pending) + '</span>' : '';

    const row = document.createElement('div');
    row.className = 'quota-row';
    row.setAttribute('data-type', q.leaveType);
    row.innerHTML =
      '<span class="qname">' + q.leaveType + '</span>' +
      '<span class="qval ' + cls + '">เหลือ ' + fmtDuration(q.available) +
      '<span class="qsub">จาก ' + fmtDuration(q.quota) + '</span>' + pendingNote + '</span>';
    els.quotaList.appendChild(row);
  });

  els.quotaCard.style.display = '';
  highlightSelectedQuota();
}

function highlightSelectedQuota() {
  const selected = els.leaveType.value;
  const rows = els.quotaList.querySelectorAll('.quota-row');
  Array.prototype.forEach.call(rows, function (r) {
    if (r.getAttribute('data-type') === selected) {
      r.classList.add('active');
    } else {
      r.classList.remove('active');
    }
  });
}

function renderDelegateList(employees, myEmpId) {
  els.delegateList.innerHTML = '';
  const others = employees.filter(function (e) { return e.empId !== myEmpId; });
  if (others.length === 0) {
    els.delegateList.innerHTML = '<div class="hint" style="padding:10px">ไม่พบรายชื่อพนักงานอื่นในระบบ</div>';
    return;
  }
  others.forEach(function (e) {
    const row = document.createElement('label');
    row.className = 'delegate-item';
    row.innerHTML =
      '<input type="checkbox" value="' + e.empId + '" class="delegateCheckbox" />' +
      '<span class="name">' + e.fullName + '</span>' +
      '<span class="dept">' + (e.department || '') + '</span>';
    els.delegateList.appendChild(row);
  });
}

function getSelectedDelegates() {
  const boxes = document.querySelectorAll('.delegateCheckbox:checked');
  return Array.prototype.map.call(boxes, function (b) { return b.value; });
}

function toLocalISOWithOffset(dtLocalValue) {
  // input[type=datetime-local] gives e.g. 2026-08-10T09:00 (no timezone)
  // ระบบฝั่งเซิร์ฟเวอร์ตีความเป็นเวลาไทย (+07:00) อยู่แล้ว จึงต่อ offset ตรงๆ
  if (!dtLocalValue) return '';
  return dtLocalValue.length === 16 ? dtLocalValue + ':00+07:00' : dtLocalValue + '+07:00';
}

async function submitLeaveRequest(idToken) {
  const delegates = getSelectedDelegates();
  if (delegates.length === 0) {
    showError('กรุณาเลือกผู้รับมอบงานอย่างน้อย 1 คน');
    return;
  }
  hideError();
  els.submitBtn.disabled = true;
  els.submitBtn.innerHTML = '<span class="spinner"></span>กำลังส่ง...';

  const payload = {
    idToken: idToken,
    leaveType: els.leaveType.value,
    startDT: toLocalISOWithOffset(els.startDT.value),
    endDT: toLocalISOWithOffset(els.endDT.value),
    reason: els.reason.value,
    delegateEmpId: delegates.join(',')
    // ไม่ต้องส่ง isEmergency — เซิร์ฟเวอร์ตัดสินเองจากวันที่เริ่มลา
  };

  try {
    const res = await fetch(CONFIG.SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      data = {
        ok: false,
        message: 'อ่านผลลัพธ์ไม่สำเร็จ (HTTP ' + res.status + ')\nคำตอบจากเซิร์ฟเวอร์: ' +
          (rawText ? rawText.slice(0, 300) : '(ว่างเปล่า)')
      };
    }

    if (!res.ok || !data.ok) {
      showError(data.message || 'ส่งคำขอลาไม่สำเร็จ กรุณาลองใหม่');
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = 'ส่งคำขอลา';
      return;
    }

    els.form.classList.add('hidden');
    els.success.textContent =
      (data.message || 'ส่งคำขอลาเรียบร้อยแล้ว') +
      (data.reqId ? '\nรหัสคำขอ: ' + data.reqId : '') +
      '\n\nคุณสามารถปิดหน้าต่างนี้ได้';
    els.success.classList.remove('hidden');

    if (window.liff && liff.isInClient && liff.isInClient()) {
      setTimeout(function () { liff.closeWindow(); }, 2500);
    }
  } catch (err) {
    showError('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = 'ส่งคำขอลา';
  }
}

async function main() {
  if (!CONFIG.LIFF_ID || CONFIG.LIFF_ID === 'REPLACE_WITH_LIFF_ID') {
    els.loading.classList.add('hidden');
    els.notConfigured.classList.remove('hidden');
    return;
  }

  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });

    if (!liff.isLoggedIn()) {
      liff.login();
      return; // จะรีไดเรกต์กลับมาหน้านี้อีกครั้งหลังล็อกอิน
    }

    const idToken = liff.getIDToken();
    if (!idToken) {
      throw new Error('ไม่ได้รับ ID Token — กรุณาตรวจสอบว่าเปิด scope "openid" ใน LIFF app แล้ว');
    }

    const profile = await liff.getProfile();

    // เปิดจากปุ่ม "ลาฉุกเฉิน/ระหว่างวัน" → เติมวันที่เริ่มลาเป็นตอนนี้ให้เลย
    if (mode === 'intraday') {
      const now = new Date();
      const pad = function (n) { return String(n).padStart(2, '0'); };
      const localNow = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      els.startDT.value = localNow;
      updateEmergencyNote();
    }

    const formData = await fetchFormData(idToken);
    populateLeaveTypes(formData.quotas);
    renderQuota(formData);
    // ตัดตัวเองออกจากรายชื่อผู้รับมอบงาน (เซิร์ฟเวอร์ยืนยันตัวตนจาก ID Token แล้ว)
    renderDelegateList(formData.employees || [], formData.me ? formData.me.empId : null);
    void profile;

    els.leaveType.addEventListener('change', highlightSelectedQuota);
    els.startDT.addEventListener('change', updateDaysPreview);
    els.endDT.addEventListener('change', updateDaysPreview);

    // 🆕 10 ส.ค. 2026 — ผู้ใช้มักสลับไปกดอนุมัติในแชทแล้วกลับมาที่ฟอร์มโดยไม่โหลดใหม่
    // ถ้าไม่ดึงซ้ำ ตัวเลขบนการ์ดจะค้างอยู่ที่ค่าตอนเปิดครั้งแรก
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      fetchFormData(idToken)
        .then(function (fresh) { renderQuota(fresh); })
        .catch(function () { /* ดึงซ้ำไม่สำเร็จ — คงค่าเดิมไว้ ไม่ต้องรบกวนผู้ใช้ */ });
    });

    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitLeaveRequest(idToken);
    });

    els.loading.classList.add('hidden');
    els.form.classList.remove('hidden');
  } catch (err) {
    els.loading.classList.add('hidden');
    showError('เกิดข้อผิดพลาด: ' + err.message);
  }
}

main();
