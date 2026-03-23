import { Sidebar } from "./Sidebar";
import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";

export function Layout() {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 relative">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-8 w-full">
                    <Outlet />
                </div>
            </main>
            <Toaster position="top-right" richColors />
        </div>
    );
}
