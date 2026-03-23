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

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex-shrink-0 flex items-center justify-center font-bold text-sm text-white shadow-lg border border-blue-400 border-opacity-30">
                        DT
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate hover:text-blue-400 transition-colors cursor-default" title="Dương Thanh Tùng">Dương Thanh Tùng</p>
                        <p className="text-[10.5px] text-blue-300 font-semibold truncate cursor-default" title="Quality and Operation Expert">Quality and Operation Expert</p>
                        <p className="text-[10px] text-slate-400 truncate hover:text-slate-300 transition-colors cursor-pointer" title="tungdth88@gmail.com" onClick={() => window.location.href = 'mailto:tungdth88@gmail.com'}>tungdth88@gmail.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
