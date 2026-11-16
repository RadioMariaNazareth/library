const grid = document.querySelector('#bookGrid');
const search = document.querySelector('#searchInput');
const resultCount = document.querySelector('#resultCount');
const empty = document.querySelector('#emptyState');
const dialog = document.querySelector('#bookDialog');
const dialogContent = document.querySelector('#dialogContent');

// Initialize from preloaded database if available
let books = (typeof window !== 'undefined' && Array.isArray(window.BOOKS_DATA)) ? window.BOOKS_DATA : [];

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[character]));

// Arabic text normalization for flexible search (handles Hamzas, Ta-Marbuta, Diacritics)
function normalizeArabic(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic tashkeel / diacritics
    .replace(/[أإآٱ]/g, 'ا')              // normalize alifs
    .replace(/ة/g, 'ه')                    // normalize ta marbuta
    .replace(/ى/g, 'ي')                    // normalize alif maqsura
    .replace(/ـ/g, '')                     // remove tatweel
    .trim();
}

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], value = '', inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') { value += '"'; index += 1; }
      else inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = []; value = '';
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  if (rows.length === 0) return [];
  const [rawHeaders, ...records] = rows;
  const headers = rawHeaders.map(h => h.replace(/^\uFEFF/, '').trim());
  return records.map((record, index) => {
    const rowObj = Object.fromEntries(headers.map((header, column) => [header, (record[column] || '').trim()]));
    return {
      id: index + 1,
      title: rowObj['إسم الكتاب'] || '',
      author: rowObj['المؤلف'] || '',
      year: rowObj['السنة'] || '',
      publisher: rowObj['دار النشر'] || '',
      description: rowObj['ملخص'] || ''
    };
  });
}

const cover = (book, large = false) => `<div class="book-cover cover-${book.id % 6} ${large ? 'large-cover' : ''}">
  <span class="cover-number">${String(book.id).padStart(2, '0')}</span>
  <span class="cover-title">${escapeHtml(book.title)}</span>
  <span class="cover-category">${escapeHtml(book.year || 'دون تاريخ')}</span>
  <span class="cover-decoration"></span>
</div>`;

function render() {
  const rawQuery = search.value.trim();
  const query = normalizeArabic(rawQuery);
  const visible = query
    ? books.filter(book => {
        const searchable = normalizeArabic(
          `${book.title} ${book.author} ${book.publisher} ${book.year} ${book.description}`
        );
        return searchable.includes(query);
      })
    : books;

  grid.innerHTML = visible.map((book, index) => `<button class="book-card" data-id="${book.id}" style="animation-delay:${Math.min(index * .025, .35)}s">
    <div class="cover-wrap">${cover(book)}</div>
    <h3 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
    <p class="book-author" title="${escapeHtml(book.author)}">${escapeHtml(book.author)}</p>
  </button>`).join('');
  resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'كتاب' : 'كتاباً'}`;
  empty.hidden = visible.length > 0;
}

function showBook(id) {
  const book = books.find(item => item.id === Number(id));
  if (!book) return;
  dialogContent.innerHTML = `<div class="dialog-layout">
    <div class="dialog-cover">${cover(book, true)}</div>
    <div class="dialog-copy">
      <p class="eyebrow">بيانات الكتاب</p>
      <h2 id="dialogTitle">${escapeHtml(book.title)}</h2>
      <p class="dialog-author">${escapeHtml(book.author)}</p>
      <p class="dialog-description">${escapeHtml(book.description)}</p>
      <ul class="meta-list">
        <li><b>سنة النشر</b>${escapeHtml(book.year || 'غير مذكورة')}</li>
        <li><b>دار النشر</b>${escapeHtml(book.publisher || 'غير مذكورة')}</li>
      </ul>
    </div>
  </div>`;
  dialog.showModal();
}

async function loadCatalog() {
  try {
    const response = await fetch('library_master_database.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load catalog');
    const parsed = parseCsv(await response.text());
    if (parsed.length > 0) {
      books = parsed;
      render();
    }
  } catch (error) {
    // If books are already loaded (e.g. from books-data.js when opened via file://), do nothing
    if (!books || books.length === 0) {
      resultCount.textContent = 'تعذّر تحميل الفهرس';
      empty.hidden = false;
      empty.textContent = 'تعذّر تحميل بيانات الكتب. يرجى فتح الموقع من خلال خادم محلي.';
    }
  }
}

search.addEventListener('input', render);
grid.addEventListener('click', event => {
  const card = event.target.closest('.book-card');
  if (card) showBook(card.dataset.id);
});
dialog.addEventListener('click', event => {
  if (event.target === dialog || event.target.closest('.dialog-close')) dialog.close();
});

// Immediately render preloaded books if available
if (books.length > 0) {
  render();
}

// Also attempt dynamic fetch if served via HTTP/HTTPS
loadCatalog();
