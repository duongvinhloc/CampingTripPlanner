// State dùng chung, đồng bộ với Google Sheets qua api.js
let members = [];
let tasks = [];
let expenses = [];
let taskFilterAssignee = '';
const UNASSIGNED_FILTER_VALUE = '__unassigned__';

const POLL_INTERVAL_MS = 15000;

function fmtMoney(n) {
  return '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
}

function setStatus(text) {
  document.getElementById('status-indicator').textContent = text;
}

let pollTimer = null;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(loadAll, POLL_INTERVAL_MS);
}

async function init() {
  await loadAll();
  startPolling();
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------- Load ----------
async function loadAll() {
  setStatus('Đang tải...');
  try {
    [members, tasks, expenses] = await Promise.all([
      api.list('Members'),
      api.list('Tasks'),
      api.list('Expenses'),
    ]);
    renderMembers();
    renderTaskAssigneeOptions();
    renderTaskFilterOptions();
    renderTasks();
    renderExpensePayerOptions();
    renderExpenseParticipantOptions();
    renderExpenses();
    renderBalances();
    setStatus('Đã cập nhật ' + new Date().toLocaleTimeString('vi-VN'));
  } catch (err) {
    console.error(err);
    setStatus('Lỗi tải dữ liệu — kiểm tra config.js');
  }
}

document.getElementById('refresh-btn').addEventListener('click', loadAll);

// ---------- Members ----------
function renderMembers() {
  const list = document.getElementById('member-list');
  const empty = document.getElementById('member-empty');
  list.innerHTML = '';
  empty.hidden = members.length > 0;
  members.forEach(m => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(m.name)}</span>`;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Xoá';
    delBtn.className = 'row-delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Xoá thành viên "${m.name}"?`)) return;
      await api.remove('Members', m.id);
      await loadAll();
    });
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

document.getElementById('member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('member-name');
  const name = nameInput.value.trim();
  if (!name) return;
  await api.add('Members', { name });
  nameInput.value = '';
  await loadAll();
});

function memberOptionsHtml() {
  return members.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
}

// ---------- Tasks ----------
function renderTaskAssigneeOptions() {
  document.getElementById('task-assignee').innerHTML =
    '<option value="">-- Ai phụ trách? --</option>' + memberOptionsHtml();
}

function renderTaskFilterOptions() {
  const select = document.getElementById('task-filter-assignee');
  select.innerHTML =
    '<option value="">-- Tất cả --</option>' +
    memberOptionsHtml() +
    `<option value="${UNASSIGNED_FILTER_VALUE}">Chưa phân công</option>`;
  select.value = taskFilterAssignee;
}

document.getElementById('task-filter-assignee').addEventListener('change', (e) => {
  taskFilterAssignee = e.target.value;
  renderTasks();
});

function renderTasks() {
  const tbody = document.getElementById('task-tbody');
  const empty = document.getElementById('task-empty');
  tbody.innerHTML = '';

  const filtered = tasks.filter(t => {
    if (!taskFilterAssignee) return true;
    if (taskFilterAssignee === UNASSIGNED_FILTER_VALUE) return !t.assignee;
    return t.assignee === taskFilterAssignee;
  });

  empty.hidden = filtered.length > 0;
  empty.textContent = tasks.length === 0
    ? 'Chưa có công việc nào. Thêm việc đầu tiên ở trên nhé!'
    : 'Không có công việc nào của người này.';

  filtered.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Nhóm">${escapeHtml(t.group || 'Khác')}</td>
      <td data-label="Hạng mục">${escapeHtml(t.task)}</td>
      <td data-label="Người phụ trách">${escapeHtml(t.assignee || '—')}</td>
      <td data-label="Số lượng">${escapeHtml(t.quantity || '')}</td>
      <td data-label="Trạng thái"></td>
      <td data-label="Ghi chú">${escapeHtml(t.note || '')}</td>
      <td></td>
    `;
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select status-' + (t.status || 'todo');
    ['todo', 'doing', 'done'].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Xong' }[s];
      if ((t.status || 'todo') === s) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener('change', async () => {
      await api.update('Tasks', t.id, { status: statusSelect.value });
      await loadAll();
    });
    tr.children[4].appendChild(statusSelect);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Xoá';
    delBtn.className = 'row-delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Xoá hạng mục "${t.task}"?`)) return;
      await api.remove('Tasks', t.id);
      await loadAll();
    });
    tr.children[6].appendChild(delBtn);

    tbody.appendChild(tr);
  });
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const group = document.getElementById('task-group').value.trim();
  const task = document.getElementById('task-name').value.trim();
  const assignee = document.getElementById('task-assignee').value;
  const quantity = document.getElementById('task-quantity').value.trim();
  const note = document.getElementById('task-note').value.trim();
  if (!task) return;
  await api.add('Tasks', { group, task, assignee, quantity, note, status: 'todo' });
  e.target.reset();
  await loadAll();
});

// ---------- Expenses ----------
function renderExpensePayerOptions() {
  document.getElementById('exp-payer').innerHTML =
    '<option value="">-- Ai đã trả? --</option>' + memberOptionsHtml();
}

function renderExpenseParticipantOptions() {
  const container = document.getElementById('exp-participants');
  container.innerHTML = '';
  members.forEach(m => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = m.name;
    cb.checked = true;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(m.name));
    container.appendChild(label);
  });
}

function renderExpenses() {
  const tbody = document.getElementById('expense-tbody');
  const empty = document.getElementById('expense-empty');
  tbody.innerHTML = '';
  empty.hidden = expenses.length > 0;
  expenses.forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Khoản chi">${escapeHtml(x.description)}</td>
      <td data-label="Số tiền">${fmtMoney(x.amount)}</td>
      <td data-label="Người trả">${escapeHtml(x.payer)}</td>
      <td data-label="Chia cho">${escapeHtml(x.participants)}</td>
      <td></td>
    `;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Xoá';
    delBtn.className = 'row-delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Xoá khoản chi "${x.description}"?`)) return;
      await api.remove('Expenses', x.id);
      await loadAll();
    });
    tr.children[4].appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

document.getElementById('expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = document.getElementById('exp-desc').value.trim();
  const amount = Number(document.getElementById('exp-amount').value);
  const payer = document.getElementById('exp-payer').value;
  const participants = Array.from(document.querySelectorAll('#exp-participants input:checked')).map(cb => cb.value);
  if (!description || !amount || !payer || participants.length === 0) {
    alert('Vui lòng điền đủ thông tin và chọn ít nhất 1 người chia tiền.');
    return;
  }
  await api.add('Expenses', {
    description,
    amount,
    payer,
    participants: participants.join(', '),
    date: new Date().toISOString().slice(0, 10),
  });
  e.target.reset();
  await loadAll();
});

// ---------- Balances & Settlement ----------
function renderBalances() {
  const paid = {};
  const owed = {};
  members.forEach(m => { paid[m.name] = 0; owed[m.name] = 0; });

  expenses.forEach(x => {
    const amount = Number(x.amount) || 0;
    const participants = String(x.participants || '').split(',').map(s => s.trim()).filter(Boolean);
    if (paid[x.payer] === undefined) paid[x.payer] = 0;
    paid[x.payer] += amount;
    if (participants.length === 0) return;
    const share = amount / participants.length;
    participants.forEach(p => {
      if (owed[p] === undefined) owed[p] = 0;
      owed[p] += share;
    });
  });

  const names = Array.from(new Set([...members.map(m => m.name), ...Object.keys(paid), ...Object.keys(owed)]));
  const balances = names.map(name => ({
    name,
    paid: paid[name] || 0,
    owed: owed[name] || 0,
    balance: (paid[name] || 0) - (owed[name] || 0),
  }));

  const tbody = document.getElementById('balance-tbody');
  tbody.innerHTML = '';
  balances.forEach(b => {
    const tr = document.createElement('tr');
    const cls = b.balance > 0.5 ? 'balance-positive' : (b.balance < -0.5 ? 'balance-negative' : '');
    tr.innerHTML = `
      <td data-label="Thành viên">${escapeHtml(b.name)}</td>
      <td data-label="Đã trả">${fmtMoney(b.paid)}</td>
      <td data-label="Phải chịu">${fmtMoney(b.owed)}</td>
      <td class="${cls}" data-label="Số dư">${b.balance >= 0 ? '+' : ''}${fmtMoney(b.balance)}</td>
    `;
    tbody.appendChild(tr);
  });

  renderSettlements(balances);
}

function renderSettlements(balances) {
  // Thuật toán tham lam: người nợ nhiều nhất trả cho người được nợ nhiều nhất, lặp lại.
  const debtors = balances.filter(b => b.balance < -0.5).map(b => ({ name: b.name, amount: -b.balance })).sort((a, b) => b.amount - a.amount);
  const creditors = balances.filter(b => b.balance > 0.5).map(b => ({ name: b.name, amount: b.balance })).sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.5) i++;
    if (creditors[j].amount < 0.5) j++;
  }

  const list = document.getElementById('settlement-list');
  const empty = document.getElementById('settlement-empty');
  list.innerHTML = '';
  empty.hidden = settlements.length > 0;
  settlements.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.from} → trả ${fmtMoney(s.amount)} cho ${s.to}`;
    list.appendChild(li);
  });
}

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Init ----------
init();
