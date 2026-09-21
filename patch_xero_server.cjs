const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const xeroRoutes = `
  // --- XERO OAUTH 2.0 ENDPOINTS ---
  app.get("/api/v1/xero/auth", (req, res) => {
    const clientId = process.env.XERO_CLIENT_ID;
    const redirectUri = process.env.XERO_REDIRECT_URI || \`http://localhost:\${PORT}/api/v1/xero/callback\`;
    
    if (!clientId) {
      return res.status(400).send("XERO_CLIENT_ID environment variable is missing. Check .env.example");
    }

    const state = Math.random().toString(36).substring(7);
    const scope = "accounting.transactions accounting.settings";
    
    const authUrl = \`https://login.xero.com/identity/connect/authorize?response_type=code&client_id=\${clientId}&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=\${encodeURIComponent(scope)}&state=\${state}\`;
    
    res.redirect(authUrl);
  });

  app.get("/api/v1/xero/callback", async (req, res) => {
    res.redirect('/?xero_connected=true');
  });
`;

content = content.replace(
  '  // --- QUICKBOOKS ONLINE OAUTH 2.0 ENDPOINTS ---',
  xeroRoutes + '\\n  // --- QUICKBOOKS ONLINE OAUTH 2.0 ENDPOINTS ---'
);

fs.writeFileSync(file, content);
