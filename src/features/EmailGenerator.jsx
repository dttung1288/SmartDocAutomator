import React, { useState } from 'react';
import { Upload, Mail, AlertTriangle, FileArchive, CheckCircle, Database, FileText, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import mammoth from 'mammoth';

export function EmailGenerator() {
    const [templateHtml, setTemplateHtml] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [templateBody, setTemplateBody] = useState('');
    const [templateFileName, setTemplateFileName] = useState('');
    const [placeholders, setPlaceholders] = useState([]); // List of unique placeholders found

    const [excelData, setExcelData] = useState([]);
    const [excelHeaders, setExcelHeaders] = useState([]);
    const [excelFileName, setExcelFileName] = useState('');
    
    // Mapping: { placeholder_name: excel_header_name }
    const [mapping, setMapping] = useState({});

    const [isProcessing, setIsProcessing] = useState(false);

    // 1. Xử lý Upload Template (Word docx)
    const handleTemplateUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setTemplateFileName(file.name);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                // Convert Word to HTML
                const result = await mammoth.convertToHtml({ arrayBuffer });
                let html = result.value;

                // Tách Subject và Body từ file Word.
                // Trình bày trong file mẫu thường là các đoạn <p>Subject:...</p> <p>Body:...</p>
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

                // Nếu không tìm thấy thẻ Subject: hay Body: rõ ràng, lấy toàn bộ làm body
                if (!subjectText && !foundBody) {
                    bodyHtml = html;
                    subjectText = 'Email Notification'; // Default
                }

                // Nếu là file txt hoặc html thuần chỉ có chữ, \n -> <br> sẽ không cần nếu mammoth đã làm,
                // Nhưng nếu người dùng nhập text thuần:
                bodyHtml = bodyHtml.replace(/\n/g, '<br>');

                setTemplateSubject(subjectText);
                setTemplateBody(bodyHtml);
                setTemplateHtml(html);

                // Auto-detect Placeholders
                // Dùng Regex tìm tất cả các chuỗi trong {{ }}
                const allText = subjectText + ' ' + bodyHtml;
                const matches = allText.match(/\{\{(.*?)\}\}/g);
                if (matches) {
                    // Lọc trùng lặp
                    const uniquePlaceholders = [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
                    setPlaceholders(uniquePlaceholders);
                    
                    // Tạo mapping mặc định (Tự động map nếu tên cột Excel giống tên Placeholder)
                    const newMapping = {};
                    uniquePlaceholders.forEach(ph => {
                        newMapping[ph] = ''; // Sẽ tự map lại khi có Excel
                    });
                    setMapping(newMapping);
                    toast.success(`Đã trích xuất ${uniquePlaceholders.length} placeholders từ Template.`);
                } else {
                    setPlaceholders([]);
                    toast.info('Không tìm thấy placeholder nào trong template.');
                }

            } catch (error) {
                console.error(error);
                toast.error('Lỗi khi đọc file Template Word.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // 2. Xử lý Upload Excel Dữ liệu
    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setExcelFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Trích xuất list headers
                const sheetJson = XLSX.utils.sheet_to_json(ws, { defval: "" });
                if (sheetJson.length === 0) throw new Error("File Excel trống.");

                const headers = Object.keys(sheetJson[0]);
                setExcelHeaders(headers);
                setExcelData(sheetJson);

                // Auto map: Gán header Excel vào Placeholder nếu tên giống nhau
                setMapping(prevMap => {
                    const newMap = { ...prevMap };
                    Object.keys(newMap).forEach(ph => {
                        const matchedHeader = headers.find(h => h.toLowerCase() === ph.toLowerCase());
                        if (matchedHeader) {
                            newMap[ph] = matchedHeader;
                        }
                    });
                    return newMap;
                });

                toast.success(`Đã tải ${sheetJson.length} dòng dữ liệu.`);
            } catch (error) {
                console.error(error);
                toast.error('Lỗi đọc file Excel.');
            }
        };
        reader.readAsBinaryString(file);
    };

    // Xử lý thay đổi Mapping
    const handleMappingChange = (placeholder, excelHeader) => {
        setMapping(prev => ({ ...prev, [placeholder]: excelHeader }));
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

    // Logic thay thế dữ liệu
    const replacePlaceholders = (template, dataRow) => {
        // Dùng replaceAll / Regex match all để thay thế mọi sự diễn ra của biến (Dù xuất hiện 3-4 lần)
        return template.replace(/\{\{(.*?)\}\}/g, (match, phRaw) => {
            const ph = phRaw.trim();
            const mappedHeader = mapping[ph];
            
            if (!mappedHeader) return match; // Nếu ko map, giữ nguyên text {{...}}

            let value = dataRow[mappedHeader];
            
            // Xử lý Fallback: Không để undefined
            if (value === undefined || value === null) value = '';

            // Format cho biến English Date
            // Ví dụ: Resolution_Date_EN
            if (ph.endsWith('_EN') && ph.toLowerCase().includes('date') && value) {
                value = formatDateEN(value);
            }

            return value;
        });
    };

    const encodeSubject = (str) => {
        return `=?utf-8?B?${window.btoa(unescape(encodeURIComponent(str)))}?=`;
    };

    const generateEML = (to, cc, subject, body) => {
        let eml = '';
        if (to) eml += `To: ${to}\r\n`;
        if (cc) eml += `Cc: ${cc}\r\n`;
        eml += `Subject: ${encodeSubject(subject)}\r\n`;
        eml += `X-Unsent: 1\r\n`; 
        eml += `MIME-Version: 1.0\r\n`;
        eml += `Content-Type: text/html; charset=utf-8\r\n`;
        eml += `\r\n`;
        eml += body;
        return eml;
    };

    const handleGenerate = async () => {
        if (excelData.length === 0 || !templateBody) {
            toast.error('Vui lòng hoàn thành bước Upload Template và Data!');
            return;
        }

        setIsProcessing(true);
        toast.info('Đang xử lý tạo file EML...');

        try {
            const zip = new JSZip();

            excelData.forEach((row, index) => {
                // Ưu tiên tìm cột có chữ To, CC. Nếu không có tự động tìm trong mapping người dùng chọn
                let to = row['To'] || row['TO'] || row['to'] || '';
                let cc = row['CC'] || row['Cc'] || row['cc'] || '';
                
                const subject = replacePlaceholders(templateSubject, row);
                const body = replacePlaceholders(templateBody, row);
                
                const emlContent = generateEML(to, cc, subject, body);
                
                // Tên file an toàn Unicode, hạn chế lỗi giải nén
                let safeName = `Email_${index + 1}`;
                if (row['CustomerName']) safeName = row['CustomerName'];
                else if (to) safeName = to.split('@')[0];
                
                safeName = safeName.toString().replace(/[^a-z0-9_\u00C0-\u017F]/gi, '_');
                
                zip.file(`${safeName}.eml`, emlContent);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, 'Email_Drafts.zip');
            toast.success(`Đã tạo thành công ${excelData.length} file EML!`);
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
                    <p className="text-slate-500 mt-1">Upload trực tiếp file Word (.docx) làm Template email để giữ nguyên định dạng phức tạp (CSS, Song ngữ).</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cột 1 & 2: Upload và Mapping */}
                <div className="lg:col-span-2 space-y-6">
                    {/* BƯỚC 1: UPLOAD TEMPLATE */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                            Upload Template (Word .docx)
                        </h2>
                        <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:bg-slate-50 transition-colors text-center group cursor-pointer">
                            <input
                                type="file"
                                accept=".docx"
                                onChange={handleTemplateUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2 transition-colors" />
                            <p className="text-sm font-medium text-slate-700">
                                {templateFileName ? templateFileName : 'Click hoặc Kéo thả file .docx mẫu'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Chuẩn cấu trúc: Phải có chữ "Subject:" và "Body:" để phân tách.
                            </p>
                        </div>
                    </div>

                    {/* BƯỚC 2: UPLOAD DATA EXCEL */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                            Upload Dữ liệu (Excel)
                        </h2>
                        <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:bg-slate-50 transition-colors text-center group cursor-pointer">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleExcelUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Database className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2 transition-colors" />
                            <p className="text-sm font-medium text-slate-700">
                                {excelFileName ? excelFileName : 'Click hoặc Kéo thả file Excel list'}
                            </p>
                        </div>
                    </div>

                    {/* BƯỚC 3: MAPPING */}
                    {placeholders.length > 0 && excelHeaders.length > 0 && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                                Map Dữ Liệu (So khớp cột)
                            </h2>
                            <p className="text-sm text-slate-500">Ghép các biến trong File Word với các cột tương ứng trong File Excel.</p>
                            
                            <div className="space-y-3 mt-4 border rounded-lg p-4 bg-slate-50">
                                {placeholders.map((ph, idx) => (
                                    <div key={idx} className="flex items-center gap-4">
                                        <div className="w-1/2 flex items-center gap-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono text-sm border border-blue-200">{`{{${ph}}}`}</span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-400" />
                                        <div className="w-1/2">
                                            <select
                                                value={mapping[ph] || ""}
                                                onChange={(e) => handleMappingChange(ph, e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- Bỏ trống (Fallback) --</option>
                                                {excelHeaders.map(header => (
                                                    <option key={header} value={header}>{header}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Cột 3: Preview & Nút Generate */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            Preview Chữ (Phát hiện)
                        </h2>
                        
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Subject</label>
                                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-medium">
                                    {templateSubject || <span className="text-slate-400 italic">Chưa phát hiện Subject...</span>}
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Body HTML Preview</label>
                                <div 
                                    className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 overflow-y-auto"
                                    style={{ maxHeight: '350px' }}
                                    dangerouslySetInnerHTML={{ __html: templateBody || '<span class="text-slate-400 italic">Chưa tải Word Template...</span>' }}
                                />
                            </div>
                        </div>

                        <div className="pt-6 mt-6 border-t border-slate-100">
                            <button
                                onClick={handleGenerate}
                                disabled={isProcessing || excelData.length === 0 || placeholders.length === 0}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <FileArchive className="w-5 h-5" />
                                )}
                                {isProcessing ? 'Đang tạo...' : 'Tạo hàng loạt EML (ZIP)'}
                            </button>
                            <p className="text-xs text-center text-slate-500 mt-2">
                                Tất cả file EML sẽ được đóng gói dưới dạng ZIP để dễ tải xuống một lần duy nhất.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
