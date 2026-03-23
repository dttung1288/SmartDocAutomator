import { useState, useRef } from "react";
import { Database, Plus, Trash2, Upload, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../lib/store";
import { readExcelData, extractDocxContent } from "../lib/coreEngine";
import { cn } from "../lib/utils";
import { savePlaceholderBlob, deletePlaceholderBlob } from "../lib/blobStore";

export function PlaceholderManager() {
    const placeholders = useStore((state) => state.placeholders);
    const addPlaceholder = useStore((state) => state.addPlaceholder);
    const removePlaceholder = useStore((state) => state.removePlaceholder);
    const setPlaceholders = useStore((state) => state.setPlaceholders);

    const fileInputRef = useRef(null);

    const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await readExcelData(file);
            if (data && data.length > 0) {
                let count = 0;
                const newPhs = [...placeholders];

                data.forEach((row) => {
                    // Detect Excel columns
                    const baseKey = row["Place Holder"] || row["Key"] || row["Placeholder"];
                    if (baseKey) {
                        const trimmedKey = baseKey.trim();
                        // Kiểm tra nếu là placeholder dạng Content (VD: Clause 1_Content)
                        // → Giữ nguyên tên gốc, KHÔNG thêm _VI/_EN, đánh dấu là 'content'
                        const isContentPlaceholder = /content$/i.test(trimmedKey);

                        if (isContentPlaceholder) {
                            // Placeholder dạng nội dung dài: giữ nguyên tên, đánh dấu cần upload file
                            const hint = row["Vietnamese"] || row["English"] || row["Value"] || "";
                            if (!newPhs.some(p => p.name === trimmedKey)) {
                                newPhs.push({ name: trimmedKey, default: hint, type: 'content' });
                                count++;
                            } else {
                                const existing = newPhs.find(p => p.name === trimmedKey);
                                existing.default = hint;
                                existing.type = 'content';
                            }
                        } else {
                            // Placeholder bình thường: thêm đuôi _VI / _EN
                            // Mapping for Vietnamese column if it exists -> Key_VI
                            if (row["Vietnamese"]) {
                                const viKey = trimmedKey + "_VI";
                                if (!newPhs.some(p => p.name === viKey)) {
                                    newPhs.push({ name: viKey, default: row["Vietnamese"], type: 'text' });
                                    count++;
                                } else {
                                    const existing = newPhs.find(p => p.name === viKey);
                                    existing.default = row["Vietnamese"];
                                }
                            }
                            // Mapping for English column if it exists -> Key_EN
                            if (row["English"]) {
                                const enKey = trimmedKey + "_EN";
                                if (!newPhs.some(p => p.name === enKey)) {
                                    newPhs.push({ name: enKey, default: row["English"], type: 'text' });
                                    count++;
                                } else {
                                    const existing = newPhs.find(p => p.name === enKey);
                                    existing.default = row["English"];
                                }
                            }
                            // Direct simple Variable = Value
                            if (!row["Vietnamese"] && !row["English"] && row["Value"]) {
                                if (!newPhs.some(p => p.name === trimmedKey)) {
                                    newPhs.push({ name: trimmedKey, default: row["Value"], type: 'text' });
                                    count++;
                                } else {
                                    const existing = newPhs.find(p => p.name === trimmedKey);
                                    existing.default = row["Value"];
                                }
                            }
                        }
                    }
                });

                setPlaceholders(newPhs);
                toast.success(`Đã đồng bộ dữ liệu Excel! Cập nhật ${count} từ khóa thư viện.`);
            }
        } catch (err) {
            toast.error("File Excel không hợp lệ hoặc lỗi trong quá trình đọc.");
            console.error(err);
        }
        fileInputRef.current.value = "";
    };

    const updatePlaceholderValue = (idx, value, fileData = null) => {
        const newPhs = [...placeholders];
        newPhs[idx].default = value;
        // Quản lý biến fileData đi kèm (chứa ArrayBuffer để chèn altChunk)
        if (fileData !== undefined) {
            if (fileData === null) {
                // Xóa file đính kèm khỏi cả RAM và IndexedDB
                deletePlaceholderBlob(newPhs[idx].name);
                delete newPhs[idx].fileData;
            } else {
                newPhs[idx].fileData = fileData;
            }
        }
        setPlaceholders(newPhs);
    };

    const handleContentDocxUpload = async (e, idx) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await extractDocxContent(file);
            const arrayBuffer = await file.arrayBuffer();
            
            // Lưu ArrayBuffer vào IndexedDB để không mất khi F5
            const phName = placeholders[idx].name;
            await savePlaceholderBlob(phName, arrayBuffer);
            
            updatePlaceholderValue(idx, data.text, { 
                type: "altChunk", 
                buffer: arrayBuffer,
                fileName: file.name,
                rawXml: data.rawXml
            });
            toast.success("Trích xuất DOCX thành công! Toàn bộ định dạng đã được lưu ngầm.");
        } catch (err) {
            toast.error("Lỗi khi đọc file Word: " + err.message);
        }
        e.target.value = ""; // reset input
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Placeholder Dictionary</h1>
                    <p className="text-slate-500 mt-2">Quản lý kho biến dữ liệu "{'{{TAG}}'}" dùng để phát sinh văn bản hằng ngày.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input type="file" ref={fileInputRef} accept=".xlsx, .csv" className="hidden" onChange={handleExcelUpload} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" /> Import Excel Master
                    </button>
                    {placeholders.length > 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Bạn có chắc muốn xoá toàn bộ ${placeholders.length} biến?`)) {
                                    // Xoá tất cả blob trong IndexedDB
                                    placeholders.forEach(ph => {
                                        if (ph.fileData) deletePlaceholderBlob(ph.name);
                                    });
                                    setPlaceholders([]);
                                    toast.success("Đã xoá toàn bộ thư viện biến.");
                                }
                            }}
                            className="px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Xoá tất cả
                        </button>
                    )}
                </div>
            </div>

            {placeholders.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Chưa có Data Field nào được định nghĩa</h4>
                        <p className="text-xs mt-1 text-amber-700">
                            Hãy bấm nút "Import Excel Master" ở trên và chọn file Excel định nghĩa thư viện dữ liệu.
                            (Hệ thống hỗ trợ cấu trúc Cột: <strong>Place Holder | Vietnamese | English</strong> tự tự động map theo đuôi _VI và _EN)
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-600" />
                        Tổng quan Thư viện biến
                    </h2>
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-200 text-slate-700 rounded-full">
                        Total: {placeholders.length}
                    </span>
                </div>
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 border-b sticky top-0 backdrop-blur z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-slate-700 w-[250px]">Mã Template Tag</th>
                                <th className="px-6 py-3 font-semibold text-slate-700 auto-w">Nội dung</th>
                                <th className="px-6 py-3 font-semibold text-slate-700 w-20 text-center">Xoá</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 relative">
                            {placeholders.map((ph, idx) => {
                                const isContent = ph.name.toLowerCase().includes("content");
                                return (
                                    <tr key={idx + ph.name} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <span className="font-mono text-[13px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                {`{{${ph.name}}}`}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-700">
                                            <div className="flex flex-col gap-2">
                                                {isContent && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">Nội dung dài</span>
                                                        <label className="text-xs bg-white border border-slate-300 shadow-sm px-2 py-1 rounded cursor-pointer hover:bg-slate-50 flex items-center gap-1 font-medium transition-colors">
                                                            <FileText className="w-3.5 h-3.5 text-blue-600" /> Tải lên File .DOCX
                                                            <input type="file" accept=".docx" className="hidden" onChange={(e) => handleContentDocxUpload(e, idx)} />
                                                        </label>
                                                    </div>
                                                )}
                                                {ph.fileData && ph.fileData.type === 'altChunk' ? (
                                                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex flex-col gap-2 relative">
                                                        <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                                                            <FileText className="w-4 h-4" />
                                                            Đã đính kèm tệp: {ph.fileData.fileName}
                                                        </div>
                                                        <p className="text-xs text-blue-600">
                                                            Hệ thống đã lưu trữ định dạng gốc (Bullet, Font, Table). File sẽ được nhúng nguyên vẹn khi xuất Word. Text dưới đây chỉ là bản nháp để đối chiếu.
                                                        </p>
                                                        <textarea
                                                            className="w-full bg-white/50 border border-blue-100 text-blue-900 rounded-md px-3 py-2 resize-y text-xs"
                                                            rows={3}
                                                            value={ph.default || ""}
                                                            readOnly
                                                        />
                                                        <button 
                                                            onClick={() => updatePlaceholderValue(idx, "", null)}
                                                            className="absolute top-2 right-2 p-1 bg-blue-100 text-blue-600 rounded hover:bg-red-100 hover:text-red-600 transition"
                                                            title="Gỡ tệp"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <textarea
                                                        className={cn(
                                                            "w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md px-3 py-2 resize-none transition-all shadow-sm",
                                                            isContent ? "min-h-[100px]" : ""
                                                        )}
                                                        rows={isContent ? 4 : 1}
                                                        value={ph.default || ""}
                                                        onChange={(e) => updatePlaceholderValue(idx, e.target.value, null)}
                                                        placeholder={isContent ? "Nhập nội dung dài hoặc tải lên file word..." : "Trống"}
                                                        onInput={(e) => {
                                                            if (!isContent) {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => removePlaceholder(ph.name)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block"
                                                title="Xóa biến"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
