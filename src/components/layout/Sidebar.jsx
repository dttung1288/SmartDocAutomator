import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, FileSignature, Settings, Database, Mail, Briefcase } from "lucide-react";
import { cn } from "../../lib/utils";

const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Placeholders", href: "/placeholders", icon: Database },
    { name: "Templates", href: "/templates", icon: FileText },
    { name: "Doc Generator", href: "/generator", icon: FileSignature },
    { name: "Email Generator", href: "/email", icon: Mail },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    return (
        <div className="w-64 h-screen bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800">
            <div className="p-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
                    <FileSignature className="w-6 h-6 text-blue-500" />
                    SmartDoc
                </h1>
                <p className="text-xs text-slate-400 mt-1">Automator v1.0</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {links.map((link) => (
                    <NavLink
                        key={link.name}
                        to={link.href}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                                isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            )
                        }
                    >
                        <link.icon className="w-5 h-5" />
                        {link.name}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-900 shadow-inner">
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-xl p-4 border border-slate-700/50 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                    {/* Decorative background glow */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:bg-blue-500/20 transition-all duration-500"></div>
                    
                    {/* Header: Avatar + Title */}
                    <div className="flex items-center gap-3 relative z-10 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg border border-blue-400/30 flex-shrink-0">
                            DT
                        </div>
                        <div className="flex flex-col w-full overflow-hidden">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                                Tác Giả
                            </p>
                            <p className="text-[14px] font-bold text-white tracking-tight leading-tight truncate" title="Dương Thanh Tùng">Dương Thanh Tùng</p>
                        </div>
                    </div>
                    
                    {/* Info Rows */}
                    <div className="space-y-2 relative z-10 bg-slate-900/40 rounded-lg p-2.5 border border-slate-700/50">
                        {/* Role */}
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5 text-blue-400 flex-shrink-0">
                                <Briefcase className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-[11px] text-slate-300 font-medium leading-[1.3]">Quality and Operation Expert</p>
                        </div>
                        
                        {/* Email */}
                        <div className="flex items-center gap-2">
                            <div className="text-emerald-400 flex-shrink-0">
                                <Mail className="w-3.5 h-3.5" />
                            </div>
                            <a href="mailto:tungdth88@gmail.com" className="text-[11px] text-slate-300 hover:text-emerald-300 transition-colors font-medium truncate" title="tungdth88@gmail.com">tungdth88@gmail.com</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
