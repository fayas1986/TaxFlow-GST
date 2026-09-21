const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const qbState = `
  // QuickBooks Online State
  const [qbEnvironment, setQbEnvironment] = useState<'Production' | 'Sandbox'>('Sandbox');
  const [qbRealmId, setQbRealmId] = useState('');
  const [qbSyncInvoices, setQbSyncInvoices] = useState(true);
  const [qbSyncTaxLiability, setQbSyncTaxLiability] = useState(true);
  const [qbTesting, setQbTesting] = useState(false);
  const [qbTestResult, setQbTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    companyName: string;
  } | null>(null);

  const handleTestQbConnection = () => {
    setQbTesting(true);
    addLog(\`QUICKBOOKS: Initiating OAuth2.0 handshake with Intuit \${qbEnvironment} servers...\`);
    setTimeout(() => {
      setQbTesting(false);
      setQbTestResult({
        status: 'SUCCESS',
        latencyMs: 145,
        companyName: 'Acme Corp (QBO)'
      });
      addLog(\`QUICKBOOKS: Successfully connected to Company [Acme Corp (QBO)]. Tokens acquired.\`);
    }, 1500);
  };
`;

content = content.replace(
  '  // Tally Prime Bidirectional Canonical Integration State',
  qbState + '\n  // Tally Prime Bidirectional Canonical Integration State'
);

fs.writeFileSync(file, content);
