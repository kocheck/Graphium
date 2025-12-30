#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL for IBM Plex fonts
const BASE_URL = 'https://unpkg.com/@ibm/plex@6.4.1';

// Font definitions
const fonts = {
  'ibm-plex-sans': [
    'IBMPlexSans-Regular.woff2',
    'IBMPlexSans-Medium.woff2',
    'IBMPlexSans-SemiBold.woff2',
    'IBMPlexSans-Bold.woff2'
  ],
  'ibm-plex-mono': [
    'IBMPlexMono-Regular.woff2',
    'IBMPlexMono-Medium.woff2',
    'IBMPlexMono-SemiBold.woff2',
    'IBMPlexMono-Bold.woff2'
  ]
};

// Download a single file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirects
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function downloadFonts() {
  console.log('📥 Downloading IBM Plex fonts...\n');

  const projectRoot = path.resolve(__dirname, '..');
  const fontsDir = path.join(projectRoot, 'src', 'assets', 'fonts');

  // Create directories
  for (const fontFamily of Object.keys(fonts)) {
    const dir = path.join(fontsDir, fontFamily);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Download fonts
  let totalDownloaded = 0;
  let totalSkipped = 0;
  let errors = [];

  for (const [fontFamily, fontFiles] of Object.entries(fonts)) {
    const familyName = fontFamily === 'ibm-plex-sans' ? 'IBM Plex Sans' : 'IBM Plex Mono';
    const urlPath = fontFamily === 'ibm-plex-sans' ? 'IBM-Plex-Sans' : 'IBM-Plex-Mono';

    console.log(`🔤 ${familyName}...`);

    for (const fontFile of fontFiles) {
      const destPath = path.join(fontsDir, fontFamily, fontFile);

      // Skip if already exists
      if (fs.existsSync(destPath)) {
        const stats = fs.statSync(destPath);
        if (stats.size > 0) {
          console.log(`  ⏭️  ${fontFile} (already exists)`);
          totalSkipped++;
          continue;
        }
      }

      const url = `${BASE_URL}/${urlPath}/fonts/complete/woff2/${fontFile}`;

      try {
        await downloadFile(url, destPath);
        const stats = fs.statSync(destPath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`  ✓ ${fontFile} (${sizeKB} KB)`);
        totalDownloaded++;
      } catch (error) {
        console.error(`  ✗ ${fontFile} - ${error.message}`);
        errors.push({ file: fontFile, error: error.message });
      }
    }
    console.log('');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (errors.length === 0) {
    console.log('✅ All fonts ready!');
    console.log(`   Downloaded: ${totalDownloaded}`);
    console.log(`   Skipped: ${totalSkipped}`);
  } else {
    console.log('⚠️  Some fonts failed to download:');
    errors.forEach(({ file, error }) => {
      console.log(`   • ${file}: ${error}`);
    });
    console.log(`\n   Downloaded: ${totalDownloaded}`);
    console.log(`   Failed: ${errors.length}`);
    console.log('\nPlease download the missing fonts manually from:');
    console.log('https://github.com/IBM/plex/releases');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Exit with error code if downloads failed
  if (errors.length > 0 && totalDownloaded === 0) {
    process.exit(1);
  }
}

// Run the download
downloadFonts().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
