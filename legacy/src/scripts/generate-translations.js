// Helper script to generate translation file structure from English template
// This creates translation files with English as placeholder for languages that need translation
const fs = require('fs');
const path = require('path');

const enFile = path.join(__dirname, '../i18n/locales/en.json');
const localesDir = path.join(__dirname, '../i18n/locales');

// Languages that need translation files
const languages = ['te', 'kn', 'ml', 'gu', 'bn', 'mr', 'pa', 'or', 'as', 'ur', 'kok', 'sa'];

const enContent = JSON.parse(fs.readFileSync(enFile, 'utf8'));

languages.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  
  // For now, use English as placeholder - can be updated with proper translations later
  // This ensures the app works without breaking
  fs.writeFileSync(filePath, JSON.stringify(enContent, null, 2), 'utf8');
  console.log(`Created ${lang}.json`);
});

console.log('Translation files generated!');

