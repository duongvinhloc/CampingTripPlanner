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
