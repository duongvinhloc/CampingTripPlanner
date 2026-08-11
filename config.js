// Khi chạy local qua mock_server.py (localhost), dùng luôn API giả cùng server (URL rỗng = cùng gốc).
// Khi deploy thật (GitHub Pages), tự động dùng URL Apps Script thật bên dưới.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// Dán URL Web App (kết thúc bằng /exec) sau khi deploy Apps Script vào đây.
const APPS_SCRIPT_URL ='https://script.google.com/macros/s/AKfycbyiDrksEyw4l6VYo0fr06yJowC0FYZ6-MkBUYzZWcA8C-M_F4Uk8v7ro46q2pPiTvIH/exec';
