const fs = require('fs');
let code = fs.readFileSync('pages/Dashboard.tsx', 'utf-8');

const importStatement = "import { ProactiveAlertsService } from '../components/dashboard/ProactiveAlertsService';";
if (!code.includes("ProactiveAlertsService")) {
    code = code.replace("import { ExecutiveKpiSummary } from '../components/dashboard/ExecutiveKpiSummary';", "import { ExecutiveKpiSummary } from '../components/dashboard/ExecutiveKpiSummary';\n" + importStatement);
}

const bannerEnd = "          </div>\n        </div>\n      </div>";
const proactiveAlertsInjection = "          </div>\n        </div>\n      </div>\n\n      <ProactiveAlertsService />";

if (code.includes(bannerEnd) && !code.includes("<ProactiveAlertsService />")) {
    code = code.replace(bannerEnd, proactiveAlertsInjection);
}

fs.writeFileSync('pages/Dashboard.tsx', code);
