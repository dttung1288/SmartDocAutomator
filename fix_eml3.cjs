const fs = require('fs');
const file = 'src/features/Generator.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
console.log('Total lines:', lines.length);

// Line 464 (1-indexed, 0-indexed = 463 ) should be the return statement of generateEmlBlob
// Line 465 (0-indexed = 464) is empty
// We need to insert '    };' after line 464 (0-indexed 463)
console.log('Line 463:', JSON.stringify(lines[463]));
console.log('Line 464:', JSON.stringify(lines[464]));
console.log('Line 465:', JSON.stringify(lines[465]));

// Insert '    };' at position 464 (after the return statement)
lines.splice(464, 0, '    };');
console.log('After splice line 464:', JSON.stringify(lines[464]));
console.log('After splice line 465:', JSON.stringify(lines[465]));

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('SUCCESS: Inserted closing }; at line 465. New total:', lines.length);
