import React, { useState } from 'react';
import { Upload, Mail, FileArchive, Database, FileText, ChevronLeft, ChevronRight, Eye, CheckCircle, AlertCircle, Paperclip, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import { useStore } from '../lib/store';

export function EmailGenerator() {
    // Lấy thư viện Placeholders từ hệ thống
    const globalPlaceholders = useStore((state) => state.placeholders);

    const [templateHtml, setTemplateHtml] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');
    const [templateFileName, setTemplateFileName] = useState('');
    const [placeholders, setPlaceholders] = useState([]); // List of unique placeholders found

    const [excelData, setExcelData] = useState([]);
    const [excelHeaders, setExcelHeaders] = useState([]);
    const [excelFileName, setExcelFileName] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    const [previewMode, setPreviewMode] = useState('raw'); // 'raw' | 'parsed'
    const [previewRowIndex, setPreviewRowIndex] = useState(0);

    const [attachments, setAttachments] = useState([]);
    
    // Drag & Drop State
    const [isDraggingTemplate, setIsDraggingTemplate] = useState(false);
    const [isDraggingExcel, setIsDraggingExcel] = useState(false);
    const [isDraggingAttachments, setIsDraggingAttachments] = useState(false);

    // 1. Xử lý Upload Template (Word docx)
    const handleTemplateUpload = (e) => {
        const file = e.type === 'drop' ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            setIsDraggingTemplate(false);
            return;
        }
        setIsDraggingTemplate(false);
        setTemplateFileName(file.name);
        setIsAnalyzing(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                // Convert Word to HTML
                const result = await mammoth.convertToHtml({ arrayBuffer });
                let html = result.value;

                // Color extractor hack: đọc từ word/document.xml và inject <span> màu
                try {
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const docXmlFile = zip.file("word/document.xml");
                    if (docXmlFile) {
                        const docXml = await docXmlFile.async("text");
                        const runs = docXml.match(/<w:r\b[^>]*>.*?<\/w:r>/gs);
                        if (runs) {
                            let colorMap = [];
                            runs.forEach(run => {
                                const colorMatch = run.match(/<w:color w:val="([0-9A-Fa-f]{6})"/);
                                const textMatch = run.match(/<w:t(?:[^>]*)?>(.*?)<\/w:t>/);
                                if (colorMatch && textMatch) {
                                    const text = textMatch[1].trim();
                                    if (text.length >= 2) {
                                        colorMap.push({ text, hex: colorMatch[1] });
                                    }
                                }
                            });
                            // unique & sort
                            const uniqueColors = [];
                            const seen = new Set();
                            colorMap.forEach(item => {
                                const key = item.hex + item.text;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    uniqueColors.push(item);
                                }
                            });
                            uniqueColors.sort((a, b) => b.text.length - a.text.length);
                            
                            uniqueColors.forEach(item => {
                                const safeText = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                // Negative lookahead: Only replace if NOT followed by characters ending in '>' without another '<' (meaning NOT inside an HTML tag like <img src="...">)
                                const regex = new RegExp(`(${safeText})(?![^<]*>)`, 'g');
                                html = html.replace(regex, `<span style="color: #${item.hex};">$1</span>`);
                            });
                        }
                    }
                } catch (e) {
                    console.log("Color extraction skipped", e);
                }

                // Tách Subject và Body từ file Word.
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                let subjectText = '';
                let bodyHtml = '';
                let foundBody = false;

                const nodes = Array.from(tempDiv.childNodes);
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    const text = node.textContent || '';

                    if (foundBody) {
                        bodyHtml += node.outerHTML || node.textContent;
                        continue;
                    }

                    if (text.toLowerCase().includes('subject:')) {
                        subjectText = text.replace(/subject:\s*/i, '').trim();
                        // Tiếp tục nhưng không đưa phần này vào body
                    } else if (text.toLowerCase().includes('body:')) {
                        foundBody = true;
                        // Bỏ qua thẻ "Body:" không đưa vào nội dung email
                    } else if (!subjectText) {
                        // Nếu chưa gặp Subject và Body, có thể là các thẻ From, To, CC, Date => bỏ qua
                    }
                }

                if (!subjectText && !foundBody) {
                    bodyHtml = html;
                    subjectText = 'Email Notification'; // Default
                }

                bodyHtml = bodyHtml.replace(/\n/g, '<br>');
                // Bọc vào khung font chữ chuẩn Enterprise (Calibri/Arial)
                bodyHtml = `<div style="font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; color: #333333; line-height: 1.5;">${bodyHtml}</div>`;

                setTemplateSubject(subjectText);
                setTemplateBody(bodyHtml);
                setTemplateHtml(html);

                // Auto-detect Placeholders: Support both {{...}} and [[...]]
                const allText = subjectText + ' ' + bodyHtml;
                const matches = allText.match(/\{\{(.*?)\}\}|\[\[(.*?)\]\]/g);
                if (matches) {
                    const uniquePlaceholders = [...new Set(matches.map(m => m.replace(/[{}[\]]/g, '').trim()))];
                    setPlaceholders(uniquePlaceholders);
                    toast.success(`Đã trích xuất ${uniquePlaceholders.length} placeholders từ Template.`);
                } else {
                    setPlaceholders([]);
                    toast.info('Không tìm thấy placeholder nào trong template.');
                }

            } catch (error) {
                console.error(error);
                toast.error('Lỗi khi đọc file Template Word.');
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // 2. Xử lý Upload Excel Dữ liệu
    const handleExcelUpload = (e) => {
        const file = e.type === 'drop' ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            setIsDraggingExcel(false);
            return;
        }
        setIsDraggingExcel(false);
        setExcelFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                const sheetJson = XLSX.utils.sheet_to_json(ws, { defval: "" });
                if (sheetJson.length === 0) throw new Error("File Excel trống.");

                // Normalize keys (trim whitespace from headers and string values to prevent matching errors)
                const normalizedData = sheetJson.map(row => {
                    const newRow = {};
                    for (const key in row) {
                        newRow[key.trim()] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                    }
                    return newRow;
                });

                const headers = Object.keys(normalizedData[0]);
                setExcelHeaders(headers);
                setExcelData(normalizedData);

                toast.success(`Đã tải ${normalizedData.length} dòng dữ liệu.`);
                // Hiển thị ngay preview cho dữ liệu khi mới upload
                setPreviewMode('parsed');
                setPreviewRowIndex(0);
            } catch (error) {
                console.error(error);
                toast.error('Lỗi đọc file Excel.');
            }
        };
        reader.readAsBinaryString(file);
    };

    // 3. Xử lý Upload Attachments
    const handleAttachmentsUpload = (e) => {
        const files = e.type === 'drop' ? e.dataTransfer.files : e.target.files;
        if (!files || files.length === 0) {
            setIsDraggingAttachments(false);
            return;
        }
        setIsDraggingAttachments(false);
        
        const newAttachments = Array.from(files);
        let incomingSize = newAttachments.reduce((sum, file) => sum + file.size, 0);
        const existingSize = attachments.reduce((sum, a) => sum + a.file.size, 0);
        
        if (incomingSize + existingSize > 25 * 1024 * 1024) {
            toast.warning('Cảnh báo: Tổng dung lượng file đính kèm quá lớn (>25MB). Nhiều Gateway bảo mật hoặc Gmail/Outlook sẽ từ chối nhận File!');
        }

        const readPromises = newAttachments.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const base64Data = evt.target.result.split(',')[1];
                    resolve({ name: file.name, type: file.type || 'application/octet-stream', data: base64Data, file, size: file.size });
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readPromises).then(results => {
            setAttachments(prev => [...prev, ...results]);
            if (results.length > 0) toast.success(`Đã đính kèm ${results.length} tệp.`);
        });
        e.target.value = ""; // reset
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Helper: Định dạng ngày tháng sang tiếng Anh (Vd: 23/03/2026 -> March 23, 2026)
    const formatDateEN = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.toString().split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const dateObj = new Date(year, month, day);
            if (!isNaN(dateObj.getTime())) {
                return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
        }
        return dateStr;
    };

    // Helper: Xóa dấu Tiếng Việt để đặt tên file an toàn
    const removeVietnameseTones = (str) => {
        if (!str) return '';
        str = str.toString();
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
        str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
        str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
        str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
        str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
        str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
        str = str.replace(/Đ/g, "D");
        // Remove special characters, preserve spaces
        str = str.replace(/[^a-zA-Z0-9 ]/g, "");
        // Replace spaces with underscores
        str = str.replace(/\s+/g, "_");
        return str.trim();
    };

    // Logic thay thế dữ liệu
    const replacePlaceholders = (template, dataRow, isLivePreview = true) => {
        return template.replace(/\{\{(.*?)\}\}|\[\[(.*?)\]\]/g, (match, ph1, ph2) => {
            const phRaw = ph1 !== undefined ? ph1 : (ph2 !== undefined ? ph2 : '');
            
            // Xóa thẻ HTML (do Color Parser vô tình add vào) & space ẩn
            const phClean = phRaw.replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, ' ').trim();
            
            // Tìm trong Excel
            let value = dataRow[phClean];
            
            // Fallback: Tìm trong global placeholders
            if (value === undefined || value === null || value === '') {
                const globalFallback = globalPlaceholders.find(p => p.name === phClean);
                if (globalFallback && globalFallback.default) {
                    value = globalFallback.default;
                } else {
                    value = ''; // Trống hoàn toàn
                }
            }

            // Error Highlight
            if (value === '' && isLivePreview) {
                return `<span style="background-color: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.85em; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 4px;" title="Lỗi: Chưa định nghĩa giá trị này">⚠️ ${match}</span>`;
            }

            if (value !== '') {
                // Format cho biến English Date
                if (phClean.endsWith('_EN') && phClean.toLowerCase().includes('date')) {
                    value = formatDateEN(value);
                }

                // Nếu phRaw chứa HTML tag (ví dụ: span color), ta giữ nguyên HTML và chỉ chèn Text
                if (phRaw !== phClean) {
                    return phRaw.replace(phClean, value);
                }
                return value;
            }

            return match;
        });
    };

    const encodeSubject = (str) => {
        return `=?utf-8?B?${window.btoa(unescape(encodeURIComponent(str)))}?=`;
    };

    const buildMimeMessage = (from, to, cc, subject, htmlBody, attachmentsList) => {
        const boundary = "----=_NextPart_" + Math.random().toString(36).substring(2).toUpperCase();
        
        let eml = `X-Unsent: 1\r\n`;
        if (from) eml += `From: ${from}\r\n`;
        if (to) eml += `To: ${to}\r\n`;
        if (cc) eml += `Cc: ${cc}\r\n`;
        eml += `Subject: ${encodeSubject(subject)}\r\n`;
        eml += `MIME-Version: 1.0\r\n`;
        
        if (attachmentsList && attachmentsList.length > 0) {
            eml += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
            
            // Text/HTML Part
            eml += `--${boundary}\r\n`;
            eml += `Content-Type: text/html; charset=utf-8\r\n`;
            eml += `Content-Transfer-Encoding: base64\r\n\r\n`;
            const bodyBase64 = window.btoa(unescape(encodeURIComponent(htmlBody))).replace(/.{1,76}/g, '$&\r\n');
            eml += `${bodyBase64}\r\n\r\n`;
            
            // File Attachments Parts
            for (const att of attachmentsList) {
                eml += `--${boundary}\r\n`;
                eml += `Content-Type: ${att.type}; name="=?utf-8?B?${window.btoa(unescape(encodeURIComponent(att.name)))}?="\r\n`;
                eml += `Content-Transfer-Encoding: base64\r\n`;
                eml += `Content-Disposition: attachment; filename="=?utf-8?B?${window.btoa(unescape(encodeURIComponent(att.name)))}?="\r\n\r\n`;
                
                const attBase64 = att.data.replace(/.{1,76}/g, '$&\r\n');
                eml += `${attBase64}\r\n\r\n`;
            }
            eml += `--${boundary}--\r\n`;
        } else {
            eml += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
            eml += htmlBody;
        }
        return eml;
    };

    const handleGenerate = async () => {
        if (excelData.length === 0 || !templateBody) {
            toast.error('Vui lòng hoàn thành bước Upload Template và Data!');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        toast.info('Đang bắt đầu tạo file EML...');

        try {
            const zip = new JSZip();

            // Sử dụng setImmediate (hoặc setTimeout) để nhường luồng xử lý cho UI render ProgressBar
            for (let i = 0; i < excelData.length; i++) {
                const row = excelData[i];
                let fromRaw = row['From'] || row['FROM'] || row['from'] || '';
                let toRaw = row['To'] || row['TO'] || row['to'] || '';
                let ccRaw = row['CC'] || row['Cc'] || row['cc'] || '';
                
                // Chuẩn hóa email: cắt bằng dấu ; và strip khoảng trắng
                let from = fromRaw ? fromRaw.toString().split(';').map(e => e.trim()).filter(Boolean).join(', ') : '';
                let to = toRaw ? toRaw.toString().split(';').map(e => e.trim()).filter(Boolean).join(', ') : '';
                let cc = ccRaw ? ccRaw.toString().split(';').map(e => e.trim()).filter(Boolean).join(', ') : '';
                
                // Khi tạo file thật thì chúng ta tạm set fallback highlight red = false (bằng cách truyền param hoặc giả lập)
                // Tuy nhiên hiện hàm replace không truyền chế độ, nên ta bọc mode parse để không inject html đỏ
                const backupMode = previewMode;
                
                // Tính toán subject body
                const subject = replacePlaceholders(templateSubject, row, false);
                const body = replacePlaceholders(templateBody, row, false);
                
                const emlContent = buildMimeMessage(from, to, cc, subject, body, attachments);
                
                // Chuẩn hóa tên file: Email_{STT}_{Recipient Name}
                let stt = i + 1;
                let recipient = row['Recepient Name'] || row['Recipient Name'] || row['CustomerName'] || row['Name'] || (to ? to.split('@')[0] : 'Unknown');
                recipient = removeVietnameseTones(recipient);
                let safeName = `Email_${stt}_${recipient}`;
                
                zip.file(`${safeName}.eml`, emlContent);

                // Cập nhật progress cứ mỗi 10 rows hoặc dòng cuối
                if (i % 10 === 0 || i === excelData.length - 1) {
                    setProgress(Math.round(((i + 1) / excelData.length) * 100));
                    await new Promise(r => setTimeout(r, 0)); // Yield to main thread
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, 'Email_Drafts.zip');
            toast.success(`Đã đóng gói thành công ${excelData.length} file EML!`);
        } catch (error) {
            console.error(error);
            toast.error('Có lỗi xảy ra khi tạo EML!');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Mail className="w-6 h-6 text-blue-600" />
                        Smart Email EML Generator
                    </h1>
                    <p className="text-slate-500 mt-1">Upload file Word (.docx) làm Template và kết hợp Data (Excel + Thư viện Placeholder) để tạo Email hàng loạt.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Cột 1 & 2: Preview (Thiết kế rộng và chuyển sang trái) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full h-[80vh]">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                                <Eye className="w-5 h-5 text-blue-600" />
                                Preview Giao Diện Email
                            </h2>
                            <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                                Phát hiện: {placeholders.length} biến
                            </span>
                        </div>
                        
                        {/* Thanh công cụ xem trước */}
                        <div className="flex items-center justify-between mb-4 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPreviewMode('raw')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${previewMode === 'raw' ? 'bg-white shadow-sm border border-slate-300 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                                >
                                    Mã Giả (Template Gốc)
                                </button>
                                <button
                                    onClick={() => setPreviewMode('parsed')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${previewMode === 'parsed' ? 'bg-white shadow-sm border border-slate-300 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                                >
                                    Xem trước Kết quả (Thực tế)
                                </button>
                            </div>

                            {previewMode === 'parsed' && excelData.length > 0 && (
                                <div className="flex items-center gap-3 pr-2">
                                    <span className="text-xs text-slate-500 font-medium">
                                        Dòng {previewRowIndex + 1} / {excelData.length}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setPreviewRowIndex(p => Math.max(0, p - 1))}
                                            disabled={previewRowIndex === 0}
                                            className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:hover:border-slate-200 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => setPreviewRowIndex(p => Math.min(excelData.length - 1, p + 1))}
                                            disabled={previewRowIndex === excelData.length - 1}
                                            className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:hover:border-slate-200 transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-4 overflow-hidden flex flex-col relative">
                            {isAnalyzing ? (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center rounded-lg">
                                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                                    <h3 className="font-semibold text-slate-800">Đang phân tích Template...</h3>
                                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Hệ thống đang bóc tách thẻ HTML và nhận diện các biến dữ liệu thông minh.</p>
                                </div>
                            ) : templateBody === '' && (
                                <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 rounded-lg">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                                        <FileText className="w-8 h-8 opacity-70" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">Chưa tải Template</h3>
                                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Vui lòng tải lên file Template Word (Bước 1) để xem trước cấu trúc Email.</p>
                                </div>
                            )}
                            
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between items-center">
                                    <span>Subject (Tiêu đề Thư)</span>
                                    {previewMode === 'parsed' && templateSubject && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Live Map</span>}
                                </label>
                                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-medium break-words shadow-inner min-h-[42px]">
                                    {previewMode === 'parsed' ? (
                                        <div dangerouslySetInnerHTML={{ __html: replacePlaceholders(templateSubject, excelData[previewRowIndex] || {}, true) }} />
                                    ) : (
                                        templateSubject || <span className="text-slate-400 italic">...</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Body HTML Preview (Nội dung Thư)</label>
                                <div 
                                    className="flex-1 p-6 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 overflow-y-auto wysiwyg-preview shadow-inner"
                                    dangerouslySetInnerHTML={{ __html: previewMode === 'parsed' ? replacePlaceholders(templateBody, excelData[previewRowIndex] || {}, true) : templateBody }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cột 3: Upload và Chức năng (Chuyển sang phải) */}
                <div className="space-y-6">
                    {/* BƯỚC 1: UPLOAD TEMPLATE */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 transition-all">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm shadow">1</span>
                            Tải lên Email Template (.docx)
                        </h2>
                        <div 
                            className={`relative border-2 border-dashed rounded-xl p-6 text-center group cursor-pointer transition-all duration-300 ${isDraggingTemplate ? 'border-blue-500 bg-blue-50 scale-105 shadow-md' : templateFileName ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingTemplate(true); }}
                            onDragLeave={() => setIsDraggingTemplate(false)}
                            onDrop={(e) => { e.preventDefault(); handleTemplateUpload(e); }}
                        >
                            <input
                                type="file"
                                accept=".docx"
                                onChange={handleTemplateUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {templateFileName ? (
                                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 drop-shadow-sm" />
                            ) : (
                                <FileText className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDraggingTemplate ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                            )}
                            <p className={`text-sm font-medium ${templateFileName ? 'text-emerald-700' : 'text-slate-700 group-hover:text-blue-700'}`}>
                                {templateFileName ? templateFileName : isDraggingTemplate ? 'Thả file vào đây!' : 'Kéo thả hoặc click chọn file mẫu Word'}
                            </p>
                        </div>
                    </div>

                    {/* BƯỚC 2: UPLOAD DATA EXCEL */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm shadow">2</span>
                            Tải lên Danh sách Email người nhận (Excel)
                        </h2>
                        <div 
                            className={`relative border-2 border-dashed rounded-xl p-6 text-center group cursor-pointer transition-all duration-300 ${isDraggingExcel ? 'border-blue-500 bg-blue-50 scale-105 shadow-md' : excelFileName ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingExcel(true); }}
                            onDragLeave={() => setIsDraggingExcel(false)}
                            onDrop={(e) => { e.preventDefault(); handleExcelUpload(e); }}
                        >
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleExcelUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {excelFileName ? (
                                <Database className="w-8 h-8 text-emerald-500 mx-auto mb-2 drop-shadow-sm" />
                            ) : (
                                <Database className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDraggingExcel ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                            )}
                            <p className={`text-sm font-medium ${excelFileName ? 'text-emerald-700' : 'text-slate-700 group-hover:text-blue-700'}`}>
                                {excelFileName ? excelFileName : isDraggingExcel ? 'Thả Data Excel vào đây!' : 'Kéo thả hoặc click file Excel thông tin người nhận'}
                            </p>
                        </div>
                    </div>

                    {/* BƯỚC 3: UPLOAD ATTACHMENTS */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm shadow">3</span>
                            File Đính kèm (Tuỳ chọn)
                        </h2>
                        <div 
                            className={`relative border-2 border-dashed rounded-xl p-6 text-center group cursor-pointer transition-all duration-300 ${isDraggingAttachments ? 'border-blue-500 bg-blue-50 scale-105 shadow-md' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingAttachments(true); }}
                            onDragLeave={() => setIsDraggingAttachments(false)}
                            onDrop={(e) => { e.preventDefault(); handleAttachmentsUpload(e); }}
                        >
                            <input
                                type="file"
                                multiple
                                onChange={handleAttachmentsUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Paperclip className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDraggingAttachments ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                            <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
                                {isDraggingAttachments ? 'Thả File đính kèm vào đây!' : 'Kéo thả PDF, PDF,... chung cho tất cả'}
                            </p>
                        </div>
                        {attachments.length > 0 && (
                            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-1">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded text-xs text-slate-700 font-medium">
                                        <div className="truncate pr-2 flex-1" title={att.name}>{att.name}</div>
                                        <div className="text-slate-400 w-16 text-right">{(att.size / 1024 / 1024).toFixed(2)} MB</div>
                                        <button onClick={() => removeAttachment(idx)} className="ml-3 text-red-400 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* BƯỚC 4: NÚT GENERATE (FITTS LAW) */}
                    <div className="bg-gradient-to-br from-white to-blue-50/30 p-6 rounded-xl border border-blue-100 shadow-lg shadow-blue-900/5 relative overflow-hidden">
                        {isProcessing && (
                            <div className="absolute top-0 left-0 w-full bg-blue-100 h-1">
                                <div className="bg-blue-600 h-1 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        )}
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm shadow">4</span>
                            Duyệt Bản Nháp & Xuất File
                        </h2>
                        
                        <button
                            onClick={handleGenerate}
                            disabled={isProcessing || excelData.length === 0 || placeholders.length === 0}
                            className={`w-full flex flex-col items-center justify-center gap-1 font-bold py-5 px-6 rounded-xl shadow-xl transition-all duration-300 border-b-4 
                                ${isProcessing || excelData.length === 0 || placeholders.length === 0 
                                ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-500 hover:-translate-y-1 hover:shadow-blue-600/30 text-white border-blue-800'}`}
                        >
                            <div className="flex items-center gap-2 text-xl">
                                {isProcessing ? (
                                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <FileArchive className="w-6 h-6 drop-shadow-md" />
                                )}
                                {isProcessing ? (
                                    <span>Đang xuất {progress}%...</span>
                                ) : (
                                    <span>TẢI XUỐNG HÀNG LOẠT (.ZIP)</span>
                                )}
                            </div>
                            <span className="text-xs font-medium opacity-80">
                                {isProcessing ? `Đang xử lý ${excelData.length} mẫu thư` : 'Tất cả file định dạng EML kèm định dạng'}
                            </span>
                        </button>
                        
                        <p className="text-xs text-center text-slate-500 mt-4 px-2 tracking-tight">
                            Hệ thống sẽ thay giá trị từ Excel vào Template. Nếu <strong>Placeholder mồ côi</strong>, giá trị tự lưu từ Dictionary sẽ được bù vào.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
