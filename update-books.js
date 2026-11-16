const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'library_master_database.csv');
const outputPath = path.join(__dirname, 'books-data.js');

if (!fs.existsSync(csvPath)) {
  console.error('CSV file not found at:', csvPath);
  process.exit(1);
}

const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');

function parseCsv(text) {
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

const books = parseCsv(text);
const fileContent = `// Precompiled library database generated from library_master_database.csv
// Total Books: ${books.length}
window.BOOKS_DATA = ${JSON.stringify(books, null, 2)};
`;

fs.writeFileSync(outputPath, fileContent, 'utf8');
console.log(`Successfully updated ${outputPath} with ${books.length} books.`);
