/**
 * Backend cho app cắm trại (Tasks + Splitwise) dùng Google Sheets làm database.
 *
 * Cách cài đặt:
 * 1. Tạo 1 Google Sheet mới, tạo đúng 3 sheet (tab) với tên và dòng tiêu đề sau:
 *
 *    Sheet "Tasks"    | id | group | task | assignee | quantity | status | note
 *    Sheet "Expenses" | id | date | description | payer | amount | participants
 *    Sheet "Members"  | id | name
 *
 * 2. Trong Sheet, mở Extensions > Apps Script, xoá code mẫu, dán toàn bộ file này vào.
 * 3. Deploy > New deployment > chọn loại "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL /exec sau khi deploy, dán vào camping-app/config.js (APPS_SCRIPT_URL).
 * 5. Đổi APP_PASSWORD bên dưới thành mật khẩu chung của nhóm (phải khớp với mật khẩu
 *    nhóm dùng để đăng nhập trên app) rồi Deploy lại (Manage deployments > sửa deployment).
 */

// Mật khẩu chung của cả nhóm — phải khớp giá trị APP_PASSWORD trong mock_server.py khi test local.
const APP_PASSWORD = 'camp2026';

const SHEETS = {
  Tasks: ['id', 'group', 'task', 'assignee', 'quantity', 'status', 'note'],
  Expenses: ['id', 'date', 'description', 'payer', 'amount', 'participants'],
  Members: ['id', 'name'],
};

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(SHEETS[name]);
  }
  return sheet;
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map((row, idx) => {
      const obj = { _row: idx + 2 };
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function doGet(e) {
  if (e.parameter.password !== APP_PASSWORD) return jsonOut_({ error: 'Unauthorized' });
  const name = e.parameter.sheet;
  if (!SHEETS[name]) return jsonOut_({ error: 'Unknown sheet: ' + name });
  const sheet = getSheet_(name);
  return jsonOut_({ data: sheetToObjects_(sheet) });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.password !== APP_PASSWORD) return jsonOut_({ error: 'Unauthorized' });
  const name = body.sheet;
  if (!SHEETS[name]) return jsonOut_({ error: 'Unknown sheet: ' + name });
  const sheet = getSheet_(name);
  const headers = SHEETS[name];

  if (body.action === 'add') {
    const id = body.data.id || String(new Date().getTime());
    const row = headers.map(h => h === 'id' ? id : (body.data[h] !== undefined ? body.data[h] : ''));
    sheet.appendRow(row);
    return jsonOut_({ ok: true, id: id });
  }

  if (body.action === 'update') {
    const rows = sheetToObjects_(sheet);
    const target = rows.find(r => String(r.id) === String(body.id));
    if (!target) return jsonOut_({ error: 'Not found: ' + body.id });
    headers.forEach((h, i) => {
      if (body.data[h] !== undefined) {
        sheet.getRange(target._row, i + 1).setValue(body.data[h]);
      }
    });
    return jsonOut_({ ok: true });
  }

  if (body.action === 'delete') {
    const rows = sheetToObjects_(sheet);
    const target = rows.find(r => String(r.id) === String(body.id));
    if (!target) return jsonOut_({ error: 'Not found: ' + body.id });
    sheet.deleteRow(target._row);
    return jsonOut_({ ok: true });
  }

  return jsonOut_({ error: 'Unknown action: ' + body.action });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


api.js
// Lớp giao tiếp với Apps Script Web App (đóng vai trò database qua Google Sheets).

// Mật khẩu chung của nhóm, chỉ lưu trong sessionStorage (mất khi đóng tab/trình duyệt).
const AUTH_STORAGE_KEY = 'campingAppPassword';

function getAuthPassword() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) || '';
}

async function apiList(sheetName) {
  const url = `${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}&password=${encodeURIComponent(getAuthPassword())}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}

async function apiPost(payload) {
  // Content-Type text/plain tránh browser gửi CORS preflight (Apps Script không xử lý OPTIONS).
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, password: getAuthPassword() }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

const api = {
  list: (sheet) => apiList(sheet),
  add: (sheet, data) => apiPost({ sheet, action: 'add', data }),
  update: (sheet, id, data) => apiPost({ sheet, action: 'update', id, data }),
  remove: (sheet, id) => apiPost({ sheet, action: 'delete', id }),
};
