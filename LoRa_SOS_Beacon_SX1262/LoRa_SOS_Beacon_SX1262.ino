/*
  LoRa SOS Beacon — T-Beam V1.2 (AXP2101) — เวอร์ชันชิป LoRa SX1262
  โปรเจกต์: LoRa SOS Relay Demo (หลักสูตร AIR)
  หน้าที่: อ่านปุ่มกด SOS + พิกัด GPS -> แพ็คข้อมูล -> ส่งผ่าน LoRa ไปยัง Receiver

  *** ใช้ไฟล์นี้เฉพาะบอร์ดที่ใช้ชิป LoRa รุ่น SX1262 เท่านั้น ***
  ถ้าบอร์ดใช้ชิป SX1276 ให้ใช้ไฟล์ LoRa_SOS_Beacon.ino (ตัวเดิม) แทน
  วิธีดูว่าบอร์ดเป็นชิปไหน: ลองอัปโหลดไฟล์ตัวเดิมก่อน ถ้าขึ้น
  "[SX1276] เริ่มต้นไม่สำเร็จ, error code -2" แปลว่าบอร์ดตัวนั้นเป็น SX1262
  ให้เปลี่ยนมาใช้ไฟล์นี้แทน

  ความแตกต่างจาก SX1276: ชิป SX1262 มีขาเพิ่มอีก 1 ขาชื่อ BUSY (GPIO 32)
  และไม่มีขา DIO0 (ขา DIO0 เดิมที่เคยใช้กับ SX1276 ไม่ได้ใช้กับ SX1262)
  ขา SPI, RST, DIO1, และการต่อสาย GPS/ปุ่ม SOS เหมือนเดิมทุกอย่าง ไม่ต้องเดินสายใหม่

  *** วิธีที่ง่ายที่สุด: ใช้เว็บอัปโหลด ไม่ต้องลง Arduino IDE / ไลบรารีใดๆ ***
  เปิดเว็บด้วย Chrome หรือ Edge บนคอมพิวเตอร์ -> พิมพ์รหัส Beacon -> กดปุ่มเดียวจบ
  เว็บจะเขียนรหัส Beacon ลงแฟลชให้เอง จึงไม่ต้องแก้โค้ดแล้วคอมไพล์ใหม่ทีละตัวอีกต่อไป
  (ด้านล่างนี้เป็นวิธีคอมไพล์เองด้วย Arduino IDE สำหรับคนที่อยากแก้โค้ดเพิ่ม)

  Libraries ที่ต้องติดตั้ง (Arduino IDE > Tools > Manage Libraries):
    - "RadioLib" โดย Jan Gromes
    - "XPowersLib" โดย lewisxhe
    - "TinyGPSPlus" โดย Mikal Hart
    - "ESP8266 and ESP32 OLED driver for SSD1306 displays" โดย ThingPulse

  Board (Tools > Board > ESP32 Arduino): "ESP32 Dev Module"
  Upload Speed: 921600 (ถ้าอัปโหลดไม่ผ่านให้ลด เป็น 115200)

  Wiring ปุ่มกด SOS:
    - ขาหนึ่งของปุ่มต่อ GPIO 14
    - อีกขาต่อ GND

  Wiring โมดูล GPS ภายนอก (GY-NEO-M8N) — บัดกรีถาวรแล้ว:
    - VCC ของโมดูล -> ขา 3.3V บนบอร์ด T-Beam
    - GND ของโมดูล -> ขา GND บนบอร์ด T-Beam
    - TX ของโมดูล  -> ขา GPIO 15 บนบอร์ด T-Beam (คือ GPS_RX_PIN ด้านล่าง)
    - RX ของโมดูล  -> ขา GPIO 13 บนบอร์ด T-Beam (คือ GPS_TX_PIN ด้านล่าง)
  (ไม่ได้ใช้โมดูล GPS NEO-6M ที่ติดมากับบอร์ดเดิมแล้ว แต่โค้ดยังเปิดไฟเลี้ยงให้ ALDO3 ไว้ ไม่เป็นอันตราย)

  หมายเหตุ GPS: ต้องอยู่กลางแจ้งหรือใกล้หน้าต่างที่เห็นท้องฟ้า ถึงจะจับดาวเทียมได้
  ครั้งแรกที่เปิดเครื่อง (Cold start) อาจใช้เวลา 30 วินาที ถึงหลายนาที กว่าจะ Fix ตำแหน่งได้
  ถ้ากดปุ่ม SOS ก่อนที่ GPS จะ Fix ได้ ระบบจะส่งไปโดยไม่มีพิกัด (ทำเครื่องหมาย NOFIX)
*/

#include <SPI.h>
#include <Wire.h>
#include <RadioLib.h>
#define XPOWERS_CHIP_AXP2101
#include <XPowersLib.h>
#include <TinyGPSPlus.h>
#include "SSD1306Wire.h"
#include <esp_partition.h>

// ---------- ตั้งค่าประจำ Beacon ตัวนี้ ----------
// รหัส Beacon ไม่ได้ฝังอยู่ในโค้ดแล้ว แต่อ่านจากแฟลชตอนเปิดเครื่อง (ดู loadBeaconId ด้านล่าง)
// เว็บอัปโหลดจะเป็นคนเขียนค่านี้ลงบอร์ดให้ ไม่ต้องแก้โค้ดแล้วคอมไพล์ใหม่อีกต่อไป
// ค่าด้านล่างเป็นค่าสำรอง ใช้เมื่อยังไม่เคยตั้งรหัสผ่านเว็บ (หรือข้อมูลในแฟลชเสีย)
#define BEACON_ID_FALLBACK "BLUE"
#define SOS_BUTTON_PIN     14        // ขา GPIO ที่ต่อปุ่มกด SOS

// ---------- Pin ของบอร์ด T-Beam V1.2 (AXP2101) — ยืนยันจาก LilyGO/Meshtastic official example ----------
#define I2C_SDA            21
#define I2C_SCL            22
#define RADIO_SCLK_PIN      5
#define RADIO_MISO_PIN     19
#define RADIO_MOSI_PIN     27
#define RADIO_CS_PIN       18
#define RADIO_RST_PIN      23
#define RADIO_DIO1_PIN     33        // SX1262: ขา IRQ (เดิมใช้เป็น DIO1 กับ SX1276 ด้วย)
#define RADIO_BUSY_PIN     32        // SX1262: ขา BUSY (ไม่มีในชิป SX1276 จึงไม่เคยใช้ขานี้มาก่อน)
#define BOARD_LED           4
#define GPS_RX_PIN         15        // ต่อกับขา TX ของโมดูล GPS (บัดกรีถาวรแล้ว)
#define GPS_TX_PIN         13        // ต่อกับขา RX ของโมดูล GPS (บัดกรีถาวรแล้ว)
#define GPS_BAUD_RATE      9600

// ---------- ความถี่ LoRa: 923MHz ตามย่านที่ กสทช. อนุญาตในไทย ----------
#define LORA_FREQ          923.0
#define LORA_OUTPUT_POWER  14        // dBm (ปรับได้ 2-22 สำหรับ SX1262, เริ่มจากค่าต่ำก่อนแล้วค่อยเพิ่มถ้าจำเป็น)

XPowersPMU pmu;
SX1262 radio = new Module(RADIO_CS_PIN, RADIO_DIO1_PIN, RADIO_RST_PIN, RADIO_BUSY_PIN);
HardwareSerial GPSSerial(1);
TinyGPSPlus gps;
SSD1306Wire display(0x3c, I2C_SDA, I2C_SCL);

uint32_t seqNumber = 0;
uint32_t lastPressTime = 0;
const uint32_t DEBOUNCE_MS = 300;

uint32_t lastGPSDebug = 0;
const uint32_t GPS_DEBUG_INTERVAL = 5000;
uint32_t gpsRawByteCount = 0;   // นับไบต์ดิบที่ได้รับจากโมดูล GPS สะสมตั้งแต่เปิดเครื่อง

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

void setupPeripheralPower()
{
    // เปิดใช้งาน PMU AXP2101 ผ่าน I2C — จำเป็นมาก ถ้าข้ามขั้นตอนนี้ LoRa/GPS จะไม่ได้รับไฟเลย
    bool ok = pmu.begin(Wire, AXP2101_SLAVE_ADDRESS, I2C_SDA, I2C_SCL);
    if (!ok) {
        Serial.println("[AXP2101] เริ่มต้นไม่สำเร็จ! ตรวจสอบว่าบอร์ดเป็น AXP2101 (V1.2) จริง");
        while (true) delay(10);
    }
    // คำเตือน: ห้ามยุ่งกับ DCDC1 เพราะเป็นไฟเลี้ยงหลักของ ESP32

    // ALDO2 = ไฟเลี้ยง LoRa (3.3V)
    pmu.setALDO2Voltage(3300);
    pmu.enableALDO2();

    // ALDO3 = ไฟเลี้ยง GPS/GNSS ตัวเดิมบนบอร์ด (3.3V) — ตอนนี้ใช้ขา 15/13 กับโมดูลภายนอกแล้ว
    // ไม่ชนกับขา 34/12 ของโมดูลเดิมอีกต่อไป จึงเปิดไฟเลี้ยงตามปกติได้ (ไม่ได้ใช้งานโมดูลเดิม แต่เปิดทิ้งไว้ไม่เป็นอันตราย)
    pmu.setALDO3Voltage(3300);
    pmu.enableALDO3();

    pmu.setChargerConstantCurr(XPOWERS_AXP2101_CHG_CUR_500MA);
}

void showStatus(String line1, String line2, String line3)
{
    display.clear();
    display.setTextAlignment(TEXT_ALIGN_LEFT);
    display.setFont(ArialMT_Plain_16);
    display.drawString(0, 0, line1);
    display.setFont(ArialMT_Plain_10);
    display.drawString(0, 20, line2);
    display.drawString(0, 34, line3);
    display.display();
}

void readGPS()
{
    // อ่านข้อมูลดิบจาก GPS ทีละไบต์ ป้อนให้ TinyGPS++ ถอดรหัสไปเรื่อยๆ ตลอดการทำงาน
    while (GPSSerial.available() > 0) {
        gpsRawByteCount++;
        gps.encode(GPSSerial.read());
    }

    // Debug: พิมพ์สถานะ GPS ทุก 5 วินาที เพื่อดูว่ากำลังหาสัญญาณอยู่หรือ Fix แล้ว
    // "ไบต์ดิบที่ได้รับ" ใช้แยกปัญหา: ถ้าเลขนี้เป็น 0 ตลอด = โมดูล GPS ไม่ส่งข้อมูลมาเลย (ปัญหาไฟ/สาย)
    //                                  ถ้าเลขนี้เพิ่มขึ้นเรื่อยๆ = โมดูลทำงานอยู่ แค่ยังจับดาวเทียมไม่ได้
    if (millis() - lastGPSDebug > GPS_DEBUG_INTERVAL) {
        lastGPSDebug = millis();
        Serial.print("[GPS] ไบต์ดิบที่ได้รับ: ");
        Serial.print(gpsRawByteCount);
        Serial.print(" | ดาวเทียมที่จับได้: ");
        Serial.print(gps.satellites.value());
        Serial.print(" | สถานะ: ");
        Serial.println(gps.location.isValid() ? "FIX แล้ว" : "ยังไม่ FIX");

        if (gpsRawByteCount == 0) {
            Serial.println("[GPS] คำเตือน: ยังไม่มีข้อมูลจากโมดูล GPS เข้ามาเลย ตรวจสอบไฟเลี้ยง/ตัวโมดูล");
        }

        // แสดงสถานะ GPS บนจอ OLED ด้วย (จะถูกทับชั่วคราวตอนกดปุ่ม SOS แล้วกลับมาแสดงแบบนี้เองภายใน 5 วินาที)
        String satLine = "ดาวเทียม: " + String(gps.satellites.value());
        String fixLine = gps.location.isValid() ? "GPS: FIX แล้ว" : "GPS: กำลังหา...";
        showStatus("SOS Beacon " + String(beaconId), satLine, fixLine);
    }
}

void sendSOS()
{
    seqNumber++;

    String lat = "0.000000";
    String lon = "0.000000";
    String fixStatus = "NOFIX";

    if (gps.location.isValid()) {
        lat = String(gps.location.lat(), 6);
        lon = String(gps.location.lng(), 6);
        fixStatus = "FIX";
    }

    String payload = "SOS|" + String(beaconId) + "|" + String(seqNumber)
                      + "|" + lat + "|" + lon + "|" + fixStatus;

    Serial.print("[SX1262] กำลังส่ง: ");
    Serial.println(payload);

    digitalWrite(BOARD_LED, HIGH);
    int state = radio.transmit(payload);
    digitalWrite(BOARD_LED, LOW);

    if (state == RADIOLIB_ERR_NONE) {
        Serial.println("[SX1262] ส่งสำเร็จ");
        showStatus("ส่งสำเร็จ! #" + String(seqNumber),
                    fixStatus == "FIX" ? "มีพิกัด GPS" : "ไม่มีพิกัด (NOFIX)",
                    "");
    } else {
        Serial.print("[SX1262] ส่งไม่สำเร็จ, error code ");
        Serial.println(state);
        showStatus("ส่งไม่สำเร็จ!", "error code " + String(state), "");
    }
}

void setup()
{
    Serial.begin(115200);
    delay(500);
    loadBeaconId();
    Serial.println("=== LoRa SOS Beacon (SX1262): " + String(beaconId) + " ===");

    pinMode(BOARD_LED, OUTPUT);
    pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

    SPI.begin(RADIO_SCLK_PIN, RADIO_MISO_PIN, RADIO_MOSI_PIN);
    setupPeripheralPower();

    // จอ OLED ใช้บัส I2C เดียวกับ PMU (21/22) — เริ่มหลัง PMU พร้อมแล้ว
    display.init();
    display.flipScreenVertically();
    showStatus("SOS Beacon " + String(beaconId), "กำลังเริ่มต้น...", "");

    GPSSerial.begin(GPS_BAUD_RATE, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.println("[GPS] เริ่มรอสัญญาณดาวเทียม (ต้องอยู่กลางแจ้ง/ใกล้หน้าต่าง อาจใช้เวลาสักครู่)");

    int state = radio.begin(LORA_FREQ);
    if (state != RADIOLIB_ERR_NONE) {
        Serial.print("[SX1262] เริ่มต้นไม่สำเร็จ, error code ");
        Serial.println(state);
        Serial.println("ตรวจสอบ: สาย SPI/PMU หรือความถี่ที่รองรับของโมดูล LoRa");
        showStatus("LoRa ERROR", "code: " + String(state), "");
        while (true) delay(10);
    }
    radio.setOutputPower(LORA_OUTPUT_POWER);

    Serial.println("[SX1262] พร้อมใช้งาน — กดปุ่ม SOS เพื่อส่งสัญญาณ");
    showStatus("SOS Beacon " + String(beaconId), "รอสัญญาณ GPS...", "กดปุ่ม SOS ได้เลย");
}

void loop()
{
    readGPS();

    // ปุ่มต่อกับ GND แบบ INPUT_PULLUP -> กดแล้วขาจะเป็น LOW
    if (digitalRead(SOS_BUTTON_PIN) == LOW) {
        uint32_t now = millis();
        if (now - lastPressTime > DEBOUNCE_MS) {
            lastPressTime = now;
            sendSOS();
        }
    }
}
