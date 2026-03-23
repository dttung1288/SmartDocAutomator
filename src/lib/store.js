import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useStore = create(
    persist(
        (set, get) => ({
            placeholders: [],     // Global list of available placeholder variables
            templates: [],        // List of imported templates
            activeTemplateId: null,
            activeEmailTemplateId: null,
            history: [],          // List of generated document history items

            // Manage Placeholders
            addPlaceholder: (ph) => set((state) => {
                if (!state.placeholders.some(p => p.name === ph.name)) {
                    return { placeholders: [...state.placeholders, ph] };
                }
                return state;
            }),
            setPlaceholders: (phs) => set({ placeholders: phs }),
            removePlaceholder: (name) => set((state) => ({
                placeholders: state.placeholders.filter((ph) => ph.name !== name)
            })),

            // Manage Templates
            addTemplate: (template) => set((state) => ({
                templates: [...state.templates, template]
            })),
            setActiveTemplate: (id) => set({ activeTemplateId: id }),
            setActiveEmailTemplate: (id) => set({ activeEmailTemplateId: id }),
            removeTemplate: (id) => set((state) => ({
                templates: state.templates.filter((t) => t.id !== id),
                activeTemplateId: state.activeTemplateId === id ? null : state.activeTemplateId,
                activeEmailTemplateId: state.activeEmailTemplateId === id ? null : state.activeEmailTemplateId
            })),

            // Manage History
            addHistoryItem: (item) => set((state) => ({
                history: [
                    { ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
                    ...state.history
                ].slice(0, 50) // Keep last 50 items
            })),
            clearHistory: () => set({ history: [] }),
        }),
        {
            name: 'smartdoc-storage',
            partialize: (state) => ({
                placeholders: state.placeholders.map(ph => {
                    // Loại bỏ binary data (buffer, rawXml) khỏi localStorage
                    // Chỉ giữ metadata (type, fileName) để biết file đã được lưu trong IndexedDB
                    if (ph.fileData && ph.fileData.type === 'altChunk') {
                        return {
                            ...ph,
                            fileData: {
                                type: ph.fileData.type,
                                fileName: ph.fileData.fileName,
                                // buffer và rawXml sẽ được tải lại từ IndexedDB khi cần
                            }
                        };
                    }
                    return ph;
                }),
                templates: state.templates.map(t => ({ 
                    id: t.id, 
                    fileName: t.fileName, 
                    type: t.type, 
                    placeholders: t.placeholders,
                    emailMetadata: t.emailMetadata
                })),
                activeTemplateId: state.activeTemplateId,
                activeEmailTemplateId: state.activeEmailTemplateId,
                history: state.history
            }),
            storage: createJSONStorage(() => localStorage),
        }
    )
);
