const XLSX = require('xlsx');
const ws = XLSX.utils.aoa_to_sheet([["InvNo", "Amount"], ["INV01", 100]]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const readWb = XLSX.read(buf, { type: 'buffer' });
const rawData = XLSX.utils.sheet_to_json(readWb.Sheets.Sheet1, { header: 1, raw: false });
console.log(rawData);
