const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const route = `
  // --- AI DOCUMENT TRANSLATION ENDPOINT ---
  app.post("/api/v1/documents/translate", async (req, res) => {
    const { text, targetLanguage = 'English' } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for translation." });
    }
    
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const prompt = \`You are a professional translator for business documents and invoices.
First, identify the language of the following invoice text.
Then, translate the entire text into \${targetLanguage}.

Format your response exactly as a JSON object:
{
  "detectedLanguage": "The name of the detected language (e.g. 'French', 'Japanese', 'Hindi', etc.)",
  "translatedText": "The fully translated text"
}

Invoice text to translate:
"""
\${text}
"""\`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    detectedLanguage: { type: Type.STRING },
                    translatedText: { type: Type.STRING }
                }
            }
        }
      });
      
      const jsonStr = response.text.trim();
      const result = JSON.parse(jsonStr);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[Translation API Error]:", err);
      res.status(500).json({ error: err.message || "Failed to translate document" });
    }
  });
`;

content = content.replace(
  '  // Organization Module Endpoints',
  route + '\n  // Organization Module Endpoints'
);

fs.writeFileSync(file, content);
