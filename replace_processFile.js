const fs = require('fs');
let code = fs.readFileSync('components/BulkImportModal.tsx', 'utf-8');

const targetRegex = /const processFile = \(selectedFile: File\) => \{[\s\S]*?reader\.readAsText\(selectedFile\);\n  \};\n/g;

const match = targetRegex.exec(code);
if (!match) {
    console.log("NOT FOUND");
} else {
    const targetContent = match[0];
    
    const replacementContent = `const processFile = (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCSV = selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.txt') || selectedFile.type === 'text/csv';

    if (!isCSV && !isExcel) {
      setError('Please upload a valid CSV (.csv) or Excel (.xlsx) file.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        
        // Dynamically import xlsx for client-side processing
        const XLSX = await import('xlsx');
        
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays for headers, and array of objects for data
        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });
        
        if (rawData.length < 2) {
          setError('The file is empty or missing data rows.');
          return;
        }

        // Filter out completely empty rows
        const validRows = rawData.filter(row => row && row.some && row.some((cell: any) => cell !== undefined && cell !== null && cell !== ''));
        
        if (validRows.length < 2) {
            setError('The file is empty or missing data rows.');
            return;
        }

        const headers = validRows[0].map((h: any) => h ? String(h).toLowerCase().replace(/[^a-z0-9]/g, '') : '');
        setRawHeaders(headers);

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < validRows.length; i++) {
          const values = validRows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((header: string, idx: number) => {
             if (header) {
                 rowObj[header] = values[idx] ? String(values[idx]).trim() : '';
             }
          });
          rows.push(rowObj);
        }

        setRawRows(rows);

        // Auto Map
        const initialMap: Record<string, string> = {};
        TARGET_FIELDS.forEach(field => {
          initialMap[field.key] = findBestMatch(field.alternates, headers);
        });

        setFieldMappings(initialMap);
        setStep('MAPPING');
      } catch (err) {
        console.error(err);
        setError('Error reading and processing file structure.');
      } finally {
        setIsParsing(false);
      }
    };
    
    reader.onerror = () => {
      setError('Error reading file from disk.');
      setIsParsing(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };
`;

    code = code.replace(targetContent, replacementContent);
    fs.writeFileSync('components/BulkImportModal.tsx', code);
    console.log("REPLACED");
}
