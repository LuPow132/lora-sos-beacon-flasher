/** Thai/English UI strings. Thai is the default; the choice persists in localStorage. */

export type Lang = "th" | "en";

// Thai is the source of truth: its shape defines Strings, so a key added here
// without an English counterpart is a compile error rather than a blank label.
const TH = {
    title: "LoRa SOS Beacon",
    subtitle: "อัปโหลดโค้ดลงบอร์ด T-Beam ผ่านเบราว์เซอร์ ไม่ต้องลงโปรแกรมอะไรเลย",
    tabFlash: "อัปโหลดโค้ด",
    tabMonitor: "ดูข้อมูลจากบอร์ด",

    step1: "ตั้งชื่อ Beacon",
    step1Hint: "ใช้ตัวอักษร A-Z และตัวเลข 0-9 ไม่เกิน 12 ตัว เช่น B01, TEAM3, BLUE",
    idPlaceholder: "เช่น B01",
    idErrEmpty: "กรุณาใส่ชื่อ Beacon",
    idErrChars: "ใช้ได้เฉพาะ A-Z และ 0-9 เท่านั้น (ห้ามเว้นวรรคหรือภาษาไทย)",
    idErrLong: "ยาวเกินไป ใช้ได้ไม่เกิน 12 ตัวอักษร",

    step2: "เสียบบอร์ดแล้วกดอัปโหลด",
    step2Hint: "เสียบบอร์ด T-Beam เข้ากับคอมพิวเตอร์ด้วยสาย USB แล้วกดปุ่มด้านล่าง",
    flashBtn: "เชื่อมต่อและอัปโหลด",
    flashBtnBusy: "กำลังทำงาน...",
    pickPort: "เลือกพอร์ตของบอร์ดในหน้าต่างที่เบราว์เซอร์เปิดขึ้นมา",

    advanced: "ตัวเลือกเพิ่มเติม",
    eraseAll: "ล้างข้อมูลในบอร์ดทั้งหมดก่อนอัปโหลด",
    eraseAllHint: "ใช้เมื่อบอร์ดมีปัญหาหรือเคยลง Meshtastic มาก่อน จะช้าขึ้นประมาณ 15 วินาที",

    stConnecting: "กำลังเชื่อมต่อกับบอร์ด...",
    stErasing: "กำลังล้างข้อมูลเดิม...",
    stWriting: "กำลังอัปโหลด",
    stResetting: "กำลังรีสตาร์ทบอร์ด...",
    stDone: "อัปโหลดสำเร็จ!",
    doneMsg: (id: string) => `บอร์ดนี้คือ Beacon "${id}" พร้อมใช้งานแล้ว`,
    goMonitor: "ดูข้อมูลจากบอร์ด",
    flashAnother: "อัปโหลดบอร์ดถัดไป",

    errNoPort: "ยังไม่ได้เลือกพอร์ต กรุณากดปุ่มอีกครั้งแล้วเลือกบอร์ดจากรายการ",
    errFailed: "อัปโหลดไม่สำเร็จ",
    errHint: "ลองดูวิธีแก้ด้านล่าง แล้วกดอัปโหลดใหม่อีกครั้ง",
    tsWrongChip: (got: string) => `บอร์ดที่เจอคือ ${got} ซึ่งไม่ใช่ ESP32 ของ T-Beam โค้ดนี้อาจใช้ไม่ได้`,
    tsContinue: "อัปโหลดต่อไป",
    tsCancel: "ยกเลิก",

    tsTitle: "ถ้าอัปโหลดไม่สำเร็จ ลองวิธีนี้",
    ts1: "ถอดสาย USB แล้วเสียบใหม่ จากนั้นกดอัปโหลดอีกครั้ง",
    ts2: "ปิดโปรแกรม Arduino IDE หรือหน้าต่างอื่นที่เปิดพอร์ตนี้อยู่ (เปิดพร้อมกันไม่ได้)",
    ts3: "ลองเปลี่ยนสาย USB — สายชาร์จบางเส้นมีแต่ไฟ ไม่มีสายข้อมูล",
    ts4: "ถ้าบอร์ดยังไม่ขึ้นในรายการ ให้กดปุ่มกลางบนบอร์ดค้างไว้ ขณะเสียบสาย USB",
    ts5: "ติ๊ก \"ล้างข้อมูลในบอร์ดทั้งหมด\" ในตัวเลือกเพิ่มเติม แล้วลองใหม่",

    monTitle: "ข้อมูลจากบอร์ด",
    monHint: "เสียบบอร์ดแล้วกดเชื่อมต่อ เพื่อดูสถานะ GPS และการส่งสัญญาณ SOS",
    monConnect: "เชื่อมต่อ",
    monDisconnect: "หยุด",
    monClear: "ล้างหน้าจอ",
    monSave: "บันทึกเป็นไฟล์",
    monAutoscroll: "เลื่อนตามอัตโนมัติ",
    monEmpty: "ยังไม่มีข้อมูล — กดเชื่อมต่อเพื่อเริ่มดู",
    monConnected: "เชื่อมต่อแล้ว",

    logTitle: "รายละเอียดทางเทคนิค",
    needChrome: "เบราว์เซอร์นี้ใช้ไม่ได้",
    needChromeMsg:
      "การอัปโหลดผ่านเว็บต้องใช้ Google Chrome, Microsoft Edge หรือ Opera บนคอมพิวเตอร์เท่านั้น " +
      "(Firefox, Safari และมือถือยังไม่รองรับ) กรุณาเปิดหน้านี้ใหม่ด้วย Chrome หรือ Edge",
    firmwareInfo: "เวอร์ชันเฟิร์มแวร์",
};

export type Strings = typeof TH;

const EN: Strings = {
    title: "LoRa SOS Beacon",
    subtitle: "Flash your T-Beam board straight from the browser — nothing to install",
    tabFlash: "Flash firmware",
    tabMonitor: "Serial monitor",

    step1: "Name your beacon",
    step1Hint: "Letters A-Z and digits 0-9, up to 12 characters. e.g. B01, TEAM3, BLUE",
    idPlaceholder: "e.g. B01",
    idErrEmpty: "Please enter a beacon name",
    idErrChars: "Only A-Z and 0-9 are allowed (no spaces or Thai characters)",
    idErrLong: "Too long — 12 characters maximum",

    step2: "Plug in the board and upload",
    step2Hint: "Connect the T-Beam to your computer with a USB cable, then press the button below",
    flashBtn: "Connect and upload",
    flashBtnBusy: "Working...",
    pickPort: "Choose your board in the window the browser just opened",

    advanced: "Advanced options",
    eraseAll: "Erase the whole board before uploading",
    eraseAllHint: "Use this if the board misbehaves or previously ran Meshtastic. Adds about 15 seconds.",

    stConnecting: "Connecting to the board...",
    stErasing: "Erasing existing data...",
    stWriting: "Uploading",
    stResetting: "Restarting the board...",
    stDone: "Upload complete!",
    doneMsg: (id: string) => `This board is now beacon "${id}" and is ready to use.`,
    goMonitor: "Open serial monitor",
    flashAnother: "Flash another board",

    errNoPort: "No port selected. Press the button again and pick your board from the list.",
    errFailed: "Upload failed",
    errHint: "Try the tips below, then upload again.",
    tsWrongChip: (got: string) => `Detected ${got}, which is not the ESP32 used by the T-Beam. This firmware may not work.`,
    tsContinue: "Upload anyway",
    tsCancel: "Cancel",

    tsTitle: "If the upload fails, try this",
    ts1: "Unplug the USB cable, plug it back in, and press upload again.",
    ts2: "Close Arduino IDE or anything else holding the port open — only one program can use it at a time.",
    ts3: "Try a different USB cable. Some charging cables carry power but no data.",
    ts4: "If the board never appears in the list, hold the middle button on the board while plugging in the USB cable.",
    ts5: "Tick \"Erase the whole board\" under Advanced options and try again.",

    monTitle: "Board output",
    monHint: "Plug in the board and press connect to watch GPS status and SOS transmissions.",
    monConnect: "Connect",
    monDisconnect: "Stop",
    monClear: "Clear",
    monSave: "Save to file",
    monAutoscroll: "Auto-scroll",
    monEmpty: "Nothing yet — press connect to start watching.",
    monConnected: "Connected",

    logTitle: "Technical details",
    needChrome: "This browser will not work",
    needChromeMsg:
      "Flashing from the browser requires Google Chrome, Microsoft Edge, or Opera on a desktop computer. " +
      "Firefox, Safari, and mobile browsers do not support it yet. Please reopen this page in Chrome or Edge.",
    firmwareInfo: "Firmware build",
};

const STRINGS: Record<Lang, Strings> = { th: TH, en: EN };

let current: Lang = (localStorage.getItem("lang") as Lang) ?? "th";
const listeners = new Set<() => void>();

export const t = (): Strings => STRINGS[current];
export const lang = (): Lang => current;

export function setLang(l: Lang) {
  current = l;
  localStorage.setItem("lang", l);
  document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void) {
  listeners.add(fn);
}
