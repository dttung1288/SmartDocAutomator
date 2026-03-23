import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

function expressionParser(tag) {
    return {
        get: function (scope) {
            if (tag === '.') return scope;
            // Trả về string rỗng nếu không tìm thấy thay vì văng lỗi undefined
            return scope[tag] || "";
        }
    };
}

/**
 * Generate a Word document from an ArrayBuffer template and data dictionary
 */
export const generateDocumentBlob = (templateArrayBuffer, data) => {
    try {
        const zip = new PizZip(templateArrayBuffer);
        
        let altChunkCounter = 0;
        const documentRelsPath = "word/_rels/document.xml.rels";
        const documentRels = zip.files[documentRelsPath];
        let relsContent = documentRels ? documentRels.asText() : "";

        // Clone data so we don't mutate the original
        const processData = { ...data };

        // --- TRUE XML MERGER (Browser DOMParser based) ---
        Object.keys(processData).forEach(k => {
            if (processData[k] && typeof processData[k] === 'object' && processData[k].type === 'altChunk' && processData[k].buffer) {
                altChunkCounter++;
                const prefix = `c${altChunkCounter}_`;
                const numOffset = 1000000 + (altChunkCounter * 1000);

                try {
                    const chunkZip = new PizZip(processData[k].buffer);
                    const parser = new DOMParser();
                    const serializer = new XMLSerializer();

                    // --- 1. MERGE NUMBERING (Bullets) ---
                    let mainNumContent = zip.file("word/numbering.xml")?.asText();
                    const childNumContent = chunkZip.file("word/numbering.xml")?.asText();
                    
                    if (childNumContent) {
                        if (!mainNumContent) {
                            // If host doesn't have numbering.xml, create an empty one
                            mainNumContent = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:numbering>';
                            
                            // Must register it in [Content_Types].xml and document.xml.rels!
                            // Content_Types:
                            const ctFile = zip.files["[Content_Types].xml"];
                            if (ctFile) {
                                let ctStr = ctFile.asText();
                                if (!ctStr.includes('PartName="/word/numbering.xml"')) {
                                    ctStr = ctStr.replace('</Types>', `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`);
                                    zip.file("[Content_Types].xml", ctStr);
                                }
                            }
                            // Rels:
                            if (relsContent && !relsContent.includes('Target="numbering.xml"')) {
                                relsContent = relsContent.replace('</Relationships>', `<Relationship Id="rIdNumberingNew" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
                            }
                        }

                        const mainNumDoc = parser.parseFromString(mainNumContent, "text/xml");
                        const childNumDoc = parser.parseFromString(childNumContent, "text/xml");
                        const wNumbering = mainNumDoc.getElementsByTagName("w:numbering")[0];
                        const firstNumInHost = wNumbering.getElementsByTagName("w:num")[0];
                        
                        // Process abstractNum. OpenXML schema STRICTLY REQUIRES all <w:abstractNum> be BEFORE <w:num>
                        const absNums = childNumDoc.getElementsByTagName("w:abstractNum");
                        for (let i = 0; i < absNums.length; i++) {
                            const node = absNums[i];
                            const idStr = node.getAttribute("w:abstractNumId");
                            if (idStr) node.setAttribute("w:abstractNumId", parseInt(idStr, 10) + numOffset);

                            const pStyles = node.getElementsByTagName("w:pStyle");
                            for (let j = 0; j < pStyles.length; j++) {
                                const v = pStyles[j].getAttribute("w:val");
                                if (v) pStyles[j].setAttribute("w:val", prefix + v);
                            }
                            
                            if (firstNumInHost) {
                                wNumbering.insertBefore(mainNumDoc.importNode(node, true), firstNumInHost);
                            } else {
                                wNumbering.appendChild(mainNumDoc.importNode(node, true));
                            }
                        }
                        
                        // Process num
                        const nums = childNumDoc.getElementsByTagName("w:num");
                        for (let i = 0; i < nums.length; i++) {
                            const node = nums[i];
                            const idStr = node.getAttribute("w:numId");
                            if (idStr) node.setAttribute("w:numId", parseInt(idStr, 10) + numOffset);

                            const absRef = node.getElementsByTagName("w:abstractNumId")[0];
                            if (absRef) {
                                const v = absRef.getAttribute("w:val");
                                if (v) absRef.setAttribute("w:val", parseInt(v, 10) + numOffset);
                            }
                            wNumbering.appendChild(mainNumDoc.importNode(node, true));
                        }
                        zip.file("word/numbering.xml", serializer.serializeToString(mainNumDoc));
                    }

                    // --- 2. MERGE STYLES ---
                    const mainStylesContent = zip.file("word/styles.xml")?.asText();
                    const childStylesContent = chunkZip.file("word/styles.xml")?.asText();

                    if (mainStylesContent && childStylesContent) {
                        const mainStylesDoc = parser.parseFromString(mainStylesContent, "text/xml");
                        const childStylesDoc = parser.parseFromString(childStylesContent, "text/xml");
                        
                        const wStyles = mainStylesDoc.getElementsByTagName("w:styles")[0];
                        const childStyles = childStylesDoc.getElementsByTagName("w:style");
                        
                        for (let i = 0; i < childStyles.length; i++) {
                            const node = childStyles[i];
                            const idStr = node.getAttribute("w:styleId");
                            if (idStr) node.setAttribute("w:styleId", prefix + idStr);

                            const basedOn = node.getElementsByTagName("w:basedOn")[0];
                            if (basedOn) {
                                const v = basedOn.getAttribute("w:val");
                                if (v) basedOn.setAttribute("w:val", prefix + v);
                            }
                            const link = node.getElementsByTagName("w:link")[0];
                            if (link) {
                                const v = link.getAttribute("w:val");
                                if (v) link.setAttribute("w:val", prefix + v);
                            }
                            const next = node.getElementsByTagName("w:next")[0];
                            if (next) {
                                const v = next.getAttribute("w:val");
                                if (v) next.setAttribute("w:val", prefix + v);
                            }
                            
                            const numPrs = node.getElementsByTagName("w:numPr");
                            for (let j = 0; j < numPrs.length; j++) {
                                const numId = numPrs[j].getElementsByTagName("w:numId")[0];
                                if (numId) {
                                    const v = numId.getAttribute("w:val");
                                    if (v) numId.setAttribute("w:val", parseInt(v, 10) + numOffset);
                                }
                            }
                            
                            wStyles.appendChild(mainStylesDoc.importNode(node, true));
                        }
                        zip.file("word/styles.xml", serializer.serializeToString(mainStylesDoc));
                    }

                    // --- 3. EXTRACT AND ISOLATE INNER <w:body> ---
                    const childDocContent = chunkZip.file("word/document.xml")?.asText();
                    if (childDocContent) {
                        const childDoc = parser.parseFromString(childDocContent, "text/xml");
                        
                        // --- 3.5 CONVERT AUTO-NUMBERING TO PLAIN TEXT ---
                        // "Phá đếm tự động" to hardcode text values for numbering, solving the 2.1 mapping to 1.1 issue completely.
                        try {
                            if (childNumContent) {
                                const childNumDocLocal = parser.parseFromString(childNumContent, "text/xml");
                                const listDefinitions = {};
                                const abstractNums = childNumDocLocal.getElementsByTagName("w:abstractNum");
                                for (let i = 0; i < abstractNums.length; i++) {
                                    const absId = abstractNums[i].getAttribute("w:abstractNumId");
                                    listDefinitions[absId] = { levels: {} };
                                    const lvls = abstractNums[i].getElementsByTagName("w:lvl");
                                    for (let j = 0; j < lvls.length; j++) {
                                        const ilvl = lvls[j].getAttribute("w:ilvl");
                                        const start = lvls[j].getElementsByTagName("w:start")[0]?.getAttribute("w:val") || "1";
                                        const numFmt = lvls[j].getElementsByTagName("w:numFmt")[0]?.getAttribute("w:val") || "decimal";
                                        const lvlText = lvls[j].getElementsByTagName("w:lvlText")[0]?.getAttribute("w:val") || "";
                                        const rPrNode = lvls[j].getElementsByTagName("w:rPr")[0] || null;
                                        const pPrNode = lvls[j].getElementsByTagName("w:pPr")[0] || null;
                                        listDefinitions[absId].levels[ilvl] = { start: parseInt(start, 10), numFmt, lvlText, rPrNode, pPrNode };
                                    }
                                }

                                const listInstances = {}; 
                                const nums = childNumDocLocal.getElementsByTagName("w:num");
                                for (let i = 0; i < nums.length; i++) {
                                    const numId = nums[i].getAttribute("w:numId");
                                    const absId = nums[i].getElementsByTagName("w:abstractNumId")[0]?.getAttribute("w:val");
                                    listInstances[numId] = { absId, overrides: {} };
                                    const overrides = nums[i].getElementsByTagName("w:lvlOverride");
                                    for (let j = 0; j < overrides.length; j++) {
                                        const ilvl = overrides[j].getAttribute("w:ilvl");
                                        const startOverride = overrides[j].getElementsByTagName("w:startOverride")[0]?.getAttribute("w:val");
                                        if (startOverride) {
                                            listInstances[numId].overrides[ilvl] = { start: parseInt(startOverride, 10) };
                                        }
                                    }
                                }

                                const toRoman = (num) => {
                                    if (isNaN(num) || num <= 0) return "";
                                    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
                                    let str = '';
                                    for (const i of Object.keys(roman)) {
                                        const q = Math.floor(num / roman[i]);
                                        num -= q * roman[i];
                                        str += i.repeat(q);
                                    }
                                    return str;
                                };

                                const counters = {};
                                const paragraphs = childDoc.getElementsByTagName("w:p");
                                for (let i = 0; i < paragraphs.length; i++) {
                                    const p = paragraphs[i];
                                    const pPr = p.getElementsByTagName("w:pPr")[0];
                                    if (!pPr) continue;
                                    const numPr = pPr.getElementsByTagName("w:numPr")[0];
                                    if (!numPr) continue;

                                    const numIdNode = numPr.getElementsByTagName("w:numId")[0];
                                    const ilvlNode = numPr.getElementsByTagName("w:ilvl")[0];
                                    const numId = numIdNode ? numIdNode.getAttribute("w:val") : null;
                                    const ilvl = ilvlNode ? parseInt(ilvlNode.getAttribute("w:val"), 10) : 0;

                                    if (numId && listInstances[numId]) {
                                        const instance = listInstances[numId];
                                        const def = listDefinitions[instance.absId];
                                        if (def) {
                                            if (!counters[numId]) counters[numId] = {};
                                            for (let l = 0; l < ilvl; l++) {
                                                if (counters[numId][l] === undefined) {
                                                     let st = instance.overrides[l]?.start;
                                                     if (st === undefined) st = def.levels[l]?.start;
                                                     counters[numId][l] = st !== undefined ? st : 1;
                                                }
                                            }
                                            if (counters[numId][ilvl] === undefined) {
                                                let st = instance.overrides[ilvl]?.start;
                                                if (st === undefined) st = def.levels[ilvl]?.start;
                                                counters[numId][ilvl] = st !== undefined ? st : 1;
                                            } else {
                                                counters[numId][ilvl]++;
                                            }
                                            for (let l = ilvl + 1; l < 9; l++) counters[numId][l] = undefined;

                                            let formatStr = def.levels[ilvl]?.lvlText || "";
                                            if (formatStr.includes("%")) {
                                                for (let l = 0; l <= ilvl; l++) {
                                                    const val = counters[numId][l];
                                                    const fmt = def.levels[l]?.numFmt || "decimal";
                                                    let valStr = val?.toString() || "1";
                                                    if (fmt === "lowerLetter") valStr = String.fromCharCode(96 + val); 
                                                    else if (fmt === "upperLetter") valStr = String.fromCharCode(64 + val); 
                                                    else if (fmt === "lowerRoman") valStr = toRoman(val).toLowerCase();
                                                    else if (fmt === "upperRoman") valStr = toRoman(val).toUpperCase();
                                                    
                                                    formatStr = formatStr.replace(new RegExp(`%${l+1}`, 'g'), valStr);
                                                }
                                            }

                                            const bulletR = childDoc.createElement("w:r");
                                            const bulletRPr = def.levels[ilvl]?.rPrNode;
                                            if (bulletRPr) bulletR.appendChild(bulletRPr.cloneNode(true));
                                            
                                            const bulletT = childDoc.createElement("w:t");
                                            bulletT.textContent = formatStr + "\t"; 
                                            bulletT.setAttribute("xml:space", "preserve");
                                            bulletR.appendChild(bulletT);

                                            const firstRun = p.getElementsByTagName("w:r")[0];
                                            if (firstRun) {
                                                p.insertBefore(bulletR, firstRun);
                                            } else {
                                                p.appendChild(bulletR);
                                            }

                                            if (def.levels[ilvl]?.pPrNode) {
                                                const srcInd = def.levels[ilvl].pPrNode.getElementsByTagName("w:ind")[0];
                                                if (srcInd) {
                                                    const existingInd = pPr.getElementsByTagName("w:ind")[0];
                                                    if (existingInd) pPr.removeChild(existingInd);
                                                    pPr.appendChild(srcInd.cloneNode(true));
                                                }
                                            }

                                            pPr.removeChild(numPr);
                                        }
                                    }
                                }
                            }
                        } catch(err) {
                            console.warn("Could not parse bullets to plain text", err);
                        }

                        // Isolate all ID references inside the document body
                        const pStyles = childDoc.getElementsByTagName("w:pStyle");
                        for (let i = 0; i < pStyles.length; i++) {
                            const v = pStyles[i].getAttribute("w:val");
                            if (v) pStyles[i].setAttribute("w:val", prefix + v);
                        }
                        const rStyles = childDoc.getElementsByTagName("w:rStyle");
                        for (let i = 0; i < rStyles.length; i++) {
                            const v = rStyles[i].getAttribute("w:val");
                            if (v) rStyles[i].setAttribute("w:val", prefix + v);
                        }
                        const tblStyles = childDoc.getElementsByTagName("w:tblStyle");
                        for (let i = 0; i < tblStyles.length; i++) {
                            const v = tblStyles[i].getAttribute("w:val");
                            if (v) tblStyles[i].setAttribute("w:val", prefix + v);
                        }
                        const numIds = childDoc.getElementsByTagName("w:numId");
                        for (let i = 0; i < numIds.length; i++) {
                            const v = numIds[i].getAttribute("w:val");
                            if (v) numIds[i].setAttribute("w:val", parseInt(v, 10) + numOffset);
                        }

                        // Extract inner HTML of <w:body>
                        const body = childDoc.getElementsByTagName("w:body")[0];
                        
                        // --- 4. THEME & DEFAULT FONT RESILIENCE ---
                        // Find default font in child styles to prevent falling back to host's default font.
                        let defaultFontName = "Arial"; // Safe fallback as requested by user
                        try {
                            let defaultRFontsNode = null;
                            const docDefaults = childStylesDoc.getElementsByTagName("w:docDefaults")[0];
                            if (docDefaults) {
                                const rPrDds = docDefaults.getElementsByTagName("w:rFonts");
                                if (rPrDds.length > 0) defaultRFontsNode = rPrDds[0];
                            }
                            if (!defaultRFontsNode) {
                                for (let i = 0; i < childStyles.length; i++) {
                                    if (childStyles[i].getAttribute("w:default") === "1") {
                                        const rFonts = childStyles[i].getElementsByTagName("w:rFonts")[0];
                                        if (rFonts) {
                                            defaultRFontsNode = rFonts;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (defaultRFontsNode) {
                                if (defaultRFontsNode.getAttribute("w:ascii")) {
                                    defaultFontName = defaultRFontsNode.getAttribute("w:ascii");
                                } else if (defaultRFontsNode.getAttribute("w:asciiTheme")) {
                                    const themeName = defaultRFontsNode.getAttribute("w:asciiTheme");
                                    const themeXmlContent = chunkZip.file("word/theme/theme1.xml")?.asText();
                                    if (themeXmlContent) {
                                        const themeDoc = parser.parseFromString(themeXmlContent, "text/xml");
                                        const fontScheme = themeDoc.getElementsByTagName("a:fontScheme")[0];
                                        if (fontScheme) {
                                            const category = themeName.startsWith("minor") ? "a:minorFont" : "a:majorFont";
                                            const fontCat = fontScheme.getElementsByTagName(category)[0];
                                            if (fontCat) {
                                                const latin = fontCat.getElementsByTagName("a:latin")[0];
                                                if (latin && latin.getAttribute("typeface")) {
                                                    defaultFontName = latin.getAttribute("typeface");
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn("Could not extract child default font, defaulting to Arial", err);
                        }

                        // Apply the default font to ALL runs to force overwrite any host defaults
                        const runs = body.getElementsByTagName("w:r");
                        for (let i = 0; i < runs.length; i++) {
                            const run = runs[i];
                            let rPr = run.getElementsByTagName("w:rPr")[0];
                            if (!rPr) {
                                rPr = childDoc.createElement("w:rPr");
                                run.insertBefore(rPr, run.firstChild);
                            }
                            
                            let rFonts = rPr.getElementsByTagName("w:rFonts")[0];
                            if (!rFonts) {
                                rFonts = childDoc.createElement("w:rFonts");
                                rPr.appendChild(rFonts);
                            }
                            
                            // Only force if explicit font not set, or mapping theme to explicit
                            if (!rFonts.getAttribute("w:ascii")) rFonts.setAttribute("w:ascii", defaultFontName);
                            if (!rFonts.getAttribute("w:hAnsi")) rFonts.setAttribute("w:hAnsi", defaultFontName);
                            if (!rFonts.getAttribute("w:cs")) rFonts.setAttribute("w:cs", defaultFontName);
                            if (!rFonts.getAttribute("w:eastAsia")) rFonts.setAttribute("w:eastAsia", defaultFontName);
                            
                            // Remove theme bindings to ensure hardcoded font wins
                            rFonts.removeAttribute("w:asciiTheme");
                            rFonts.removeAttribute("w:hAnsiTheme");
                            rFonts.removeAttribute("w:cstheme");
                            rFonts.removeAttribute("w:eastAsiaTheme");
                        }

                        let innerXml = "";
                        for (let i = 0; i < body.childNodes.length; i++) {
                            const node = body.childNodes[i];
                            if (node.nodeName !== "w:sectPr") {
                                innerXml += serializer.serializeToString(node);
                            }
                        }
                        
                        // Make processData ready for Raw XML Docxtemplater processing
                        processData[k] = innerXml;
                    }

                } catch (e) {
                    console.error("DOMParser Merge Error:", e);
                    processData[k] = processData[k].rawXml || ""; // fallback
                }
            }
        });

        if (relsContent) {
            zip.file(documentRelsPath, relsContent);
        }

        // 1. Tiền xử lý XML: Dọn dẹp các đoạn tag rác của Word cản trở việc đọc biến
        Object.keys(zip.files).forEach(fileName => {
            if (fileName.endsWith('.xml')) {
                let content = zip.files[fileName].asText();
                // 1.1 Xoá các tag kiểm tra chính tả/ngữ pháp và bookmark có thể chen vào giữa ngoặc nhọn {{ }}
                content = content.replace(/<w:proofErr[^>]*>/g, '');
                content = content.replace(/<w:bookmarkStart[^>]*>/g, '');
                content = content.replace(/<w:bookmarkEnd[^>]*>/g, '');

                // 1.2 Xóa Track Changes: 
                content = content.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '');
                content = content.replace(/<\/?\w:ins\b[^>]*>/g, '');

                // 1.3 Xóa các tag ngắt trang tự động chèn giữa dòng
                content = content.replace(/<w:lastRenderedPageBreak\s*\/>/g, '');

                // 1.4: GHÉP CÁC TEMPLATE TAG BỊ TÁCH ({{...}} bị Word chia thành nhiều <w:r>)
                // Ví dụ: <w:r><w:t>{{Clause 4</w:t></w:r><w:r><w:t>_Content}}</w:t></w:r>
                // → cần ghép lại thành: <w:r><w:t>{{Clause 4_Content}}</w:t></w:r>
                // Nếu không ghép, regex chuyển {{...}} → {{@...}} sẽ không tìm thấy tag liền mạch.
                {
                    let prevXml;
                    do {
                        prevXml = content;
                        content = content.replace(
                            /(<w:t[^>]*>)([^<]*\{\{(?:(?!\}\})[^<])*)<\/w:t>\s*<\/w:r>\s*<w:r\b[^>]*>\s*(?:<w:rPr\b[^>]*(?:\/>|>[\s\S]*?<\/w:rPr>))?\s*<w:t[^>]*>([^<]*<\/w:t>\s*<\/w:r>)/g,
                            '$1$2$3'
                        );
                    } while (content !== prevXml);
                }

                // Docxtemplater already replaces {@key} with raw XML.
                // We no longer need the w:altChunk <w:p> replacement natively because processData[k] is now standard rawXml!

                // 1.5: TỰ ĐỘNG CHUYỂN HOÁN TAG TEXT THÀNH RAW XML {{@...}}
                Object.keys(processData).forEach(k => {
                    if (processData[k] && typeof processData[k] === 'string' && (processData[k].startsWith('<w:') || processData[k].includes('<w:p>') || processData[k].includes('</w:p>'))) {
                        const escapedKey = k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
                        if (content.match(regex)) {
                            content = content.replace(regex, `{{@${k}}}`);
                        }
                    }
                });

                zip.file(fileName, content);
            }
        });

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: {
                start: '{{',
                end: '}}'
            },
            parser: expressionParser,
        });

        // 2. Render the document
        doc.render(processData);

        // 3. Generate output zip as blob
        return doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
    } catch (error) {
        console.error("Error generating document blob:", error);

        // Bắt lỗi MultiError chi tiết của DocxTemplater
        if (error.properties && error.properties.errors instanceof Array) {
            const errorMessages = error.properties.errors.map(function (err) {
                // bóc tách lỗi chi tiết để hiển thị: (VD: Unclosed tag, Unopened tag, v.v.)
                return err.properties.explanation || err.message || err.name;
            }).join(" | ");
            throw new Error(`Cú pháp Template Word bị lỗi: ${errorMessages}`);
        }

        throw error;
    }
};

export const generateDocument = (templateArrayBuffer, data, fileName = "output.docx") => {
    try {
        const blob = generateDocumentBlob(templateArrayBuffer, data);
        saveAs(blob, fileName);
        return true;
    } catch (error) {
        console.error("Error generating document:", error);
        throw error;
    }
};

/**
 * Extract placeholders from raw text format: {{placeholder}}
 */
export const extractPlaceholdersFromText = (text) => {
    // Regex lấy trong ngoặc kép: cho phép cả dấu cách, gạch ngang
    const regex = /\{\{([a-zA-Z0-9_\s\-]+)\}\}/g;
    const placeholders = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
        placeholders.add(match[1].trim());
    }
    return Array.from(placeholders);
};

/**
 * Read DOCX template and extract placeholders
 */
export const analyzeDocxTemplate = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const zip = new PizZip(e.target.result);

                // Thay vì gọi Docxtemplater khởi tạo (hay văng Multi Error do Word chèn mã lạ vào giữa biến), chúng ta sẽ đọc thuần file XML.
                let text = "";
                const docXml = zip.files["word/document.xml"]?.asText();
                const headerXmls = Object.keys(zip.files).filter(k => k.startsWith("word/header")).map(k => zip.files[k].asText());
                const footerXmls = Object.keys(zip.files).filter(k => k.startsWith("word/footer")).map(k => zip.files[k].asText());

                let allXml = [docXml, ...headerXmls, ...footerXmls].filter(Boolean).join(" ");

                if (allXml) {
                    // Xóa triệt để các tag XML <w:t> bị Word ngắt đôi
                    text = allXml.replace(/<[^>]+>/g, "");
                }

                const placeholders = extractPlaceholdersFromText(text);

                resolve({
                    arrayBuffer: e.target.result,
                    placeholders,
                    fileName: file.name,
                    rawText: text
                });
            } catch (err) {
                reject(new Error("Invalid DOCX format or corrupted file."));
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Generate Email Body and trigger mailto / Outlook
 */
export const generateEmail = (templateHtml, data) => {
    let resultHtml = templateHtml;
    // Simple replace
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        resultHtml = resultHtml.replace(regex, data[key]);
    });
    return resultHtml;
};

export const openOutlookEmail = (to, subject, bodyHtml) => {
    const tempElement = document.createElement("div");
    tempElement.innerHTML = bodyHtml;
    document.body.appendChild(tempElement);

    // Copy to clipboard
    const range = document.createRange();
    range.selectNode(tempElement);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Cant copy', err);
    }

    window.getSelection().removeAllRanges();
    document.body.removeChild(tempElement);

    const plainText = tempElement.innerText;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Please paste (Ctrl+V) the copied rich text here if your mail client supports it, otherwise here is the plain text:\n\n" + plainText)}`;
};

export const extractDocxContent = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const zip = new PizZip(e.target.result);
                const docXml = zip.files["word/document.xml"]?.asText();
                if (!docXml) {
                    resolve({ text: "", rawXml: "" });
                    return;
                }

                // Trích xuất text thuần túy để preview
                const paragraphMatches = docXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];
                const paragraphsText = paragraphMatches.map(pXml => {
                    return pXml.replace(/<[^>]+>/g, ""); // strip tags
                });
                const text = paragraphsText.join("\n");

                // Trích xuất Raw XML để giữ nguyên tất cả định dạng (Bảng, Đậm, Màu sắc...)
                const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
                let rawXml = "";
                if (bodyMatch && bodyMatch[1]) {
                    rawXml = bodyMatch[1].replace(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/g, '');
                }

                resolve({ text, rawXml });
            } catch (err) {
                reject(new Error("Không thể đọc file DOCX."));
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Read Excel Data
 */
export const readExcelData = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: "binary" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet);
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
};

/**
 * Trích xuất cấu trúc Email Template từ file Word (.docx)
 * Sử dụng mammoth để bảo toàn định dạng HTML của phần Body
 */
export const extractEmailTemplate = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;

                // 1. Trích xuất Text thô để parse các trường Header (To, CC, Subject)
                const textResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                const fullText = textResult.value || "";

                const extractField = (fieldName) => {
                    // Match tất cả các dòng cho tới khi gặp một Header khác (To, CC, BCC, Subject, Body) hoặc hết file
                    const regex = new RegExp(`^${fieldName}\\s*:\\s*([\\s\\S]*?)(?=(?:^\\s*(?:To|Cc|Bcc|CC|BCC|Subject|Body)\\s*:)|$)`, "ims");
                    const match = fullText.match(regex);
                    // trim bỏ newline và khoảng trắng dư thừa
                    return match ? match[1].replace(/\n/g, '').trim() : "";
                };

                const toVal = extractField("To");
                const fromVal = extractField("From");
                const ccVal = extractField("CC") || extractField("Cc");
                const bccVal = extractField("BCC") || extractField("Bcc");
                const subjectVal = extractField("Subject");

                // 2. Pre-process HTML để lấy Body (bảo toàn màu sắc w:color, w:shd, w:highlight bằng PizZip)
                let coloredHtmlBuffer = arrayBuffer;
                try {
                    const zip = new PizZip(arrayBuffer);
                    const docXmlFile = zip.file("word/document.xml");
                    if (docXmlFile) {
                        const xmlStr = docXmlFile.asText();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xmlStr, "application/xml");

                        const runs = doc.getElementsByTagName("w:r");
                        for (let i = 0; i < runs.length; i++) {
                            const run = runs[i];
                            const rPrs = run.getElementsByTagName("w:rPr");
                            if (rPrs.length > 0) {
                                const rPr = rPrs[0];
                                let fgColor = null;
                                let bgColor = null;

                                const colorNs = rPr.getElementsByTagName("w:color");
                                if (colorNs.length > 0) {
                                    const val = colorNs[0].getAttribute("w:val");
                                    if (val && val !== "auto") {
                                        fgColor = val.startsWith("#") ? val : `#${val}`;
                                    }
                                }

                                const shdNs = rPr.getElementsByTagName("w:shd");
                                if (shdNs.length > 0) {
                                    const fill = shdNs[0].getAttribute("w:fill");
                                    if (fill && fill !== "auto" && fill !== "none") {
                                        bgColor = fill.startsWith("#") ? fill : `#${fill}`;
                                    }
                                }

                                const highlightNs = rPr.getElementsByTagName("w:highlight");
                                if (highlightNs.length > 0) {
                                    const val = highlightNs[0].getAttribute("w:val");
                                    if (val && val !== "none") {
                                        bgColor = val;
                                    }
                                }

                                if (fgColor || bgColor) {
                                    const ts = run.getElementsByTagName("w:t");
                                    for (let j = 0; j < ts.length; j++) {
                                        const t = ts[j];
                                        if (t.textContent) {
                                            let text = t.textContent;
                                            if (fgColor) text = `[C:${fgColor}]${text}[/C]`;
                                            if (bgColor) text = `[B:${bgColor}]${text}[/B]`;
                                            t.textContent = text;
                                        }
                                    }
                                }
                            }
                        }

                        const serializer = new XMLSerializer();
                        const newXml = serializer.serializeToString(doc);
                        zip.file("word/document.xml", newXml);
                        coloredHtmlBuffer = zip.generate({ type: "arraybuffer" });
                    }
                } catch (err) {
                    console.warn("Lỗi khi xử lý cấu trúc màu sắc DOCX:", err);
                }

                const htmlResult = await mammoth.convertToHtml({ arrayBuffer: coloredHtmlBuffer });
                let htmlContent = htmlResult.value || "";

                // Giải mã các thẻ [C:...] và [B:...] thành thẻ <span> màu sắc
                htmlContent = htmlContent.replace(/\[C:([^\]]+)\]/g, '<span style="color:$1;">');
                htmlContent = htmlContent.replace(/\[\/C\]/g, '</span>');
                htmlContent = htmlContent.replace(/\[B:([^\]]+)\]/g, '<span style="background-color:$1;">');
                htmlContent = htmlContent.replace(/\[\/B\]/g, '</span>');

                // Móc phần body thực sự (cắt bỏ phần To, CC, Subject, Body: ở đầu nếu có)
                // Mammoth render các đoạn văn thành thẻ <p>. 
                // Ta tìm đoạn chứa chữ "Body:" và lấy toàn bộ HTML phía sau nó.
                let bodyHtml = htmlContent;
                const bodyMarkerIdx = htmlContent.toLowerCase().indexOf(">body:</b></p>");
                const bodyMarkerIdx2 = htmlContent.toLowerCase().indexOf(">body:</p>");
                const bodyMarkerIdx3 = htmlContent.toLowerCase().indexOf(">body:</");

                let cutIdx = -1;
                if (bodyMarkerIdx !== -1) cutIdx = bodyMarkerIdx + 14;
                else if (bodyMarkerIdx2 !== -1) cutIdx = bodyMarkerIdx2 + 10;
                else if (bodyMarkerIdx3 !== -1) {
                    const closeTag = htmlContent.indexOf("</p>", bodyMarkerIdx3);
                    if (closeTag !== -1) cutIdx = closeTag + 4;
                }

                if (cutIdx !== -1) {
                    bodyHtml = htmlContent.substring(cutIdx).trim();
                }

                resolve({
                    from: fromVal,
                    to: toVal,
                    cc: ccVal,
                    bcc: bccVal,
                    subject: subjectVal,
                    bodyHtml: bodyHtml
                });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};
