const fs = require('fs');
const file = 'src/features/Generator.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
console.log('Total lines:', lines.length);

// Lines are 1-indexed in the editor but 0-indexed in array
// We want to DELETE lines 465 to 553 (1-indexed), which is index 464 to 552 (0-indexed)
// Lines 394-464 contain the new clean function
// Lines 555+ contain handleExcelUpload and onward

const deleteStart = 464; // 0-indexed, line 465
const deleteEnd = 552;   // 0-indexed, line 553 (inclusive)

console.log('Line 464 (1-indexed 465):', JSON.stringify(lines[464]));
console.log('Line 552 (1-indexed 553):', JSON.stringify(lines[552]));
console.log('Line 553 (1-indexed 554):', JSON.stringify(lines[553]));

const newLines = [...lines.slice(0, deleteStart), ...lines.slice(deleteEnd + 1)];
console.log('New total lines:', newLines.length);
fs.writeFileSync(file, newLines.join('\n'), 'utf8');
console.log('SUCCESS: Deleted duplicate function body lines 465-553');
