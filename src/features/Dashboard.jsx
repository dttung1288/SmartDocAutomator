import { FileText, FileSignature, Database, Users, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";

export function Dashboard() {
    const templates = useStore((state) => state.templates);
    const placeholders = useStore((state) => state.placeholders);
    const history = useStore((state) => state.history);

    const stats = [
        { label: "Templates", value: templates.length, icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
        { label: "Data Fields", value: placeholders.length, icon: Database, color: "text-emerald-600", bg: "bg-emerald-100" },
        { label: "Docs Generated", value: history.length, icon: FileSignature, color: "text-purple-600", bg: "bg-purple-100" },
        { label: "Storage", value: "Local", icon: Users, color: "text-amber-600", bg: "bg-amber-100" },
    ];

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                <p className="text-slate-500 mt-2">Welcome to SmartDoc Automator. Here is what is happening today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className={`p-4 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`w-8 h-8 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                            <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/templates" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer group">
                            <FileText className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                            <span className="mt-3 font-medium text-blue-700">Upload Template</span>
                        </Link>
                        <Link to="/generator" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-200 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer group">
                            <FileSignature className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform" />
                            <span className="mt-3 font-medium text-purple-700">Generate Doc</span>
                        </Link>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold">Recent Activity</h2>
                        {history.length > 0 && (
                            <button 
                                onClick={() => useStore.getState().clearHistory()}
                                className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="space-y-4 flex-1 overflow-auto max-h-[300px] pr-2">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                                <FileSignature className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-sm italic">Chưa có lịch sử xuất file.</p>
                            </div>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="flex items-center gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'email' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {item.type === 'email' ? <Mail className="w-5 h-5" /> : <FileSignature className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" title={item.fileName}>{item.fileName}</p>
                                        <p className="text-xs text-slate-400">{formatTime(item.timestamp)} • {item.type?.toUpperCase() || 'WORD'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
