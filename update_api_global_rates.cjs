const fs = require('fs');
let code = fs.readFileSync('services/api.ts', 'utf-8');

const mockData = `
export interface GlobalTaxRate {
  country: string;
  countryCode: string;
  category: string;
  rate: number;
  effectiveDate: string;
  description: string;
  source: string;
}

export const fetchGlobalTaxRates = async (countryCode: string, categoryKeyword: string): Promise<GlobalTaxRate[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const db: GlobalTaxRate[] = [
                { country: 'United Arab Emirates', countryCode: 'AE', category: 'Software Services', rate: 5, effectiveDate: '2018-01-01', description: 'Standard VAT Rate', source: 'Federal Tax Authority (FTA)' },
                { country: 'United Arab Emirates', countryCode: 'AE', category: 'Export of Goods', rate: 0, effectiveDate: '2018-01-01', description: 'Zero-rated', source: 'FTA' },
                { country: 'United Kingdom', countryCode: 'GB', category: 'Standard Goods', rate: 20, effectiveDate: '2011-01-04', description: 'Standard VAT Rate', source: 'HM Revenue & Customs' },
                { country: 'United Kingdom', countryCode: 'GB', category: 'Digital Services', rate: 20, effectiveDate: '2015-01-01', description: 'Standard VAT Rate', source: 'HMRC' },
                { country: 'United Kingdom', countryCode: 'GB', category: 'Childrens Clothing', rate: 0, effectiveDate: '1973-04-01', description: 'Zero-rated', source: 'HMRC' },
                { country: 'Singapore', countryCode: 'SG', category: 'Standard Goods & Services', rate: 9, effectiveDate: '2024-01-01', description: 'Standard GST Rate', source: 'Inland Revenue Authority of Singapore' },
                { country: 'Australia', countryCode: 'AU', category: 'Standard Goods & Services', rate: 10, effectiveDate: '2000-07-01', description: 'Standard GST Rate', source: 'Australian Taxation Office' },
                { country: 'Germany', countryCode: 'DE', category: 'Standard Goods', rate: 19, effectiveDate: '2007-01-01', description: 'Standard VAT Rate', source: 'Federal Central Tax Office' },
                { country: 'Germany', countryCode: 'DE', category: 'Books and E-books', rate: 7, effectiveDate: '2019-12-18', description: 'Reduced VAT Rate', source: 'Federal Central Tax Office' },
                { country: 'India', countryCode: 'IN', category: 'Software Services', rate: 18, effectiveDate: '2017-07-01', description: 'Standard GST Rate', source: 'CBIC' },
                { country: 'United States', countryCode: 'US', category: 'Digital Goods (NY)', rate: 4, effectiveDate: '2023-01-01', description: 'State Sales Tax (Excludes Local)', source: 'NY Dept of Taxation' },
                { country: 'Canada', countryCode: 'CA', category: 'Standard (ON)', rate: 13, effectiveDate: '2010-07-01', description: 'Harmonized Sales Tax (HST)', source: 'Canada Revenue Agency' }
            ];

            let results = db;
            if (countryCode && countryCode !== 'ALL') {
                results = results.filter(r => r.countryCode === countryCode);
            }
            if (categoryKeyword) {
                const kw = categoryKeyword.toLowerCase();
                results = results.filter(r => r.category.toLowerCase().includes(kw) || r.description.toLowerCase().includes(kw));
            }

            resolve(results);
        }, 1200);
    });
};
`;

if (!code.includes('fetchGlobalTaxRates')) {
    code += '\n' + mockData;
    fs.writeFileSync('services/api.ts', code);
    console.log("API UPDATED");
} else {
    console.log("ALREADY EXISTS");
}
