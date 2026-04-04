# 📋 Discord Case Counter Bot

บอท Discord สำหรับนับจำนวนการโพสต์และการถูกแท็ก (Tag) พร้อมระบบส่งออกข้อมูลเป็นไฟล์ Excel อัตโนมัติ

---

## ✨ ความสามารถของบอท (Features)
- 📊 **นับข้อมูลย้อนหลัง**: สแกนหาข้อความใน Channel เพื่อสรุปยอดการทำงาน
- 🏷️ **แยกประเภทข้อมูล**: นับทั้งจำนวนโพสต์ที่มีเนื้อหา/ไฟล์แนบ และจำนวนครั้งที่ถูกแท็ก
- 📁 **ส่งออก Excel**: สรุปผลลัพธ์เป็นไฟล์ `.xlsx` เพื่อนำไปใช้งานต่อได้ทันที
- 🛡️ **ระบบกรองคำสั่ง**: ไม่นับรวมข้อความที่เป็นคำสั่งเปิดบอท (Prefix `!`)

---

## 🛠️ ความต้องการระบบ (Prerequisites)
- [Node.js](https://nodejs.org/) (แนะนำเวอร์ชัน 16 ขึ้นไป)
- บัญชี [Discord Developer Portal](https://discord.com/developers/applications)

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Installation)

1. **ติดตั้ง Dependencies**:
   ```bash
   npm install discord.js exceljs
   ```

2. **ตั้งค่า Bot Token**:
   แก้ไขไฟล์ `index.js` และใส่ Token ของคุณในบรรทัดที่ 5:
   ```javascript
   const TOKEN = 'YOUR_DISCORD_BOT_TOKEN_HERE';
   ```

3. **รันบอท**:
   ```bash
   node index.js
   ```

---

## ⚠️ การตั้งค่าที่สำคัญ (Critical Setup)

เพื่อให้บอทสามารถดึงชื่อสมาชิก (Nickname) และอ่านข้อความได้ถูกต้อง คุณ **ต้อง** เปิดใช้งาน **Intents** ใน Discord Developer Portal ดังนี้:

1. เข้าไปที่เมนู **Bot** ของ Application ของคุณ
2. เลื่อนลงมาที่หัวข้อ **Privileged Gateway Intents**
3. **เปิดใช้งาน (On)** หัวข้อดังต่อไปนี้:
   - ✅ **Presence Intent** (แนะนำ)
   - ✅ **Server Members Intent** (จำเป็นสำหรับดึงชื่อเล่น)
   - ✅ **Message Content Intent** (จำเป็นสำหรับอ่านข้อความ)
4. กด **Save Changes**

---

## 💬 วิธีการใช้งานบอท (Commands)

| คำสั่ง | คำอธิบาย |
| :--- | :--- |
| `!getM` | รวบรวมรายชื่อเล่นของสมาชิคใน Discord |
| `!countCase` | เริ่มกระบวนการนับข้อมูลใน Channel ปัจจุบัน และส่งไฟล์ Excel สรุปผล |
| `!countSelf` | นับ Case เฉพาะคนพิมพ์และแจ้งผล |
---

## 📝 โครงสร้างรายงาน (Report Structure)
รายงานจะประกอบด้วย:
- **Name**: ชื่อแสดงผลใน Server (DisplayName/Nickname)
- **Posts**: จำนวนข้อความที่มีการ mention หรือมีไฟล์แนบ
- **Tagged**: จำนวนครั้งที่สมาชิกคนนั้นถูกแท็ก
- **Sum**: ผลรวมทั้งหมดของการทำงาน

---

## 📂 ไฟล์งาน
- `index.js`: ไฟล์หลักที่ใช้รันบอท
- `report.xlsx`: ไฟล์รายงานที่จะถูกสร้างขึ้นเมื่อใช้คำสั่ง (ถูกสร้างอัตโนมัติ)

---
> [!TIP]
> หากบอทแสดงชื่อเป็น Username ปกติแทนที่จะเป็นชื่อเล่น ให้ตรวจสอบว่าได้เปิด **Server Members Intent** แล้วหรือยังในหน้า Developer Portal ครับ
