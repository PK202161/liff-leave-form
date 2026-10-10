// ====================================================================
// หน้า LIFF ขอสลับวันหยุด (Addendum G) — PK Technic
// เซิร์ฟเวอร์ (n8n WF-SWAP) ตัดสินกติกาทุกข้อ หน้านี้แค่ช่วยเลือกวันที่น่าจะผ่าน
// ====================================================================
const $id = function (x) { return document.getElementById(x); };
const DOW_TH = { Sun: 'อาทิตย์', Mon: 'จันทร์', Tue: 'อังคาร', Wed: 'พุธ', Thu: 'พฤหัสบดี', Fri: 'ศุกร์', Sat: 'เสาร์' };
let idToken = '', state = null;
const focusId = new URLSearchParams(location.search).get('id') || '';

function show(el, on) { el.classList.toggle('hidden', !on); }
function msg(kind, text) {
  show($id('errorMsg'), kind === 'error'); show($id('successMsg'), kind === 'success');
  if (kind) { $id(kind === 'error' ? 'errorMsg' : 'successMsg').textContent = text; window.scrollTo(0, 0); }
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function D(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }
function periodStart(s) {
  let y = +s.slice(0, 4), m = +s.slice(5, 7);
  if (+s.slice(8, 10) < 21) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + String(m).padStart(2, '0') + '-21';
}

async function call(action, extra) {
  const res = await fetch(CONFIG.SWAP_URL, {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ idToken: idToken, action: action, _ts: Date.now() }, extra || {}))
  });
  const raw = await res.text();
  try { return JSON.parse(raw); } catch (e) { return { ok: false, message: 'อ่านผลลัพธ์ไม่สำเร็จ (HTTP ' + res.status + ')' }; }
}

function itemHtml(s, mode) {
  let h = '<div class="sw-item' + (s.id === focusId ? ' focus' : '') + '">' +
    '<div class="who">' + esc(mode === 'approve' ? s.name : s.id) + '<span class="chip ' + esc(s.status) + '">' + esc(s.statusTh) + '</span></div>' +
    '<div class="line">มาทำงาน: ' + esc(s.workTh) + '</div>' +
    '<div class="line">หยุดแทน: ' + esc(s.offTh) + '</div>' +
    '<div class="line">เหตุผล: ' + esc(s.reason || '-') + '</div>' +
    (mode === 'approve' ? '<div class="line">เลขที่ ' + esc(s.id) + (s.dept ? ' · ' + esc(s.dept) : '') + '</div>' : '<div class="line">ผู้อนุมัติ: ' + esc(s.mgr) + '</div>') +
    (s.warn ? '<div class="warn">' + esc(s.warn) + '</div>' : '');
  if (mode === 'approve') {
    const isCancel = s.status === 'Cancel_Requested';
    h += '<div class="row-btns"><button data-act="approve" data-id="' + esc(s.id) + '">' + (isCancel ? 'อนุมัติยกเลิก' : 'อนุมัติ') + '</button>' +
      '<button class="no" data-act="reject" data-id="' + esc(s.id) + '">' + (isCancel ? 'ไม่ให้ยกเลิก' : 'ไม่อนุมัติ') + '</button></div>';
  } else if (s.canCancel) {
    h += '<div class="row-btns"><button class="cancel" data-act="cancel" data-id="' + esc(s.id) + '">' + (s.status === 'Approved' ? 'ขอยกเลิก (ต้องให้หัวหน้าอนุมัติ)' : 'ยกเลิกคำขอ') + '</button></div>';
  }
  return h + '</div>';
}

function render() {
  const r = state;
  $id('infoName').textContent = r.me.name + ' (' + r.me.id + ')';
  $id('infoOff').textContent = 'หยุดประจำ: ' + r.me.offDays.split(',').map(function (d) { return DOW_TH[d.trim()] || d; }).join(', ');
  $id('infoMgr').textContent = 'ผู้อนุมัติ: ' + r.me.manager;
  $id('infoRules').textContent = 'ยื่นล่วงหน้าอย่างน้อย ' + r.rules.notice + ' ชม. · สลับทั้งวัน · สองวันห่างกันไม่เกิน ' + r.rules.gap +
    ' วัน · ไม่เกิน ' + r.rules.perPeriod + ' ครั้งต่อรอบ 21–20';

  const approvals = r.approvals || [];
  show($id('approveCard'), approvals.length > 0);
  $id('approveList').innerHTML = approvals.map(function (s) { return itemHtml(s, 'approve'); }).join('');

  // คำขอที่เปิดจากการ์ดแต่ไม่ได้รออนุมัติจากเราแล้ว → บอกสถานะ
  if (focusId && r.focus && !approvals.some(function (s) { return s.id === focusId; }) && r.focus.emp !== r.me.id) {
    msg('success', 'คำขอ ' + r.focus.id + ' ของ ' + r.focus.name + ': ' + r.focus.statusTh);
  }

  const mine = r.mine || [];
  $id('mineList').innerHTML = mine.length ? mine.map(function (s) { return itemHtml(s, 'mine'); }).join('') : '<div class="hint">ยังไม่มีคำขอ</div>';

  const free = function (d) { return !d.hol && !d.fixed && !d.busy && d.notice; };
  const works = r.days.filter(function (d) { return !d.work && free(d); });
  $id('workDate').innerHTML = '<option value="">— เลือกวันหยุดที่จะมาทำงาน —</option>' +
    works.map(function (d) { return '<option value="' + d.d + '">' + esc(d.th) + '</option>'; }).join('');
  if (!works.length) $id('workDate').innerHTML = '<option value="">ไม่มีวันหยุดที่เลือกได้ใน 6 สัปดาห์ข้างหน้า</option>';
  fillOff();
}

function fillOff() {
  const r = state, w = $id('workDate').value, sel = $id('offDate');
  $id('offHint').textContent = '';
  if (!w) { sel.innerHTML = '<option value="">— เลือกวันมาทำงานก่อน —</option>'; sel.disabled = true; return; }
  const opts = r.days.filter(function (d) {
    return d.work && !d.hol && !d.fixed && !d.busy && d.notice && Math.abs(D(d.d) - D(w)) / 86400000 <= r.rules.gap;
  });
  sel.disabled = false;
  sel.innerHTML = '<option value="">— เลือกวันหยุดแทน —</option>' + opts.map(function (d) {
    const full = (r.used[periodStart(d.d)] || 0) >= r.rules.perPeriod;
    return '<option value="' + d.d + '"' + (full ? ' disabled' : '') + '>' + esc(d.th) + (full ? ' (ใช้สิทธิ์รอบนี้ครบแล้ว)' : '') + '</option>';
  }).join('');
  if (!opts.length) $id('offHint').textContent = 'ไม่มีวันทำงานที่เลือกได้ภายใน ' + r.rules.gap + ' วันจากวันที่เลือก';
}

async function reload() {
  const r = await call('me', { id: focusId });
  if (!r.ok) throw new Error(r.message || 'โหลดข้อมูลไม่สำเร็จ');
  state = r; render();
}

async function act(action, id, button) {
  const labels = { approve: 'ยืนยันอนุมัติ?', reject: 'ยืนยันไม่อนุมัติ?', cancel: 'ยืนยันยกเลิกคำขอนี้?' };
  if (!confirm(labels[action] || 'ยืนยัน?')) return;
  button.disabled = true; msg('', '');
  const r = action === 'cancel' ? await call('cancel', { id: id }) : await call('decide', { id: id, decision: action });
  if (r.ok) msg('success', r.message); else msg('error', r.message);
  await reload().catch(function (e) { msg('error', e.message); });
}

document.addEventListener('click', function (e) {
  const b = e.target.closest('button[data-act]');
  if (b) act(b.getAttribute('data-act'), b.getAttribute('data-id'), b);
});

async function main() {
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    idToken = liff.getIDToken();
    if (!idToken) throw new Error('ไม่ได้รับ ID Token — เปิดหน้านี้ผ่าน LINE อีกครั้ง');
    await reload();
    show($id('loadingMsg'), false); show($id('app'), true);
    if (focusId) { const f = document.querySelector('.focus'); if (f) f.scrollIntoView({ block: 'center' }); }
  } catch (e) {
    show($id('loadingMsg'), false); msg('error', e.message || String(e));
  }
  $id('workDate').addEventListener('change', fillOff);
  $id('swapForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = $id('submitBtn');
    const payload = { workDate: $id('workDate').value, offDate: $id('offDate').value, reason: $id('reason').value.trim() };
    if (!payload.workDate || !payload.offDate) { msg('error', 'เลือกวันให้ครบทั้งสองวัน'); return; }
    if (payload.reason.length < 3) { msg('error', 'กรุณาระบุเหตุผล'); return; }
    btn.disabled = true; btn.textContent = 'กำลังส่ง...'; msg('', '');
    try {
      const r = await call('submit', payload);
      if (r.ok) { msg('success', r.message); $id('reason').value = ''; await reload(); }
      else msg('error', r.message);
    } catch (err) { msg('error', 'ส่งไม่สำเร็จ: ' + err.message); }
    btn.disabled = false; btn.textContent = 'ส่งคำขอสลับวันหยุด';
  });
}
main();
