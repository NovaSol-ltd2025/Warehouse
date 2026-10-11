/**
 * ============================================================================
 * NOVASOL Warehouse — Google Sheet เป็นฐานข้อมูล (REST API ผ่าน Apps Script)
 * ห้างหุ้นส่วนจำกัด โนวาโซล
 * ----------------------------------------------------------------------------
 * วิธีใช้ (ทำครั้งเดียว):
 *  1. เปิด Google Sheet > ส่วนขยาย > Apps Script แล้ววางโค้ดนี้ทับ Code.gs
 *  2. เลือกฟังก์ชัน setupDatabase แล้วกด เรียกใช้ (Run) และกดยอมรับสิทธิ์
 *  3. ดูรหัส API Token จากหน้าต่างที่แสดง (หรือเมนู NOVASOL > ดูรหัส API Token)
 *  4. ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > เว็บแอป
 *       ดำเนินการในฐานะ: ฉัน | ผู้มีสิทธิ์เข้าถึง: ทุกคน (Anyone)
 *  5. คัดลอก Web App URL + API Token ไปใส่ในแอป (ปุ่ม Google Sheet มุมบนขวา)
 *
 * โครงสร้างข้อมูล: 1 คอลเลกชัน = 1 แท็บ ชื่อ DB_<collection>
 *   คอลัมน์ A = id, B = วันที่แก้ไขล่าสุด, C..J = ข้อมูลเต็มของแถว (JSON แบ่งเป็นก้อน)
 *   คอลัมน์ K เป็นต้นไป = ค่าสรุปสำหรับให้คนอ่าน/กรอง/ทำรายงาน (แอปไม่อ่านกลับ)
 * ข้อควรระวัง: แอปอ่านข้อมูลจากคอลัมน์ C..J เท่านั้น การแก้ตัวเลขในคอลัมน์ K+
 * จะไม่มีผลกับแอป ให้แก้ผ่านแอปแทน
 * ============================================================================
 */

var TAB_PREFIX = 'DB_';
var CHUNK_COLS = 8;          // จำนวนคอลัมน์ JSON
var CHUNK_SIZE = 40000;      // ตัวอักษรต่อเซลล์ (ขีดจำกัดของ Google Sheets คือ 50,000)
var CHUNK_PREFIX = 'j';

// คอลัมน์สรุปของแต่ละคอลเลกชัน (ชื่อไทย: คีย์)
var COLLECTIONS = {
  items: [
    ['รหัสสินค้า', 'code'], ['รายการ', 'name'], ['หมวดหมู่', 'category'], ['หน่วย', 'unit'],
    ['ราคาปัจจุบัน', 'unitPrice'], ['ราคาฐาน', 'baselinePrice'], ['สต็อกคงเหลือ', 'currentStockHQ'],
    ['จุดเตือน', 'minStockThreshold'], ['จำนวนสั่งซ้ำ', 'reorderQuantity'], ['ส่งมอบ(วัน)', 'leadTimeDays'],
    ['ซัพพลายเออร์', 'supplierId'], ['หมายเหตุ', 'notes']
  ],
  suppliers: [
    ['ชื่อ', 'name'], ['ผู้ติดต่อ', 'contactPerson'], ['โทร', 'phone'], ['อีเมล', 'email'],
    ['สั่งขั้นต่ำ', 'minOrderAmount'], ['ส่งมอบ(วัน)', 'deliveryLeadTime']
  ],
  branches: [
    ['รหัสสาขา', 'code'], ['ชื่อสาขา', 'name'], ['ที่อยู่', 'address'], ['ผู้ติดต่อ', 'contactPerson'],
    ['โทร', 'phone'], ['ผู้รับสินค้า', 'defaultRecipientName']
  ],
  branch_orders: [
    ['เลขที่ใบส่งของ', 'deliveryOrderNo'], ['วันที่', 'date'], ['สาขา', 'branchName'], ['รายการ', 'items'],
    ['ยอดรวม', 'totalAmount'], ['รูปแบบจัดส่ง', 'routingType'], ['สถานะ', 'status'],
    ['ผู้รับ', 'receiverName'], ['ผู้ส่ง', 'senderName'], ['หมายเหตุ', 'notes']
  ],
  purchase_orders: [
    ['เลขที่ PO', 'poNumber'], ['วันที่สั่ง', 'orderDate'], ['กำหนดส่งมอบ', 'expectedDeliveryDate'],
    ['ซัพพลายเออร์', 'supplierName'], ['รายการ', 'items'], ['ยอดรวม', 'totalAmount'],
    ['ครบขั้นต่ำ', 'minAmountMet'], ['ปลายทาง', 'destination'], ['สถานะ', 'status'], ['หมายเหตุ', 'notes']
  ],
  movements: [
    ['วันที่', 'date'], ['รหัสสินค้า', 'itemId'], ['รายการ', 'itemName'], ['ประเภท', 'type'],
    ['จำนวน', 'quantity'], ['คงเหลือหลังทำรายการ', 'balanceAfter'], ['เอกสารอ้างอิง', 'referenceNo'], ['หมายเหตุ', 'notes']
  ],
  branch_demands: [
    ['สาขา', 'branchId'], ['สินค้า', 'itemId'], ['โควตา/เดือน', 'monthlyQuota'], ['หมายเหตุ', 'notes']
  ]
};

/* ============================ เมนูและตั้งค่า ============================ */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📦 NOVASOL')
      .addItem('1. สร้าง/ตรวจสอบแท็บฐานข้อมูล', 'setupDatabase')
      .addItem('2. ดูรหัส API Token', 'showApiToken')
      .addItem('3. สร้างรหัส API Token ใหม่', 'regenerateApiToken')
      .addToUi();
  } catch (err) { /* ไม่ได้ผูกกับชีต */ }
}

function setupDatabase() {
  var ss = getSpreadsheet_();
  Object.keys(COLLECTIONS).forEach(function (name) { getTab_(ss, name); });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_TOKEN')) props.setProperty('API_TOKEN', newToken_());
  if (!props.getProperty('REV')) props.setProperty('REV', '1');
  say_('✅ สร้างแท็บฐานข้อมูลเรียบร้อย',
    'API Token ของคุณ:\n\n' + props.getProperty('API_TOKEN') +
    '\n\nขั้นต่อไป: Deploy เป็น Web app (ผู้มีสิทธิ์เข้าถึง = ทุกคน) แล้วนำ URL + Token ไปใส่ในแอป');
}

function showApiToken() {
  var t = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  say_('API Token', t || 'ยังไม่มีรหัส — ให้รัน setupDatabase ก่อน');
}

function regenerateApiToken() {
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', newToken_());
  showApiToken();
}

/* ============================== Web App API ============================== */

function doGet() {
  return json_({ ok: true, app: 'NOVASOL Warehouse Sheet API', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('API_TOKEN');
    if (!token) return json_({ ok: false, error: 'ยังไม่ได้ตั้งค่า: ให้รันฟังก์ชัน setupDatabase ใน Apps Script ก่อน' });
    if (!req.token || req.token !== token) return json_({ ok: false, error: 'API Token ไม่ถูกต้อง' });

    switch (req.action) {
      case 'meta':   return json_({ ok: true, meta: meta_(props) });
      case 'getAll': return json_({ ok: true, meta: meta_(props), data: readAll_() });
      case 'apply':  return withLock_(function () { return applyOps_(req.ops || [], props); });
      case 'seed':   return withLock_(function () { return seed_(req.data || {}, props); });
      default:       return json_({ ok: false, error: 'ไม่รู้จัก action: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ============================ การอ่าน/เขียนข้อมูล ============================ */

function meta_(props) {
  var counts = {};
  var ss = getSpreadsheet_();
  Object.keys(COLLECTIONS).forEach(function (name) {
    var sh = getTab_(ss, name);
    counts[name] = Math.max(0, sh.getLastRow() - 1);
  });
  return { rev: Number(props.getProperty('REV') || '1'), seeded: props.getProperty('SEEDED') === '1', counts: counts };
}

function readAll_() {
  var ss = getSpreadsheet_();
  var out = {};
  Object.keys(COLLECTIONS).forEach(function (name) {
    var sh = getTab_(ss, name);
    var last = sh.getLastRow();
    var list = [];
    if (last >= 2) {
      var rows = sh.getRange(2, 3, last - 1, CHUNK_COLS).getValues();
      rows.forEach(function (r) {
        var text = joinChunks_(r);
        if (!text) return;
        try { list.push(JSON.parse(text)); } catch (err) { /* ข้ามแถวที่ JSON เสีย */ }
      });
    }
    out[name] = list;
  });
  return out;
}

/**
 * ops: [{ op:'upsert', collection, id, data, merge? } | { op:'delete', collection, id }
 *        | { op:'replace', collection, records:[...] }]
 */
function applyOps_(ops, props) {
  var ss = getSpreadsheet_();
  var prevRev = Number(props.getProperty('REV') || '1');
  var state = {}; // collection -> { sh, ids[] }

  function stateOf(name) {
    if (!COLLECTIONS[name]) throw new Error('ไม่รู้จักคอลเลกชัน: ' + name);
    if (!state[name]) {
      var sh = getTab_(ss, name);
      var last = sh.getLastRow();
      var ids = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
      state[name] = { sh: sh, ids: ids };
    }
    return state[name];
  }

  ops.forEach(function (op) {
    var st = stateOf(op.collection);
    if (op.op === 'upsert') {
      var id = String(op.id);
      var idx = st.ids.indexOf(id);
      var record = op.data || {};
      if (op.merge && idx >= 0) {
        var existing = readRecord_(st.sh, idx + 2);
        record = Object.assign({}, existing, record);
      }
      record.id = record.id || id;
      var rowNum = idx >= 0 ? idx + 2 : st.ids.length + 2;
      writeRecord_(st.sh, rowNum, id, record, op.collection);
      if (idx < 0) st.ids.push(id);
    } else if (op.op === 'delete') {
      var di = st.ids.indexOf(String(op.id));
      if (di >= 0) { st.sh.deleteRow(di + 2); st.ids.splice(di, 1); }
    } else if (op.op === 'replace') {
      clearData_(st.sh);
      st.ids = [];
      writeMany_(st.sh, op.records || [], op.collection);
      st.ids = (op.records || []).map(function (r) { return String(r.id); });
    } else {
      throw new Error('ไม่รู้จัก op: ' + op.op);
    }
  });

  var rev = prevRev + 1;
  props.setProperty('REV', String(rev));
  return json_({ ok: true, rev: rev, prevRev: prevRev });
}

function seed_(data, props) {
  if (props.getProperty('SEEDED') === '1') return json_({ ok: true, seeded: false, meta: meta_(props) });
  var ss = getSpreadsheet_();
  Object.keys(COLLECTIONS).forEach(function (name) {
    var sh = getTab_(ss, name);
    if (sh.getLastRow() < 2 && data[name] && data[name].length) {
      writeMany_(sh, data[name], name);
    }
  });
  props.setProperty('SEEDED', '1');
  props.setProperty('REV', String(Number(props.getProperty('REV') || '1') + 1));
  return json_({ ok: true, seeded: true, meta: meta_(props) });
}

/* ================================ ตัวช่วย ================================ */

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('สคริปต์ไม่ได้ผูกกับชีต: ตั้งค่า Script Property ชื่อ SHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getTab_(ss, name) {
  var tabName = TAB_PREFIX + name;
  var sh = ss.getSheetByName(tabName);
  if (sh) return sh;
  sh = ss.insertSheet(tabName);
  var header = ['id', 'updatedAt'];
  for (var i = 1; i <= CHUNK_COLS; i++) header.push('_json' + i);
  COLLECTIONS[name].forEach(function (c) { header.push(c[0]); });
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground('#e2e8f0');
  sh.setFrozenRows(1);
  sh.setColumnWidths(3, CHUNK_COLS, 60);
  sh.getRange(1, 3, sh.getMaxRows(), CHUNK_COLS).setNumberFormat('@'); // คอลัมน์ JSON เป็นข้อความล้วน
  return sh;
}

function clearData_(sh) {
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, sh.getMaxColumns()).clearContent();
  if (last > 2) sh.deleteRows(3, last - 2);
}

function readRecord_(sh, rowNum) {
  var text = joinChunks_(sh.getRange(rowNum, 3, 1, CHUNK_COLS).getValues()[0]);
  return text ? JSON.parse(text) : {};
}

function rowValues_(id, record, collection) {
  var text = JSON.stringify(record);
  if (text.length > CHUNK_SIZE * CHUNK_COLS) {
    throw new Error('ข้อมูลของ ' + collection + '/' + id + ' ใหญ่เกินไป (' + text.length + ' ตัวอักษร) — ลดขนาดรูปภาพ/ลายเซ็น');
  }
  var row = [id, new Date()];
  for (var i = 0; i < CHUNK_COLS; i++) {
    var part = text.substr(i * CHUNK_SIZE, CHUNK_SIZE);
    // ขึ้นต้นด้วย "j" เสมอ เพื่อกัน Google Sheets แปลงข้อความเป็นสูตร/ตัวเลข/วันที่
    row.push(part ? CHUNK_PREFIX + part : '');
  }
  COLLECTIONS[collection].forEach(function (c) { row.push(viewValue_(record[c[1]])); });
  return row;
}

function writeRecord_(sh, rowNum, id, record, collection) {
  var row = rowValues_(id, record, collection);
  sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
}

function writeMany_(sh, records, collection) {
  if (!records.length) return;
  var rows = records.map(function (r) { return rowValues_(String(r.id), r, collection); });
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function joinChunks_(cells) {
  return cells.map(function (c) { return c === '' || c === null ? '' : String(c).substr(CHUNK_PREFIX.length); }).join('');
}

// กันข้อความที่ผู้ใช้กรอกถูกตีความเป็นสูตร (เช่น =IMPORTXML(...)) เมื่อเขียนลงชีต
function safeText_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

// ค่าสำหรับคอลัมน์สรุป: รายการสินค้าในใบส่งของ/PO เป็นข้อความอ่านง่าย
function viewValue_(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) {
    return safeText_(v.map(function (it) {
      return it && it.itemName ? it.itemName + ' x' + it.quantity + (it.unit ? ' ' + it.unit : '') : JSON.stringify(it);
    }).join(', ').substr(0, 2000));
  }
  if (typeof v === 'object') return safeText_(JSON.stringify(v).substr(0, 2000));
  if (typeof v === 'string') return safeText_(v.substr(0, 2000));
  return v;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function newToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').substr(0, 16);
}

function say_(title, msg) {
  Logger.log(title + '\n' + msg);
  try { SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (err) { /* รันจากตัวแก้ไข */ }
}
