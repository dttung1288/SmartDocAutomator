import React, { useState, useRef } from "react";
import { Database, Plus, Trash2, Upload, AlertCircle, FileText, CheckCircle, Layers, Activity } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../lib/store";
import { readExcelData, extractDocxContent } from "../lib/coreEngine";
import { cn } from "../lib/utils";
import { savePlaceholderBlob, deletePlaceholderBlob } from "../lib/blobStore";

export function PlaceholderManager() {
    const placeholders = useStore((state) => state.placeholders);
    const templates = useStore((state) => state.templates);
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
                    const baseKey = row["Place Holder"] || row["Key"] || row["Placeholder"];
                    if (baseKey) {
                        const trimmedKey = baseKey.trim();
                        const isContentPlaceholder = /content$/i.test(trimmedKey);

                        if (isContentPlaceholder) {
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

    const updatePlaceholderValue = (globalIdx, value, fileData = null) => {
        const newPhs = [...placeholders];
        newPhs[globalIdx].default = value;
        if (fileData !== undefined) {
            if (fileData === null) {
                deletePlaceholderBlob(newPhs[globalIdx].name);
                delete newPhs[globalIdx].fileData;
            } else {
                newPhs[globalIdx].fileData = fileData;
            }
        }
        setPlaceholders(newPhs);
    };

    const handleContentDocxUpload = async (e, globalIdx) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await extractDocxContent(file);
            const arrayBuffer = await file.arrayBuffer();
            
            const phName = placeholders[globalIdx].name;
            await savePlaceholderBlob(phName, arrayBuffer);
            
            updatePlaceholderValue(globalIdx, data.text, { 
                type: "altChunk", 
                buffer: arrayBuffer,
                fileName: file.name,
                rawXml: data.rawXml
            });
            toast.success("Trích xuất DOCX thành công! Toàn bộ định dạng đã được lưu ngầm.");
        } catch (err) {
            toast.error("Lỗi khi đọc file Word: " + err.message);
        }
        e.target.value = ""; 
    };

    // Chuẩn bị Grouping
    const groupedPlaceholders = placeholders.reduce((acc, ph) => {
        const prefix = ph.name.split('_')[0];
        if (!acc[prefix]) acc[prefix] = [];
        acc[prefix].push(ph);
        return acc;
    }, {});

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800">Placeholder Dictionary</h1>
                    <p className="text-slate-500 mt-2">Quản lý kho biến dữ liệu "{"{{TAG}}"}" dùng để phát sinh văn bản hằng ngày.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <input type="file" ref={fileInputRef} accept=".xlsx, .csv" className="hidden" onChange={handleExcelUpload} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 border border-blue-200 bg-blue-600 text-white rounded-lg shadow-sm shadow-blue-500/30 text-sm font-semibold hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" /> Import Excel Master
                    </button>
                    {placeholders.length > 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Bạn có chắc muốn xoá toàn bộ ${placeholders.length} biến?`)) {
                                    placeholders.forEach(ph => {
                                        if (ph.fileData) deletePlaceholderBlob(ph.name);
                                    });
                                    setPlaceholders([]);
                                    toast.success("Đã xoá toàn bộ thư viện biến.");
                                }
                            }}
                            className="px-4 py-2 bg-slate-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Xoá tất cả
                        </button>
                    )}
                </div>
            </div>

            {placeholders.length === 0 ? (
                <div className="bg-slate-50/50 border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center mt-12 shadow-sm">
                    <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-100">
                        <Database className="w-10 h-10 opacity-80" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-3">Chưa có Data Field nào được định nghĩa</h3>
                    <p className="text-slate-500 max-w-lg mb-8 leading-relaxed">
                        Hệ thống chưa có thư viện biến để điền dữ liệu tự động. Hãy bấm nút <strong className="text-slate-700">Import Excel Master</strong> để tải lên danh sách cấu trúc hoặc tự định nghĩa các biến (Ví dụ: Tên, Chức vụ, Phòng ban).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full max-w-4xl">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3 font-semibold text-slate-800">
                                <FileText className="w-5 h-5 text-blue-500" /> Cấu trúc cột Excel
                            </div>
                            <p className="text-sm text-slate-600">Cột đầu tiên bắt buộc phải có tên là <strong className="text-slate-800">Place Holder</strong> hoặc <strong className="text-slate-800">Key</strong>.</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3 font-semibold text-slate-800">
                                <Layers className="w-5 h-5 text-emerald-500" /> Dịch thuật Song ngữ
                            </div>
                            <p className="text-sm text-slate-600">Hệ thống sẽ tự nhận diện nhanh cột <strong className="text-slate-800">Vietnamese</strong> và <strong className="text-slate-800">English</strong> và tạo hậu tố.</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3 font-semibold text-slate-800">
                                <CheckCircle className="w-5 h-5 text-purple-500" /> AltChunk Word
                            </div>
                            <p className="text-sm text-slate-600">Đặt tên biến có chữ <strong className="text-slate-800">Content</strong> ở cuối để cho phép tính năng Word lồng Word.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 z-20">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-600" />
                            Tổng quan Thư viện biến
                        </h2>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full shadow-sm">
                            Total: {placeholders.length}
                        </span>
                    </div>
                    <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/80 border-b sticky top-0 backdrop-blur z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-slate-700 w-[300px]">Mã Template Tag</th>
                                    <th className="px-6 py-3 font-semibold text-slate-700 auto-w">Dữ liệu Mặc định (Default)</th>
                                    <th className="px-6 py-3 font-semibold text-slate-700 w-24 text-center">Xoá</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 relative">
                                {Object.entries(groupedPlaceholders).map(([groupName, phs]) => {
                                    return (
                                        <React.Fragment key={groupName}>
                                            <tr className="bg-slate-100/70 border-y border-slate-200">
                                                <td colSpan="3" className="px-6 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-slate-400" />
                                                        <span className="font-bold text-slate-700 uppercase tracking-widest text-xs opacity-80">{groupName}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 rounded-full shadow-sm">{phs.length}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {phs.map((ph) => {
                                                const isContent = ph.name.toLowerCase().includes("content");
                                                const globalIdx = placeholders.findIndex(p => p.name === ph.name);
                                                
                                                // Tính toán trạng thái
                                                const isOrphan = !templates.some(t => t.placeholders && t.placeholders.includes(ph.name));
                                                const isMissingData = (!ph.default && !ph.fileData);
                                                
                                                let statusClasses = "bg-emerald-50 text-emerald-600 border-emerald-200";
                                                let statusLabel = "Đang sử dụng";
                                                let statusIcon = <CheckCircle className="w-3 h-3" />;
                                                
                                                if (isMissingData) {
                                                    statusClasses = "bg-red-50 text-red-600 border-red-200";
                                                    statusLabel = "Thiếu dữ liệu";
                                                    statusIcon = <AlertCircle className="w-3 h-3" />;
                                                } else if (isOrphan) {
                                                    statusClasses = "bg-slate-50 text-slate-500 border-slate-200";
                                                    statusLabel = "Mồ côi";
                                                    statusIcon = <Activity className="w-3 h-3" />;
                                                }

                                                return (
                                                    <tr key={ph.name} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-6 py-4 align-top">
                                                            <div className="flex flex-col items-start gap-2">
                                                                <span className="font-mono text-xs font-semibold text-slate-800 bg-white shadow-sm px-2.5 py-1 rounded-md border border-slate-200">
                                                                    {`{{${ph.name}}}`}
                                                                </span>
                                                                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center gap-1 shadow-sm", statusClasses)} title={isOrphan ? "Chưa được gắn vào bất kỳ Template nào" : "Sẵn sàng"}>
                                                                    {statusIcon} {statusLabel}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-700 align-top">
                                                            <div className="flex flex-col gap-2 max-w-4xl">
                                                                {isContent && (
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded shadow-sm">Content Block</span>
                                                                        <label className="text-xs bg-white border border-slate-300 shadow-sm px-3 py-1.5 rounded cursor-pointer hover:bg-slate-50 flex items-center gap-1.5 font-semibold text-slate-700 transition-colors">
                                                                            <Upload className="w-3.5 h-3.5 text-blue-600" /> Tải lên File .DOCX phụ
                                                                            <input type="file" accept=".docx" className="hidden" onChange={(e) => handleContentDocxUpload(e, globalIdx)} />
                                                                        </label>
                                                                    </div>
                                                                )}
                                                                {ph.fileData && ph.fileData.type === 'altChunk' ? (
                                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col gap-2 relative shadow-sm">
                                                                        <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                                                                            <FileText className="w-4 h-4" />
                                                                            Đã đính kèm tệp: {ph.fileData.fileName}
                                                                        </div>
                                                                        <p className="text-[11px] font-medium text-blue-600/80 bg-white/50 p-2 rounded border border-blue-100">
                                                                            Định dạng gốc của văn bản DOCX đã được lưu. Đoạn text dưới đây chỉ dùng để đối chiếu sơ bộ nội dung.
                                                                        </p>
                                                                        <textarea
                                                                            className="w-full bg-white border border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-800 rounded-md px-3 py-2 resize-y text-xs shadow-inner"
                                                                            rows={3}
                                                                            value={ph.default || ""}
                                                                            readOnly
                                                                        />
                                                                        <button 
                                                                            onClick={() => updatePlaceholderValue(globalIdx, "", null)}
                                                                            className="absolute top-3 right-3 p-1.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded transition-colors shadow-sm"
                                                                            title="Gỡ file đính kèm"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative group">
                                                                        <textarea
                                                                            className={cn(
                                                                                "w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg px-3 py-2.5 resize-none transition-all shadow-sm text-sm font-medium",
                                                                                isContent ? "min-h-[100px]" : "min-h-[42px]",
                                                                                isMissingData ? "border-red-300 focus:ring-red-500/10 focus:border-red-500 bg-red-50/30" : ""
                                                                            )}
                                                                            rows={isContent ? 4 : 1}
                                                                            value={ph.default || ""}
                                                                            onChange={(e) => updatePlaceholderValue(globalIdx, e.target.value, null)}
                                                                            placeholder={isContent ? "Nhập nội dung dài hoặc tải lên file word..." : "Bỏ trống..."}
                                                                            onInput={(e) => {
                                                                                if (!isContent) {
                                                                                    e.target.style.height = 'auto';
                                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center align-middle">
                                                            <button
                                                                onClick={() => removePlaceholder(ph.name)}
                                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                                                title="Xóa biến"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
