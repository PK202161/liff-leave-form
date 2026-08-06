# หน้าฟอร์มยื่นใบลา (LIFF) — Deploy ผ่าน GitHub Pages

โฟลเดอร์นี้คือเว็บสถิต (static site) ล้วน — HTML/CSS/JS ไม่มี build step ไม่มี backend
ใช้ LIFF SDK ของ LINE เชื่อมกับ n8n โดยตรง

## โครงสร้างไฟล์

```
index.html   หน้าฟอร์ม
style.css    ดีไซน์
app.js       ตรรกะ: login, โหลดรายชื่อผู้รับมอบงาน, ส่งคำขอลา
config.js    ค่าที่แก้ได้ (LIFF_ID + URL ปลายทาง n8n) — เปิดเผยได้ ไม่มีความลับ
```

## ขั้นตอนที่ 1 — push ขึ้น GitHub

โฟลเดอร์นี้ **git init และ commit แรกให้เรียบร้อยแล้ว** (branch ชื่อ `master`)
เหลือแค่สร้าง repo เปล่าบน GitHub แล้วต่อ remote + push จากเครื่องคุณเอง
(รันคำสั่งด้านล่างในเทอร์มินัลบนเครื่องคุณ ที่ล็อกอิน GitHub ไว้แล้ว หรือใช้ GitHub Desktop)

> ⚠️ ถ้าเปิดโฟลเดอร์นี้แล้วเห็นไฟล์ `.git` แปลกๆ ค้างอยู่ (เช่นไฟล์ `.lock`) ไม่ต้องกังวล —
> เป็นเศษไฟล์จากตอนที่ผมรันคำสั่งผ่านเครือข่ายแล้ว lock ค้าง ลบไม่ได้จากฝั่งนั้น
> แต่ repo ยังใช้งานได้ปกติ (มี commit แรกอยู่แล้ว) ถ้าอยากเคลียร์ให้สะอาด ลบไฟล์ `.lock`
> พวกนั้นทิ้งได้เลยจาก File Explorer ก่อน push (ไม่ลบ `.git` ทั้งโฟลเดอร์)

เปลี่ยน `<YOUR_GITHUB_USERNAME>` เป็นบัญชี GitHub ของคุณ/บริษัท

```bash
cd liff-leave-form

# (ทางเลือก) เปลี่ยนชื่อ branch จาก master เป็น main ให้ตรงกับค่าเริ่มต้นของ GitHub ปัจจุบัน
git branch -m main

# ไปสร้าง repo เปล่าที่ https://github.com/new ก่อน
#   - ตั้งชื่อ เช่น pk-leave-liff
#   - เลือก Public (จำเป็นสำหรับ GitHub Pages ฟรี)
#   - ห้ามติ๊ก "Add a README" (จะชนกับของเรา)

git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/pk-leave-liff.git
git push -u origin main
```

## ขั้นตอนที่ 2 — เปิด GitHub Pages

1. เข้า repo บน GitHub → แท็บ **Settings** → เมนูซ้าย **Pages**
2. ใต้ **Build and deployment** → Source เลือก **Deploy from a branch**
3. Branch เลือก **main** / โฟลเดอร์ **/ (root)** → **Save**
4. รอ 1–2 นาที จะได้ URL รูปแบบ:
   ```
   https://<YOUR_GITHUB_USERNAME>.github.io/pk-leave-liff/
   ```
5. เปิด URL นี้ในเบราว์เซอร์ปกติ (ยังไม่ผ่าน LINE) — ควรเห็นข้อความ
   **"ฟอร์มนี้ยังตั้งค่าไม่เสร็จ"** (ถูกต้องแล้ว เพราะยังไม่ได้ใส่ LIFF ID)

## ขั้นตอนที่ 3 — สร้าง LIFF App ใน LINE Developers Console

ทำตาม `Setup_LINE_OA_LIFF_Checklist.md` หัวข้อ 3 โดยใช้ **Endpoint URL** เป็น URL จากขั้นตอนที่ 2 ข้างบน
(ต้องมี `/` ปิดท้ายหรือไม่ก็ได้ แต่ต้องตรงกับที่ GitHub Pages เสิร์ฟจริง)

จะได้ค่า 2 ตัว:
- **LIFF ID** (แท็บ LIFF)
- **Channel ID** (แท็บ Basic settings)

## ขั้นตอนที่ 4 — กรอกค่ากลับเข้าไฟล์และ n8n

1. แก้ `config.js` → `LIFF_ID: 'REPLACE_WITH_LIFF_ID'` เป็น LIFF ID จริง แล้ว commit + push อีกครั้ง:
   ```bash
   git add config.js
   git commit -m "Set LIFF ID"
   git push
   ```
2. เปิด n8n → workflow **WF-LEAVE-SUBMIT** → โหนด **Verify ID Token** → พารามิเตอร์ `client_id`
   แทนที่ placeholder ด้วย **Channel ID** จริง
3. เปิด workflow **WF-LEAVE-EMPLOYEE-LIST** → โหนด **Verify ID Token** → ทำแบบเดียวกัน (Channel ID เดียวกัน)
4. Activate ทั้งสอง workflow ถ้ายังไม่ได้ activate

## ขั้นตอนที่ 5 — ทดสอบใน LINE จริง

เปิดผ่าน Rich Menu หรือพิมพ์ลิงก์ `https://liff.line.me/<LIFF ID>?mode=normal` ในแชท OA
(ทดสอบตามข้อ 6.1–6.7 ใน `Setup_LINE_OA_LIFF_Checklist.md`)

## หมายเหตุความปลอดภัย

- `config.js` เปิดเผยได้ทั้งหมด — ไม่มี Channel Secret / Access Token อยู่ในโค้ด client เด็ดขาด
- ฝั่งเซิร์ฟเวอร์ (n8n) ไม่เชื่อ `line_user_id`/`empId` ใดๆ ที่ client ส่งมาโดยตรง
  ใช้ `idToken` ที่ LINE เซ็นมาเท่านั้นในการยืนยันตัวตนทุกครั้ง (ตาม Blueprint §6)
