/* app.js — интерактивность для приложения «Телеком Оператор — Учёт» */

// ============================================================
// Flash-сообщения
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  // Автоскрытие flash-сообщений через 3 секунды
  document.querySelectorAll('.flash-msg').forEach(function(el) {
    setTimeout(function() {
      el.classList.add('hide');
      setTimeout(function() { el.remove(); }, 300);
    }, 3000);
  });

  // Поиск по таблице
  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var term = this.value.toLowerCase().trim();
      var rows = document.querySelectorAll('#table-body tr');
      rows.forEach(function(row) {
        if (row.cells.length < 2) return;
        var searchData = (row.getAttribute('data-search') || '').toLowerCase();
        if (!term || searchData.indexOf(term) !== -1) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  // Inline-редактирование
  document.querySelectorAll('.editable').forEach(function(cell) {
    cell.addEventListener('click', function(e) {
      if (this.querySelector('.edit-input')) return;
      startEdit(this);
    });
  });
});


// ============================================================
// Модальные окна
// ============================================================
function openModal() {
  var modal = document.getElementById('modal');
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  var modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
}


// ============================================================
// Inline-редактирование ячеек
// ============================================================
function startEdit(cell) {
  var rowId = cell.getAttribute('data-id');
  var column = cell.getAttribute('data-column');
  var type = cell.getAttribute('data-type');
  var options = cell.getAttribute('data-options');
  var currentText = cell.textContent.trim();
  var currentValue = currentText === '—' ? '' : currentText;

  var input;
  if (type === 'select' && options) {
    input = document.createElement('select');
    input.className = 'edit-input';
    var opts = JSON.parse(options);
    opts.forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === currentText) o.selected = true;
      input.appendChild(o);
    });
  } else if (type === 'badge') {
    return; // бейджи редактируем через отдельный интерфейс
  } else {
    input = document.createElement('input');
    input.className = 'edit-input';
    if (type === 'currency' || type === 'number') {
      input.type = 'number';
      input.step = type === 'currency' ? '0.01' : '1';
      // Очищаем валюту от символов
      currentValue = currentValue.replace(/[^\d.-]/g, '');
      if (currentValue === '0') currentValue = '';
      if (cell.classList.contains('text-right')) input.classList.add('text-right');
    } else if (type === 'date') {
      input.type = 'date';
      // Преобразуем DD.MM.YYYY → YYYY-MM-DD
      if (currentValue && currentValue.indexOf('.') !== -1) {
        var parts = currentValue.split('.');
        if (parts.length === 3) currentValue = parts[2] + '-' + parts[1] + '-' + parts[0];
      }
    } else {
      input.type = 'text';
    }
    input.value = currentValue;
  }

  var originalContent = cell.innerHTML;
  cell.innerHTML = '';
  input.classList.add('edit-input');
  cell.appendChild(input);
  input.focus();
  if (input.select) input.select();

  var committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    var newValue = input.value;

    // Определяем URL для отправки
    var editUrl = cell.getAttribute('data-edit-url');
    if (!editUrl) {
      // Определяем по текущей странице
      var path = window.location.pathname;
      if (path.indexOf('/customers') !== -1) {
        editUrl = '/customers/' + rowId + '/edit';
      } else if (path.indexOf('/orders') !== -1 && path.indexOf('/construction') === -1) {
        editUrl = '/orders/' + rowId + '/edit';
      } else if (path.indexOf('/construction') !== -1) {
        editUrl = '/construction/' + rowId + '/edit';
      } else if (path.indexOf('/charges') !== -1) {
        editUrl = '/charges/' + rowId + '/edit';
      }
    }

    fetch(editUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: column, value: newValue })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.ok) {
        // Перезагружаем страницу для отображения обновлённых данных
        window.location.reload();
      } else {
        alert(data.error || 'Ошибка сохранения');
        cell.innerHTML = originalContent;
      }
    })
    .catch(function() {
      alert('Ошибка сети при сохранении');
      cell.innerHTML = originalContent;
    });
  }

  function cancel() {
    if (committed) return;
    committed = true;
    cell.innerHTML = originalContent;
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
}


// ============================================================
// Сортировка таблицы (клиентская)
// ============================================================
var sortState = { key: null, dir: 'asc' };

function sortBy(key) {
  var tbody = document.getElementById('table-body');
  if (!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr')).filter(function(r) { return r.cells.length > 1; });
  if (!rows.length) return;

  if (sortState.key === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.key = key;
    sortState.dir = 'asc';
  }

  rows.sort(function(a, b) {
    var idx = 0;
    // Найти индекс колонки по data-column
    var aCell = a.querySelector('[data-column="' + key + '"]');
    var bCell = b.querySelector('[data-column="' + key + '"]');
    if (!aCell || !bCell) return 0;
    var av = aCell.textContent.trim();
    var bv = bCell.textContent.trim();
    var an = parseFloat(av.replace(/[^\d.-]/g, ''));
    var bn = parseFloat(bv.replace(/[^\d.-]/g, ''));
    if (!isNaN(an) && !isNaN(bn)) {
      return sortState.dir === 'asc' ? an - bn : bn - an;
    }
    return sortState.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  rows.forEach(function(r) { tbody.appendChild(r); });
}
