import React, { useState } from 'react';
import { Upload, Mail, FileArchive, Database, FileText } from 'lucide-react';
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

                setTemplateSubject(subjectText);
                setTemplateBody(bodyHtml);
                setTemplateHtml(html);

                // Auto-detect Placeholders
                const allText = subjectText + ' ' + bodyHtml;
                const matches = allText.match(/\{\{(.*?)\}\}/g);
                if (matches) {
                    const uniquePlaceholders = [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
                    setPlaceholders(uniquePlaceholders);
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
                
                const sheetJson = XLSX.utils.sheet_to_json(ws, { defval: "" });
                if (sheetJson.length === 0) throw new Error("File Excel trống.");

                const headers = Object.keys(sheetJson[0]);
                setExcelHeaders(headers);
                setExcelData(sheetJson);

                toast.success(`Đã tải ${sheetJson.length} dòng dữ liệu.`);
            } catch (error) {
                console.error(error);
                toast.error('Lỗi đọc file Excel.');
            }
        };
        reader.readAsBinaryString(file);
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
        return template.replace(/\{\{(.*?)\}\}/g, (match, phRaw) => {
            const ph = phRaw.trim();
            
            // Tìm trong Excel
            let value = dataRow[ph];
            
            // Fallback: Tìm trong global placeholders (Thư viện) của hệ thống nếu Excel không có
            if (value === undefined || value === null || value === '') {
                const globalFallback = globalPlaceholders.find(p => p.name === ph);
                if (globalFallback && globalFallback.default) {
                    value = globalFallback.default;
                } else {
                    value = ''; // Nếu không có ở cả 2 nguồn thì để trống
                }
            }

            // Format cho biến English Date
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
                let to = row['To'] || row['TO'] || row['to'] || '';
                let cc = row['CC'] || row['Cc'] || row['cc'] || '';
                
                const subject = replacePlaceholders(templateSubject, row);
                const body = replacePlaceholders(templateBody, row);
                
                const emlContent = generateEML(to, cc, subject, body);
                
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
                    <p className="text-slate-500 mt-1">Upload file Word (.docx) làm Template và kết hợp Data (Excel + Thư viện Placeholder) để tạo Email hàng loạt.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Cột 1 & 2: Preview (Thiết kế rộng và chuyển sang trái) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full h-[80vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                Preview Giao Diện Email
                            </h2>
                            <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                                Phát hiện: {placeholders.length} biến
                            </span>
                        </div>
                        
                        <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Subject (Tiêu đề Thư)</label>
                                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-medium">
                                    {templateSubject || <span className="text-slate-400 italic">Chưa phát hiện Subject từ Template...</span>}
                                </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Body HTML Preview (Nội dung Thư)</label>
                                <div 
                                    className="flex-1 p-6 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 overflow-y-auto wysiwyg-preview"
                                    dangerouslySetInnerHTML={{ __html: templateBody || '<span class="text-slate-400 italic">Body preview sẽ hiển thị ở đây sau khi tải Template...</span>' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cột 3: Upload và Chức năng (Chuyển sang phải) */}
                <div className="space-y-6">
                    {/* BƯỚC 1: UPLOAD TEMPLATE */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                            Upload Template (.docx)
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
                                {templateFileName ? templateFileName : 'Chọn file Word (.docx) mẫu'}
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
                                {excelFileName ? excelFileName : 'Chọn file Excel người nhận'}
                            </p>
                        </div>
                    </div>

                    {/* BƯỚC 3: NÚT GENERATE */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                            Tạo Bản Nháp Email
                        </h2>
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
                            {isProcessing ? 'Đang tạo...' : 'Tải Xuống Hàng Loạt (.zip)'}
                        </button>
                        <p className="text-xs text-center text-slate-500 mt-3">
                            Lưu ý: Các biến không tìm thấy trong Excel sẽ tự động được lấy từ <strong>Placeholder Dictionary</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
