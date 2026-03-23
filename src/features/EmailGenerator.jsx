import React, { useState } from 'react';
import { Upload, Mail, Download, AlertTriangle, FileArchive, CheckCircle, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

export function EmailGenerator() {
    const [templateSubject, setTemplateSubject] = useState('Thông báo tới {{CustomerName}}');
    const [templateBody, setTemplateBody] = useState('<p>Kính gửi anh/chị <strong>{{CustomerName}}</strong>,</p><p>Đây là nội dung thử nghiệm với mã đơn: <strong>{{OrderCode}}</strong>.</p><p>Xin cảm ơn!</p>');
    const [excelData, setExcelData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { defval: "" }); // Cung cấp fallback rỗng cho ô không có dữ liệu
                setExcelData(data);
                toast.success(`Đã tải ${data.length} dòng dữ liệu.`);
            } catch (error) {
                console.error(error);
                toast.error('Lỗi đọc file Excel.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const replacePlaceholders = (template, data) => {
        const regex = /\{\{([^}]+)\}\}/g;
        return template.replace(regex, (match, key) => {
            const strippedKey = key.trim();
            const value = data[strippedKey];
            // Xử lý fallback: Nếu cột thiếu dữ liệu, thay thế bằng khoảng trắng ('' thay vì undefined)
            return value !== undefined && value !== null && value !== "" ? value : '';
        });
    };

    const encodeSubject = (str) => {
        // Base64 encode để giữ nguyên Tiếng Việt (Unicode) ở Subject
        return `=?utf-8?B?${window.btoa(unescape(encodeURIComponent(str)))}?=`;
    };

    const generateEML = (to, cc, subject, body) => {
        let eml = '';
        if (to) eml += `To: ${to}\r\n`;
        if (cc) eml += `Cc: ${cc}\r\n`;
        eml += `Subject: ${encodeSubject(subject)}\r\n`;
        
        // X-Unsent: 1 là cực kỳ quan trọng để Outlook mở file dưới dạng Bản Nháp (Draft), cho phép chỉnh sửa trước khi Gửi.
        eml += `X-Unsent: 1\r\n`; 
        eml += `MIME-Version: 1.0\r\n`;
        eml += `Content-Type: text/html; charset=utf-8\r\n`;
        eml += `\r\n`;
        eml += body;
        return eml;
    };

    const handleGenerate = async () => {
        if (excelData.length === 0) {
            toast.error('Vui lòng tải lên file Excel dữ liệu!');
            return;
        }

        setIsProcessing(true);
        toast.info('Đang xử lý tạo file EML...');

        try {
            const zip = new JSZip();

            excelData.forEach((row, index) => {
                const to = row['To'] || row['to'] || '';
                const cc = row['CC'] || row['cc'] || '';
                
                // Trộn dữ liệu vào Template
                const subject = replacePlaceholders(templateSubject, row);
                const body = replacePlaceholders(templateBody, row);
                
                // Tạo nội dung MIME EML
                const emlContent = generateEML(to, cc, subject, body);
                
                // Tạo tên file thân thiện tránh lỗi ký tự đặc biệt
                const safeName = (row['CustomerName'] || row['To'] || `Email_Draft_${index + 1}`).toString().replace(/[^a-z0-9_\u00C0-\u017F]/gi, '_');
                
                zip.file(`${safeName}.eml`, emlContent);
            });

            // Nếu số lượng email lớn, gom vào file ZIP tải 1 lần như lời khuyên của "lão làng"
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, 'Email_Drafts.zip');
            toast.success(`Đã tạo và tải xuống ${excelData.length} file EML!`);
        } catch (error) {
            console.error(error);
            toast.error('Có lỗi xảy ra khi tạo EML!');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Mail className="w-6 h-6 text-blue-600" />
                        Email Generator
                    </h1>
                    <p className="text-slate-500 mt-1">Tạo hàng loạt file .eml (Draft) từ Template và dữ liệu Excel để kiểm duyệt trên Outlook.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Phần Template Management */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileArchive className="w-5 h-5 text-slate-500" />
                        Template Email
                    </h2>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subject (Tiêu đề)</label>
                        <input
                            type="text"
                            value={templateSubject}
                            onChange={(e) => setTemplateSubject(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Body (Nội dung HTML)</label>
                        <textarea
                            value={templateBody}
                            onChange={(e) => setTemplateBody(e.target.value)}
                            rows={10}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                        />
                    </div>
                    
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <strong>Hướng dẫn Placeholder:</strong> Sử dụng <code>{`{{Tên_Cột}}`}</code> để chèn dữ liệu. File Excel bắt buộc cần có cột <strong>To</strong> hoặc <strong>CC</strong> để gửi email.
                        </div>
                    </div>
                </div>

                {/* Phần Recipient Management + Logic Hành Động */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Database className="w-5 h-5 text-slate-500" />
                            Dữ liệu Người nhận (Excel)
                        </h2>

                        <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 transition-colors text-center group cursor-pointer">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="w-10 h-10 text-slate-400 group-hover:text-blue-500 mx-auto mb-3 transition-colors" />
                            <p className="text-sm font-medium text-slate-700">
                                {fileName ? fileName : 'Kéo thả hoặc click để chọn file Excel (.xlsx)'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Lưu ý: File cần có cột <strong>To</strong>, <strong>CC</strong> và các cột dữ liệu khác.
                            </p>
                        </div>

                        {excelData.length > 0 && (
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                    <div>
                                        <p className="font-semibold text-green-800">Đã nhận diện {excelData.length} dòng</p>
                                        <p className="text-xs text-green-600">Sẵn sàng để tạo File EML qua ZIP</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        <button
                            onClick={handleGenerate}
                            disabled={isProcessing || excelData.length === 0}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FileArchive className="w-5 h-5" />
                            )}
                            {isProcessing ? 'Đang tạo EML...' : 'Tạo hàng loạt EML (File ZIP)'}
                        </button>
                        <p className="text-xs text-center text-slate-500 mt-2">
                            Tất cả file EML sẽ được đóng gói dưới dạng ZIP để dễ tải xuống một lần duy nhất.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
