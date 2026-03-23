import React, { useState, useRef } from 'react';
import { Upload, Trash2, FileText, Settings, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../lib/store";
import { analyzeDocxTemplate, extractEmailTemplate } from "../lib/coreEngine";
import { cn } from "../lib/utils";
import { saveBlobForTemplate, deleteBlobForTemplate } from "../lib/blobStore";

export function TemplateManager() {
    const templates = useStore((state) => state.templates);
    const addTemplate = useStore((state) => state.addTemplate);
    const removeTemplate = useStore((state) => state.removeTemplate);
    const addPlaceholder = useStore((state) => state.addPlaceholder);

    const fileInputRef = useRef(null);
    const [templateType, setTemplateType] = useState('word'); // 'word' or 'email'

    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.docx')) {
            toast.error('Hiện tại chỉ hỗ trợ mẫu định dạng .docx');
            return;
        }

        setLoading(true);
        try {
            let newTemplate = null;

            if (templateType === 'word') {
                const parsedData = await analyzeDocxTemplate(file);
                newTemplate = {
                    id: crypto.randomUUID(),
                    fileName: file.name,
                    type: 'word',
                    size: file.size,
                    placeholders: parsedData.placeholders,
                    lastModified: Date.now(),
                    fileBlob: file
                };
                
                // Add discovered placeholders globally
                parsedData.placeholders.forEach(ph => {
                    addPlaceholder({ name: ph, type: 'text', default: '' });
                });
            } else {
                // Email Template
                const emailData = await extractEmailTemplate(file);
                
                // Extract placeholders from all email fields
                const fullText = `${emailData.from || ''} ${emailData.to} ${emailData.cc} ${emailData.bcc} ${emailData.subject} ${emailData.bodyHtml}`;
                const regex = /\{\{([^{}]+)\}\}/g;
                let match;
                const emailPlaceholders = [];
                while ((match = regex.exec(fullText)) !== null) {
                    const varName = match[1].trim();
                    if (varName && !emailPlaceholders.includes(varName)) {
                        emailPlaceholders.push(varName);
                        addPlaceholder({ name: varName, type: 'text', default: '' });
                    }
                }

                newTemplate = {
                    id: crypto.randomUUID(),
                    fileName: file.name,
                    type: 'email',
                    size: file.size,
                    placeholders: emailPlaceholders,
                    emailMetadata: {
                        from: emailData.from,
                        to: emailData.to,
                        cc: emailData.cc,
                        bcc: emailData.bcc,
                        subject: emailData.subject,
                        body: emailData.bodyHtml,
                        isHtml: true
                    },
                    lastModified: Date.now(),
                    fileBlob: file
                };
            }

            addTemplate(newTemplate);
            // Persist blob to IndexedDB so it survives page reloads
            await saveBlobForTemplate(newTemplate.id, file);
            toast.success(`Đã thêm mẫu ${templateType === 'word' ? 'Word' : 'Email'} "${file.name}"`);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err) {
            toast.error(`Lỗi phân tích mẫu: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Template Manager</h1>
                    <p className="text-slate-500 mt-2">Upload and manage Word & Email templates.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setTemplateType('word')}
                        className={cn("px-4 py-1.5 text-sm font-semibold rounded-md transition-all", templateType === 'word' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >
                        Word Templates
                    </button>
                    <button 
                        onClick={() => setTemplateType('email')}
                        className={cn("px-4 py-1.5 text-sm font-semibold rounded-md transition-all", templateType === 'email' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >
                        Email Templates
                    </button>
                </div>
            </div>

            <div
                className={cn(
                    "bg-white rounded-xl border-2 border-dashed p-10 flex flex-col items-center text-center justify-center transition-colors cursor-pointer",
                    isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropFile = e.dataTransfer.files[0];
                    if (dropFile) {
                        // Fake aChangeEvent
                        handleFileUpload({ target: { files: [dropFile] } });
                    }
                }}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className={cn("w-12 h-12 mb-4 text-slate-400", isDragging && "text-blue-500")} />
                <h3 className="text-lg font-bold">Upload {templateType === 'word' ? 'Word' : 'Email'} Template</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm">
                    {templateType === 'word' 
                        ? 'Drag and drop your .docx file here. We will detect placeholders inside {{ }}.' 
                        : 'Mẫu Email cũng dùng .docx, nhưng nội dung phải có định dạng "To: ...", "Subject: ...", "Body: ..." để hệ thống tách thông tin.'}
                </p>
                <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                {loading && <p className="mt-4 text-sm text-blue-500 font-medium">Processing template...</p>}
            </div>

            <div className="bg-white border rounded-xl shadow-sm mt-8 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold">Available Templates</h2>
                </div>

                {templates.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No templates uploaded yet. Upload your first template above.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {templates.map((template) => (
                            <div key={template.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", template.type === 'email' ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600")}>
                                        {template.type === 'email' ? <Mail className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium">{template.fileName}</h4>
                                            <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", template.type === 'email' ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-blue-50 text-blue-600 border border-blue-100")}>
                                                {template.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {template.placeholders?.length || 0} Variables • {(template.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                        {template.placeholders?.slice(0, 3).map((ph, idx) => (
                                            <span key={idx} className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-medium bg-slate-100 border border-white text-slate-700 rounded-md">
                                                {ph}
                                            </span>
                                        ))}
                                        {template.placeholders?.length > 3 && (
                                            <span className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-medium bg-slate-100 border border-white text-slate-700 rounded-md">
                                                +{template.placeholders.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeTemplate(template.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Template"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
