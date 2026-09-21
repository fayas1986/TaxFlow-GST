const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\s*\\}\\};\\s*export default Integrations;\\s*$/, '\n  };\n\n  return (\n    // oops, the component return is missing???\n');

// Wait, what did I delete? Let's check what the component returns!
// Let me look at the last 100 lines.
