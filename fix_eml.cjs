const fs = require('fs');
const file = 'src/features/Generator.jsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '    const generateEmlBlob = async ({ to, cc, bcc, subject, html, from, customData = null }) => {';
const startIdx = content.indexOf(startMarker);
console.log('Start index:', startIdx);

// Find closing }; of the function by scanning from start
let depth = 0;
let funcEnd = -1;
let inFunc = false;
for (let i = startIdx; i < content.length; i++) {
  if (content[i] === '{') { depth++; inFunc = true; }
  if (content[i] === '}') {
    depth--;
    if (inFunc && depth === 0) {
      // Skip the next `;` if there is one
      let j = i + 1;
      while (j < content.length && (content[j] === ';' || content[j] === '\r' || content[j] === '\n')) {
        if (content[j] === ';') { j++; break; }
        break;
      }
      funcEnd = j;
      break;
    }
  }
}
console.log('Function end at:', funcEnd);
console.log('Old func length:', funcEnd - startIdx);

const newFunc = `    const generateEmlBlob = async ({ to, cc, bcc, subject, html, from, customData = null }) => {
        const CRLF = "\\r\\n";
        const boundary = "----=_NextPart_" + Math.random().toString(36).substring(2);
        const realTo = injectData(to, customData);
        const realCc = injectData(cc, customData);
        const realBcc = injectData(bcc, customData);
        const realSubject = injectData(subject, customData);
        const realFrom = injectData(from, customData);

        // Safely encode subject for non-ASCII (Vietnamese, etc.)
        let encodedSubject = realSubject;
        try { encodedSubject = "=?utf-8?B?" + btoa(unescape(encodeURIComponent(realSubject))) + "?="; } catch (_e) { /* keep raw */ }

        // Build RFC 2822 headers (MUST use CRLF per spec)
        let emlContent = "MIME-Version: 1.0" + CRLF;
        emlContent += "X-Unsent: 1" + CRLF;
        if (realFrom) emlContent += "From: " + realFrom + CRLF;
        emlContent += "To: " + (realTo || "recipient@example.com") + CRLF;
        if (realCc) emlContent += "Cc: " + realCc + CRLF;
        if (realBcc) emlContent += "Bcc: " + realBcc + CRLF;
        emlContent += "Subject: " + encodedSubject + CRLF;
        emlContent += 'Content-Type: multipart/mixed; boundary="' + boundary + '"' + CRLF;
        emlContent += CRLF; // blank line between headers and body

        // HTML part
        emlContent += "--" + boundary + CRLF;
        emlContent += "Content-Type: text/html; charset=utf-8" + CRLF;
        emlContent += "Content-Transfer-Encoding: 8bit" + CRLF;
        emlContent += CRLF;
        emlContent += html + CRLF;

        // Optional: attach generated Word doc
        if (emailConfig.attachWord && activeTemplate?.fileBlob) {
            try {
                const arrayBuffer = await activeTemplate.fileBlob.arrayBuffer();
                const mergedData = { ...(customData || formData), ...rawXmlData };
                const docBlob = generateDocumentBlob(arrayBuffer, mergedData);
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(",")[1]);
                    reader.readAsDataURL(docBlob);
                });
                const attachName = "Generated_" + activeTemplate.fileName;
                emlContent += "--" + boundary + CRLF;
                emlContent += 'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document; name="' + attachName + '"' + CRLF;
                emlContent += "Content-Transfer-Encoding: base64" + CRLF;
                emlContent += 'Content-Disposition: attachment; filename="' + attachName + '"' + CRLF;
                emlContent += CRLF;
                emlContent += base64 + CRLF;
            } catch (e) {
                console.error("Loi dinh kem:", e);
            }
        }

        // Optional: extra attachments
        for (const file of emailConfig.attachments) {
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(",")[1]);
                reader.readAsDataURL(file);
            });
            emlContent += "--" + boundary + CRLF;
            emlContent += 'Content-Type: application/octet-stream; name="' + file.name + '"' + CRLF;
            emlContent += "Content-Transfer-Encoding: base64" + CRLF;
            emlContent += 'Content-Disposition: attachment; filename="' + file.name + '"' + CRLF;
            emlContent += CRLF;
            emlContent += base64 + CRLF;
        }

        emlContent += "--" + boundary + "--" + CRLF;
        return new Blob([emlContent], { type: "message/rfc822" });
    };`;

const newContent = content.slice(0, startIdx) + newFunc + content.slice(funcEnd);
fs.writeFileSync(file, newContent, 'utf8');
console.log('SUCCESS: generateEmlBlob replaced. New file length:', newContent.length);
