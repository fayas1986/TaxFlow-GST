const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const qbRoutes = `
  // --- QUICKBOOKS ONLINE OAUTH 2.0 ENDPOINTS ---
  app.get("/api/v1/quickbooks/auth", (req, res) => {
    const environment = req.query.environment || 'Sandbox';
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || \`http://localhost:\${PORT}/api/v1/quickbooks/callback\`;
    
    if (!clientId) {
      return res.status(400).send("QUICKBOOKS_CLIENT_ID environment variable is missing.");
    }

    const state = Math.random().toString(36).substring(7);
    const scope = "com.intuit.quickbooks.accounting";
    
    // Store state in a cookie or session in a real app, here we just pass it
    const authUrl = \`https://appcenter.intuit.com/connect/oauth2?client_id=\${clientId}&response_type=code&scope=\${scope}&redirect_uri=\${encodeURIComponent(redirectUri)}&state=\${state}\`;
    
    res.redirect(authUrl);
  });

  app.get("/api/v1/quickbooks/callback", async (req, res) => {
    const { code, state, realmId, error } = req.query;
    
    if (error) {
      return res.status(400).send(\`QuickBooks Auth Error: \${error}\`);
    }

    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || \`http://localhost:\${PORT}/api/v1/quickbooks/callback\`;
    
    try {
      const authHeader = Buffer.from(\`\${clientId}:\${clientSecret}\`).toString('base64');
      const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': \`Basic \${authHeader}\`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri
        }).toString()
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error("QBO Token Error:", tokenData);
        return res.status(400).send("Failed to exchange token with QuickBooks");
      }

      // In a real application, you would save tokenData.access_token, tokenData.refresh_token, and realmId to your database.
      // For this demo, we'll redirect back to the app with a success flag.
      res.redirect('/?qb_connected=true&realmId=' + realmId);
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error during QuickBooks callback");
    }
  });

  app.post("/api/v1/quickbooks/sync", async (req, res) => {
    // This would use the stored access_token to push/pull data from QBO
    const { realmId, action } = req.body;
    // Mock response for now, but ready for real Intuit API calls
    res.json({ success: true, message: \`Successfully executed \${action} for QuickBooks company \${realmId}\` });
  });
`;

content = content.replace(
  '  // --- AI DOCUMENT TRANSLATION ENDPOINT ---',
  qbRoutes + '\\n  // --- AI DOCUMENT TRANSLATION ENDPOINT ---'
);

fs.writeFileSync(file, content);
