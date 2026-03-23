const fs = require('fs');
const file = 'src/features/Generator.jsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Remove states
c = c.replace(/const \[wordFileNameFormat, setWordFileNameFormat\].*;\n/g, '');
c = c.replace(/const \[activeTab, setActiveTab\] = useState\("word"\);/g, 'const [activeTab, setActiveTab] = useState("email");');
c = c.replace(/const \[batchMode, setBatchMode\] = useState\("word"\);/g, 'const [batchMode, setBatchMode] = useState("email");');

// 2. Remove handleGenerateWord
const hwStart = c.indexOf('const handleGenerateWord =');
if (hwStart !== -1) {
    const nextFunc = c.indexOf('const handlePreviewWord =', hwStart);
    if (nextFunc !== -1) {
        c = c.substring(0, hwStart) + c.substring(nextFunc);
    }
}

// 3. Remove handlePreviewWord
const hpStart = c.indexOf('const handlePreviewWord =');
if (hpStart !== -1) {
    const injectStart = c.indexOf('const injectData =', hpStart);
    if (injectStart !== -1) {
        c = c.substring(0, hpStart) + c.substring(injectStart);
    }
}

// 4. Clean up JSX
c = c.replace(/<button[^>]+onClick=\{\(\) => setActiveTab\("word"\)\}[^>]*>[\s\S]*?<FileText[^>]*\/> Word\s*<\/button>/g, '');

c = c.replace(/<div className="flex items-center gap-3">\s*\{activeTab === "word" && \([\s\S]*?className="px-3 py-2 bg-slate-50[\s\S]*?<\/select>\s*<\/>\s*\)\}\s*<\/div>\s*<\/div>\s*\{activeTab === "word" && \([\s\S]*?title=".*?\. "\s*\/>\s*<\/div>\s*\)\}\s*<\/div>/g, '</div></div></div>');


// 5. Remove the word rendering views
const viewsRegex = /\{activeTab === "word" && \([\s\S]*?Chưa chọn Mẫu Word[\s\S]*?\)\s*\)\}/g;
c = c.replace(viewsRegex, '');

// 6. Remove the footer word button
const footerRegex = /\{activeTab === "word" && \([\s\S]*?Xuất Word \(\.docx\)[\s\S]*?\)\}/g;
c = c.replace(footerRegex, '');

fs.writeFileSync(file, c, 'utf8');
console.log('Word generator code removed.');
