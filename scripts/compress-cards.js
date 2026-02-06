const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'assets', 'images', 'cards');
const TARGET_WIDTH = 200; // רוחב מספיק לתצוגה חדה
const QUALITY = 80; // איכות PNG

async function compressImage(inputPath, outputPath) {
    try {
        const metadata = await sharp(inputPath).metadata();
        const originalSize = fs.statSync(inputPath).size;
        
        await sharp(inputPath)
            .resize(TARGET_WIDTH, null, { 
                fit: 'inside',
                withoutEnlargement: true 
            })
            .png({ 
                quality: QUALITY,
                compressionLevel: 9,
                palette: true
            })
            .toFile(outputPath + '.tmp');
        
        // Replace original with compressed
        fs.unlinkSync(inputPath);
        fs.renameSync(outputPath + '.tmp', outputPath);
        
        const newSize = fs.statSync(outputPath).size;
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
        
        console.log(`✓ ${path.basename(inputPath)}: ${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (${savings}% smaller)`);
        
        return { original: originalSize, compressed: newSize };
    } catch (err) {
        console.error(`✗ Error with ${inputPath}:`, err.message);
        return { original: 0, compressed: 0 };
    }
}

async function processFolder(folderPath) {
    const files = fs.readdirSync(folderPath);
    let totalOriginal = 0;
    let totalCompressed = 0;
    
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            const subResult = await processFolder(filePath);
            totalOriginal += subResult.original;
            totalCompressed += subResult.compressed;
        } else if (/\.(png|jpg|jpeg)$/i.test(file)) {
            // Convert JPG to PNG and compress
            const outputPath = filePath.replace(/\.(jpg|jpeg)$/i, '.png');
            const result = await compressImage(filePath, outputPath);
            totalOriginal += result.original;
            totalCompressed += result.compressed;
        }
    }
    
    return { original: totalOriginal, compressed: totalCompressed };
}

async function main() {
    console.log('🎴 מתחיל דחיסת קלפים...\n');
    console.log(`תיקייה: ${CARDS_DIR}\n`);
    
    const result = await processFolder(CARDS_DIR);
    
    console.log('\n════════════════════════════════════════');
    console.log(`📊 סיכום:`);
    console.log(`   גודל מקורי: ${(result.original / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   גודל אחרי דחיסה: ${(result.compressed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   חיסכון: ${((1 - result.compressed / result.original) * 100).toFixed(1)}%`);
    console.log('════════════════════════════════════════');
}

main().catch(console.error);
