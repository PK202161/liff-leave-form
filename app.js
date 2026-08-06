// ====================================================================
// ฟอร์มยื่นใบลา — ตรรกะฝั่ง client
// อ่าน mode จาก query string: ?mode=normal | ?mode=intraday
// ====================================================================

const qs = new URLSearchParams(window.location.search);
const mode = qs.get('mode') || 'normal';

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
  isEmergency: document.getElementById('isEmergency'),
  emergencyRow: document.getElementById('emergencyRow'),
  delegateList: document.getElementById('delegateList'),
  submitBtn: document.getElementById('submitBtn')
};

function showError(msg) {
  els.error.textContent = msg;
  els.error.classList.remove('hidden');
}

function hideError() {
  els.error.classList.add('hidden');
}

function populateLeaveTypes() {
  CONFIG.LEAVE_TYPES.forEach(function (t) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    els.leaveType.appendChild(opt);
  });
}

function updateDaysPreview() {
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
  const msPerDay = 24 * 60 * 60 * 1000;
  const rawDays = Math.floor((new Date(end.toDateString()) - new Date(start.toDateString())) / msPerDay) + 1;
  els.daysPreview.textContent = 'ประมาณ ' + rawDays + ' วันตามปฏิทิน (ระบบจะคำนวณวันทำงานจริงหลังกดส่ง ตามวันหยุดของคุณ)';
}

async function fetchEmployeeList(idToken) {
  const url = CONFIG.EMPLOYEE_LIST_URL + '?idToken=' + encodeURIComponent(idToken);
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(function () { return { ok: false, message: 'อ่านข้อมูลพนักงานไม่สำเร็จ' }; });
  if (!res.ok || !data.ok) {
    throw new Error(data.message || 'โหลดรายชื่อพนักงานไม่สำเร็จ');
  }
  return data.employees || [];
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
    delegateEmpId: delegates.join(','),
    isEmergency: !!els.isEmergency.checked
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

    populateLeaveTypes();

    if (mode === 'intraday') {
      els.isEmergency.checked = true;
    }

    const employees = await fetchEmployeeList(idToken);
    renderDelegateList(employees, null); // ไม่ทราบ Emp_ID ฝั่ง client เชื่อถือไม่ได้ จึงแสดงทุกคน ให้ผู้ใช้เลือกเอง (เซิร์ฟเวอร์จะตรวจซ้ำ)
    void profile;

    els.startDT.addEventListener('change', updateDaysPreview);
    els.endDT.addEventListener('change', updateDaysPreview);

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
