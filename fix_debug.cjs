const fs = require('fs');
const file = 'src/features/Generator.jsx';
let content = fs.readFileSync(file, 'utf8');

// Find the handleBatchEmail function and add console.log debug
const marker = 'const handleBatchEmail = async () => {';
const idx = content.indexOf(marker);
if (idx === -1) {
  console.log('ERROR: cannot find handleBatchEmail');
  process.exit(1);
}

// Find the next line after the opening brace
const insertPoint = idx + marker.length;
const debugLine = '\n        console.log("=== handleBatchEmail START ===", emailConfig.toArray.length, "recipients");';

// Also add debug after generateEmlBlob call
const emlBlobLine = 'const emlBlob = await generateEmlBlob({';
const emlIdx = content.indexOf(emlBlobLine, idx);
if (emlIdx === -1) {
  console.log('ERROR: cannot find generateEmlBlob call');
  process.exit(1);
}

// Find the closing }); of generateEmlBlob call
let depth = 0;
let closeIdx = -1;
for (let i = content.indexOf('{', emlIdx); i < content.length; i++) {
  if (content[i] === '{') depth++;
  if (content[i] === '}') {
    depth--;
    if (depth === 0) {
      // Find the next );
      closeIdx = content.indexOf(');', i) + 2;
      break;
    }
  }
}

// Insert debug after the generateEmlBlob call
const debugAfterEml = '\n                console.log("EML blob generated, size:", emlBlob.size);';
content = content.slice(0, closeIdx) + debugAfterEml + content.slice(closeIdx);

// Re-find and insert debug after the opening {
const newIdx = content.indexOf(marker);
const newInsertPoint = newIdx + marker.length;
content = content.slice(0, newInsertPoint) + debugLine + content.slice(newInsertPoint);

// Also add debug before saveAs
const saveAsLine = "saveAs(content, `Batch_Email_";
const saveIdx = content.indexOf(saveAsLine);
if (saveIdx !== -1) {
  const debugBeforeSave = '                console.log("ZIP ready, calling saveAs. Blob size:", content.size);\n';
  content = content.slice(0, saveIdx) + debugBeforeSave + content.slice(saveIdx);
}

// Add debug in catch block
const catchLine = 'toast.error("Lỗi xuất email: " + err.message)';
const catchIdx = content.indexOf(catchLine);
if (catchIdx === -1) {
  // Try alternate
  const catchLine2 = 'toast.error("L';
  const catchIdx2 = content.indexOf(catchLine2, newIdx + 500);
  if (catchIdx2 !== -1) {
    const debugCatch = '            console.error("=== handleBatchEmail ERROR ===", err);\n';
    content = content.slice(0, catchIdx2) + debugCatch + content.slice(catchIdx2);
  }
} else {
  const debugCatch = '            console.error("=== handleBatchEmail ERROR ===", err);\n';
  content = content.slice(0, catchIdx) + debugCatch + content.slice(catchIdx);
}

fs.writeFileSync(file, content, 'utf8');
console.log('SUCCESS: Debug logging added to handleBatchEmail');
