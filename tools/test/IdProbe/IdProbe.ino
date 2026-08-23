/*
  IdProbe — ตัวทดสอบ pipeline ของเว็บอัปโหลด (สำหรับบอร์ด ESP32-S3 เท่านั้น)

  สเก็ตช์นี้ไม่เกี่ยวกับ LoRa/GPS เลย มีไว้เพื่อพิสูจน์ว่า:
    1. เว็บอัปโหลดเขียนเฟิร์มแวร์ลงบอร์ดได้จริง
    2. เว็บเขียน "รหัส Beacon" ลงแฟลชได้ถูกตำแหน่งและถูกรูปแบบ
    3. เฟิร์มแวร์อ่านรหัสนั้นกลับมาได้
    4. หน้าจอ Serial Monitor บนเว็บอ่านข้อความ (รวมทั้งภาษาไทย) ได้ถูกต้อง

  ใช้ตอนที่ยังไม่มีบอร์ด T-Beam อยู่ในมือ — ทดสอบได้ทุกอย่างยกเว้นตัวอุปกรณ์ LoRa/GPS

  *** ฟังก์ชัน loadBeaconId() ด้านล่างต้องเหมือนกับใน LoRa_SOS_Beacon_SX1262.ino ทุกตัวอักษร ***
  ถ้าแก้ที่ใดที่หนึ่งต้องแก้อีกที่ด้วย — สคริปต์ tools/build-firmware.mjs จะเช็คให้อัตโนมัติ
  และหยุด build ทันทีถ้าสองไฟล์นี้ไม่ตรงกัน
*/

#include <esp_partition.h>

#define BEACON_ID_FALLBACK "BLUE"

// ---------- รหัส Beacon ที่อ่านมาจากแฟลช ----------
// เว็บอัปโหลดจะเขียนข้อมูลก้อนหนึ่งลงพาร์ทิชัน spiffs (สเก็ตช์นี้ไม่ได้ใช้ spiffs อยู่แล้ว)
// รูปแบบ: "TBSOSID1" (8 ไบต์) + ความยาว (1 ไบต์) + ตัวอักษร A-Z 0-9 สูงสุด 12 ไบต์
#define BEACON_ID_MAGIC    "TBSOSID1"
#define BEACON_ID_MAX_LEN  12

char beaconId[BEACON_ID_MAX_LEN + 1] = BEACON_ID_FALLBACK;

void loadBeaconId()
{
    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_SPIFFS, NULL);
    if (part == NULL) return;                         // ไม่เจอพาร์ทิชัน -> ใช้ค่าสำรอง

    uint8_t buf[9 + BEACON_ID_MAX_LEN];
    if (esp_partition_read(part, 0, buf, sizeof(buf)) != ESP_OK) return;
    if (memcmp(buf, BEACON_ID_MAGIC, 8) != 0) return; // ยังไม่เคยตั้งรหัสผ่านเว็บ

    uint8_t len = buf[8];
    if (len < 1 || len > BEACON_ID_MAX_LEN) return;   // ความยาวผิดปกติ -> ใช้ค่าสำรอง

    // ยอมรับเฉพาะ A-Z และ 0-9 เพื่อไม่ให้ payload ที่คั่นด้วย "|" เสียรูป
    for (uint8_t i = 0; i < len; i++) {
        char c = (char)buf[9 + i];
        if (!((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))) return;
    }

    memcpy(beaconId, buf + 9, len);
    beaconId[len] = '\0';
}

// ---------- ส่วนที่มีเฉพาะในตัวทดสอบ ----------

void dumpRawSector()
{
    const esp_partition_t *part = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_SPIFFS, NULL);
    if (part == NULL) {
        Serial.println("[IdProbe] ไม่พบพาร์ทิชัน spiffs");
        return;
    }
    Serial.printf("[IdProbe] พาร์ทิชัน spiffs อยู่ที่ 0x%06X ขนาด 0x%06X\n", part->address, part->size);

    uint8_t buf[24];
    if (esp_partition_read(part, 0, buf, sizeof(buf)) != ESP_OK) {
        Serial.println("[IdProbe] อ่านแฟลชไม่สำเร็จ");
        return;
    }
    Serial.print("[IdProbe] ไบต์ดิบ 24 ตัวแรก:");
    for (uint8_t i = 0; i < sizeof(buf); i++) Serial.printf(" %02X", buf[i]);
    Serial.println();
}

void setup()
{
    Serial.begin(115200);
    delay(2000);   // รอให้ USB CDC พร้อมก่อน ไม่งั้นข้อความแรกๆ จะหาย

    Serial.println();
    Serial.println("=== IdProbe: ตัวทดสอบ pipeline ของเว็บอัปโหลด ===");
    dumpRawSector();

    loadBeaconId();

    Serial.print("[IdProbe] รหัส Beacon ที่อ่านได้: ");
    Serial.println(beaconId);
    Serial.println(strcmp(beaconId, BEACON_ID_FALLBACK) == 0
                       ? "[IdProbe] คำเตือน: ใช้ค่าสำรอง แปลว่ายังไม่เคยตั้งรหัสผ่านเว็บ"
                       : "[IdProbe] ส่งสำเร็จ: อ่านรหัสจากแฟลชได้ถูกต้อง");
}

void loop()
{
    // พิมพ์ซ้ำทุกวินาที เพื่อให้กดเชื่อมต่อ Serial Monitor ตอนไหนก็เห็นผลทันที
    Serial.println("[IdProbe] beaconId = " + String(beaconId));
    delay(1000);
}
