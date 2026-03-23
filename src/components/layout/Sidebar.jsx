import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, FileSignature, Settings, Database, Mail } from "lucide-react";
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
                <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl -translate-y-4 translate-x-4 group-hover:bg-blue-500/20 transition-all"></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        Về Tác Giả
                    </p>
                    <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
                            <span className="text-slate-400 font-medium">Author</span>
                            <span className="text-white font-bold drop-shadow-sm">Dương Thanh Tùng</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-1.5 pt-0.5">
                            <span className="text-slate-400 font-medium">Role</span>
                            <span className="text-blue-400 font-bold truncate max-w-[120px] drop-shadow-sm" title="Quality and Operation Expert">Quality & Operation</span>
                        </div>
                        <div className="flex justify-between items-center pt-0.5">
                            <span className="text-slate-400 font-medium">Email</span>
                            <a href="mailto:tungdth88@gmail.com" className="text-slate-300 hover:text-blue-400 hover:underline transition-colors truncate max-w-[120px] font-medium" title="tungdth88@gmail.com">tungdth88@gmail.com</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
