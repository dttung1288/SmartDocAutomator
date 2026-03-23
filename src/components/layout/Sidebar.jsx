import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, FileSignature, Settings, Database } from "lucide-react";
import { cn } from "../../lib/utils";

const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Placeholders", href: "/placeholders", icon: Database },
    { name: "Templates", href: "/templates", icon: FileText },
    { name: "Generator", href: "/generator", icon: FileSignature },
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

            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
                        AD
                    </div>
                    <div>
                        <p className="text-sm font-medium">Admin User</p>
                        <p className="text-xs text-slate-400">admin@enterprise.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
