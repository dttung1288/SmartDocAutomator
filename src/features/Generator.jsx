import { useState, useEffect, useRef } from "react";
import { useStore } from "../lib/store";
import { generateDocumentBlob } from "../lib/coreEngine";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { PlayCircle, FileText, Download, LayoutTemplate, Eye, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { loadBlobForTemplate, loadPlaceholderBlob } from "../lib/blobStore";
import * as docx from "docx-preview";
import { extractDocxContent } from "../lib/coreEngine";

export function Generator() {
    const templates = useStore((state) => state.templates);
    const placeholders = useStore((state) => state.placeholders);
    const setPlaceholders = useStore((state) => state.setPlaceholders);
    const activeTemplateId = useStore((state) => state.activeTemplateId);
    const setActiveTemplate = useStore((state) => state.setActiveTemplate);
    
    const [formData, setFormData] = useState({});
    const [activeTemplate, setActiveTemplateContext] = useState(null);
    const [wordFileNameFormat, setWordFileNameFormat] = useState("Generated_Document_{{Proposal_Name_VI}}");
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState("data"); // "data" | "preview"
    const [contentTemplateSelection, setContentTemplateSelection] = useState({});

    const previewContainerRef = useRef(null);

    // Filter to only show word templates
    const wordTemplates = templates.filter(t => t.type === 'word');

    // Initialize form data with placeholders
    useEffect(() => {
        const initialSelections = {};
        
        setFormData(prev => {
            const nextData = { ...prev };
            placeholders.forEach(ph => {
                // If this placeholder has fileData, prioritize it.
                if (ph.fileData) {
                    // Chỉ gán fileData khi nó có buffer (tức là đã được load trọn vẹn)
                    if (ph.fileData.buffer) {
                        nextData[ph.name] = ph.fileData;
                    }
                    initialSelections[ph.name] = "FROM_LIBRARY";
                } else if (nextData[ph.name] === undefined || typeof nextData[ph.name] === 'object') {
                    nextData[ph.name] = ph.default || "";
                }
            });
            return nextData;
        });
        
        setContentTemplateSelection(prev => ({ ...initialSelections, ...prev }));
    }, [placeholders]);

    // Tải lại buffer từ IndexedDB cho các placeholder có file đính kèm (sau page refresh)
    useEffect(() => {
        const restoreBuffers = async () => {
            for (const ph of placeholders) {
                if (ph.fileData && ph.fileData.type === 'altChunk' && !ph.fileData.buffer) {
                    // fileData tồn tại nhưng thiếu buffer => cần tải lại từ IndexedDB
                    const buffer = await loadPlaceholderBlob(ph.name);
                    if (buffer) {
                        // Cập nhật lại fileData với buffer đầy đủ
                        const restoredFileData = {
                            ...ph.fileData,
                            buffer: buffer
                        };
                        // Cập nhật formData
                        setFormData(prev => ({ ...prev, [ph.name]: restoredFileData }));
                        // Cập nhật placeholder trong store để các component khác cũng nhận được
                        const idx = placeholders.findIndex(p => p.name === ph.name);
                        if (idx >= 0) {
                            const newPhs = [...placeholders];
                            newPhs[idx] = { ...newPhs[idx], fileData: restoredFileData };
                            setPlaceholders(newPhs);
                        }
                    }
                }
            }
        };
        restoreBuffers();
    }, []); // Chỉ chạy 1 lần khi mount

    // Load active template blob
    useEffect(() => {
        const template = templates.find(t => t.id === activeTemplateId);
        if (!template) {
            setActiveTemplateContext(null);
            return;
        }
        if (template.fileBlob) {
            setActiveTemplateContext(template);
        } else {
            loadBlobForTemplate(template.id).then(blob => {
                if (blob) {
                    setActiveTemplateContext({ ...template, fileBlob: blob });
                } else {
                    setActiveTemplateContext(template);
                }
            });
        }
    }, [activeTemplateId, templates]);

    const handleInputChange = (e, key) => {
        setFormData(prev => ({ ...prev, [key]: e.target.value }));
    };

    const handleContentTemplateChange = async (templateId, placeholderName) => {
        setContentTemplateSelection(prev => ({ ...prev, [placeholderName]: templateId }));
        
        if (templateId === "FROM_LIBRARY") {
            const ph = placeholders.find(p => p.name === placeholderName);
            if (ph && ph.fileData) {
                if (ph.fileData.buffer) {
                    setFormData(prev => ({ ...prev, [placeholderName]: ph.fileData }));
                } else {
                    // Buffer chưa có (sau page refresh) → tải lại từ IndexedDB
                    const buffer = await loadPlaceholderBlob(placeholderName);
                    if (buffer) {
                        const restoredFileData = { ...ph.fileData, buffer };
                        setFormData(prev => ({ ...prev, [placeholderName]: restoredFileData }));
                    }
                }
            }
            return;
        }

        if (!templateId) {
            setFormData(prev => ({ ...prev, [placeholderName]: "" }));
            return;
        }

        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        let blob = template.fileBlob;
        if (!blob) {
            blob = await loadBlobForTemplate(template.id);
        }
        
        if (blob) {
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const extracted = await extractDocxContent(blob);
                setFormData(prev => ({ ...prev, [placeholderName]: { 
                    type: "altChunk", 
                    buffer: arrayBuffer,
                    fileName: template.fileName,
                    rawXml: extracted.rawXml
                } }));
                toast.success(`Đã nạp file ghép mẫu cho biến ${placeholderName}`);
            } catch (err) {
                toast.error("Lỗi đọc file DOCX: " + err.message);
            }
        }
    };

    const injectFileName = (formatStr, data) => {
        if (!formatStr) return "Document";
        return formatStr.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
            return data[key.trim()] !== undefined && data[key.trim()] !== "" ? data[key.trim()] : match;
        });
    };

    const handleGenerateWord = async () => {
        if (!activeTemplate?.fileBlob) {
            toast.error("Vui lòng kích hoạt một Template Word trước.");
            return;
        }

        setIsGenerating(true);
        try {
            const templateArrayBuffer = await activeTemplate.fileBlob.arrayBuffer();
            const blob = generateDocumentBlob(templateArrayBuffer, formData);
            
            let finalFileName = injectFileName(wordFileNameFormat, formData);
            finalFileName = finalFileName.replace(/[<>:"/\\|?*\n\r]+/g, '_');
            if (!finalFileName.toLowerCase().endsWith('.docx')) finalFileName += ".docx";

            saveAs(blob, finalFileName);
            toast.success("Tạo file Word thành công!");
        } catch (error) {
            console.error("Lỗi khi tạo Word:", error);
            toast.error("Đã xảy ra lỗi khi tạo file Word: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePreview = async () => {
        if (!activeTemplate?.fileBlob) {
            toast.error("Vui lòng kích hoạt một Template Word trước.");
            return;
        }
        
        setActiveTab("preview");
        setIsGenerating(true);
        
        try {
            // Need a small timeout to let the DOM render the preview container first if we just switched tabs
            setTimeout(async () => {
                if (!previewContainerRef.current) return;
                
                try {
                    const templateArrayBuffer = await activeTemplate.fileBlob.arrayBuffer();
                    const blob = generateDocumentBlob(templateArrayBuffer, formData);
                    
                    previewContainerRef.current.innerHTML = "";
                    await docx.renderAsync(blob, previewContainerRef.current, previewContainerRef.current, {
                        className: "docx-viewer",
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                    });
                    
                    toast.success("Đã tạo bản xem trước!");
                } catch (innerErr) {
                    console.error("Render Preview error:", innerErr);
                    toast.error("Lỗi khi hiển thị bản xem trước: " + innerErr.message);
                } finally {
                    setIsGenerating(false);
                }
            }, 100);
        } catch (error) {
            console.error("Preview error:", error);
            toast.error("Lỗi khi tạo bản xem trước: " + error.message);
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-300">
            {/* Left Panel: Actions & Settings */}
            <div className="w-1/3 flex flex-col gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-6 h-full">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 mb-2 flex items-center gap-2">
                            <FileText className="text-blue-600" />
                            Xuất File Word
                        </h2>
                        <p className="text-sm text-slate-500">
                            Cấu hình và tải xuống file Word dựa trên template và dữ liệu bạn đã nhập.
                        </p>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-slate-700">Chọn Template</label>
                            <div className="relative">
                                <select 
                                    className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-4 py-3 outline-none"
                                    value={activeTemplateId || ""}
                                    onChange={(e) => setActiveTemplate(e.target.value)}
                                >
                                    <option value="" disabled>-- Vui lòng chọn Template --</option>
                                    {wordTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.fileName}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                            {wordTemplates.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">Chưa có Template Word nào trong thư viện.</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-slate-700">Định dạng tên file đầu ra</label>
                            <input 
                                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50"
                                value={wordFileNameFormat}
                                onChange={(e) => setWordFileNameFormat(e.target.value)}
                                placeholder="VD: Hop_dong_{{Ten_Khach_Hang}}"
                            />
                            <p className="text-xs text-slate-400 italic">Sử dụng {'{{tên_biến}}'} để chèn dữ liệu vào tên file.</p>
                        </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-3">
                        <button
                            onClick={handlePreview}
                            disabled={isGenerating || !activeTemplate}
                            className={cn(
                                "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2",
                                (isGenerating || !activeTemplate) 
                                    ? "border-slate-200 text-slate-400 cursor-not-allowed" 
                                    : "border-blue-100 text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-[0.98]"
                            )}
                        >
                            <Eye className="w-5 h-5" />
                            Xem trước Bản in
                        </button>
                        
                        <button
                            onClick={handleGenerateWord}
                            disabled={isGenerating || !activeTemplate}
                            className={cn(
                                "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md",
                                (isGenerating || !activeTemplate) 
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
                            )}
                        >
                            {isGenerating && activeTab === 'data' ? (
                                "Đang xử lý..."
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Tạo và Tải File Word
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Data Editor & Preview */}
            <div className="w-2/3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab("data")}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2",
                                activeTab === "data" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <LayoutTemplate className="w-4 h-4" /> Dữ liệu Placeholder
                        </button>
                        <button
                            onClick={() => {
                                if (!activeTemplate?.fileBlob) {
                                    toast.error("Vui lòng chọn Template Word.");
                                    return;
                                }
                                handlePreview();
                            }}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2",
                                activeTab === "preview" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Eye className="w-4 h-4" /> Xem trước File Doc
                        </button>
                    </div>
                    
                    {activeTab === "data" && (
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                            <PlayCircle className="w-4 h-4" /> Live Editor
                        </span>
                    )}
                </div>

                {activeTab === "data" ? (
                    <div className="flex-1 overflow-auto p-8 bg-[#f8fafc]">
                        {placeholders.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                                    <LayoutTemplate className="w-10 h-10 text-slate-300" />
                                </div>
                                <p className="text-sm">Không tìm thấy placeholders nào.</p>
                                <p className="text-xs">Vui lòng chọn hoặc tải lên một Template Word chứa các biến {'{{tên_biến}}'}.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                                {placeholders.map(ph => {
                                    const isContentPlaceholder = /content$/i.test(ph.name);
                                    
                                    return (
                                        <div key={ph.name} className="flex flex-col gap-1.5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                                            <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                                                <span className="capitalize">{ph.name.replace(/_/g, ' ')}</span>
                                                <span className="text-[10px] text-indigo-400 font-mono bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                    {'{' + ph.name + '}'}
                                                </span>
                                            </label>
                                            
                                            {isContentPlaceholder ? (
                                                <div className="relative mt-2">
                                                    <select
                                                        value={contentTemplateSelection[ph.name] || ""}
                                                        onChange={(e) => handleContentTemplateChange(e.target.value, ph.name)}
                                                        className="w-full px-3 py-2.5 appearance-none border border-indigo-200 bg-indigo-50/30 text-indigo-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                                    >
                                                        <option value="">-- Chọn File Mẫu (.docx) --</option>
                                                        {ph.fileData && <option value="FROM_LIBRARY">📎 Tệp đính kèm: {ph.fileData.fileName}</option>}
                                                        {wordTemplates.map(t => (
                                                            <option key={t.id} value={t.id}>📄 {t.fileName}</option>
                                                        ))}
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-indigo-500">
                                                        <ChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={formData[ph.name] || ""}
                                                    onChange={(e) => handleInputChange(e, ph.name)}
                                                    className={cn(
                                                        "w-full px-1 py-2 outline-none text-slate-600 bg-transparent resize-y",
                                                        "h-11 text-sm font-medium"
                                                    )}
                                                    placeholder={`Nhập ${ph.name.replace(/_/g, ' ')}...`}
                                                    spellCheck={false}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto bg-slate-100 p-8 flex flex-col items-center">
                        <div className="w-full max-w-[800px] bg-amber-50 text-amber-800 text-xs px-4 py-2 rounded mb-4 border border-amber-200">
                            <strong>Lưu ý:</strong> Chế độ xem trước này chỉ hỗ trợ hiển thị văn bản Text đơn giản. Các file Word lớn đính kèm giữ nguyên Bullet/Style (Clause_Content) <strong>sẽ bị phần mềm Preview bỏ qua không hiển thị</strong>. Hãy bấm "Xuất File Word" để xem bản hoàn chỉnh 100%.
                        </div>
                        <div 
                            ref={previewContainerRef} 
                            className="bg-white min-h-[842px] w-full max-w-[800px] shadow-lg border border-slate-200 p-10 docx-preview-container"
                        >
                            <div className="flex justify-center items-center h-full text-slate-400 flex-col gap-4">
                                {isGenerating ? (
                                    <p className="animate-pulse">Đang nạp bản xem trước...</p>
                                ) : (
                                    <p>Không thể hiển thị bản xem trước. Hãy thử xuất file.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
