const fs = require('fs');
let css = fs.readFileSync('index.css', 'utf-8');

const fluidRules = `/* Global Fluid Typography Scale */
html {
  /* Fluid base font size: dynamically scales 'rem' from 13px on small screens up to 16px on desktops */
  font-size: clamp(13px, 0.8125rem + 0.3vw, 16px);
}

`;

if (!css.includes('clamp(13px')) {
  css = fluidRules + css;
}

const cardCorporateOriginal = `.card-corporate {
  background-color: #ffffff;
  border-radius: 0.875rem;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}`;

const cardCorporatePatched = `.card-corporate {
  background-color: #ffffff;
  border-radius: 0.875rem;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* Prevent text overflow and overlaps */
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
}`;

css = css.replace(cardCorporateOriginal, cardCorporatePatched);

fs.writeFileSync('index.css', css);
console.log("Fluid typography patched in index.css!");
