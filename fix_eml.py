import re

file_path = r'src\features\Generator.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the entire generateEmlBlob function
old_func_start = "    const generateEmlBlob = async ({ to, cc, bcc, subject, html, from, customData = null }) => {"
old_func_end = "        emlContent += `\\n--${boundary}--\\n`;\r\n        return new Blob([emlContent], { type: \"message/rfc822\" });\r\n    };"

# Find start position
start_idx = content.find(old_func_start)
if start_idx == -1:
    print("ERROR: Could not find generateEmlBlob start")
    exit(1)

# Find end position (the closing }; of the function)
# We search from start_idx forward
search_from = start_idx
# Look for the return new Blob line followed by }; 
end_marker = '        return new Blob([emlContent], { type: "message/rfc822" });\r\n    };'
end_idx = content.find(end_marker, search_from)
if end_idx == -1:
    # try LF version
    end_marker = '        return new Blob([emlContent], { type: "message/rfc822" });\n    };'
    end_idx = content.find(end_marker, search_from)
    if end_idx == -1:
        print("ERROR: Could not find generateEmlBlob end marker")
        # Print region for debugging
        snippet = content[start_idx:start_idx+3000]
        print(repr(snippet[-500:]))
        exit(1)

end_idx = end_idx + len(end_marker)
old_func = content[start_idx:end_idx]
print(f"Found function at chars {start_idx}-{end_idx}")
print(f"Old function length: {len(old_func)} chars")

new_func = '''    const generateEmlBlob = async ({ to, cc, bcc, subject, html, from, customData = null }) => {
        const CRLF = "\\r\\n";
        const boundary = "----=_NextPart_" + Math.random().toString(36).substring(2);
        const realTo = injectData(to, customData);
        const realCc = injectData(cc, customData);
        const realBcc = injectData(bcc, customData);
        const realSubject = injectData(subject, customData);
        const realFrom = injectData(from, customData);

        // Safely encode subject for non-ASCII chars (Vietnamese, etc.)
        let encodedSubject = realSubject;
        try { encodedSubject = "=?utf-8?B?" + btoa(unescape(encodeURIComponent(realSubject))) + "?="; } catch (_e) { /* keep raw */ }

        // Build RFC 2822 headers (must use CRLF per spec)
        let emlContent = "MIME-Version: 1.0" + CRLF;
        emlContent += "X-Unsent: 1" + CRLF;
        if (realFrom) emlContent += "From: " + realFrom + CRLF;
        emlContent += "To: " + (realTo || "recipient@example.com") + CRLF;
        if (realCc) emlContent += "Cc: " + realCc + CRLF;
        if (realBcc) emlContent += "Bcc: " + realBcc + CRLF;
        emlContent += "Subject: " + encodedSubject + CRLF;
        emlContent += "Content-Type: multipart/mixed; boundary=\\"" + boundary + "\\"" + CRLF;
        emlContent += CRLF;

        // HTML body part
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
                emlContent += "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document; name=\\"" + attachName + "\\"" + CRLF;
                emlContent += "Content-Transfer-Encoding: base64" + CRLF;
                emlContent += "Content-Disposition: attachment; filename=\\"" + attachName + "\\"" + CRLF;
                emlContent += CRLF;
                emlContent += base64 + CRLF;
            } catch (e) {
                console.error("L\\u1ed7i \\u0111\\u00f3ng g\\u00f3i file \\u0111\\u00ednh k\\u00e8m:", e);
            }
        }

        // Optional: extra static attachments
        for (const file of emailConfig.attachments) {
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(",")[1]);
                reader.readAsDataURL(file);
            });
            emlContent += "--" + boundary + CRLF;
            emlContent += "Content-Type: application/octet-stream; name=\\"" + file.name + "\\"" + CRLF;
            emlContent += "Content-Transfer-Encoding: base64" + CRLF;
            emlContent += "Content-Disposition: attachment; filename=\\"" + file.name + "\\"" + CRLF;
            emlContent += CRLF;
            emlContent += base64 + CRLF;
        }

        emlContent += "--" + boundary + "--" + CRLF;
        return new Blob([emlContent], { type: "message/rfc822" });
    };'''

new_content = content[:start_idx] + new_func + content[end_idx:]
print(f"New content length: {len(new_content)} chars")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: generateEmlBlob rewritten correctly")
