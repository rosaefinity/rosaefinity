import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { saveSound, getAllSounds, deleteSoundFromDB } from "../lib/db";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import {
  Plus, Play, Trash2, Volume2, VolumeX, Loader2, X,
  Settings, Music, FileText, CheckCircle2
} from "lucide-react";

const builtInSounds = [
  { id: "builtin-alert", name: "Classic Alert", file: null, category: "builtin" },
  { id: "builtin-chime", name: "Soft Chime", file: null, category: "builtin" },
  { id: "builtin-pop", name: "Pop", file: null, category: "builtin" },
  { id: "builtin-success", name: "Success", file: null, category: "builtin" },
  { id: "builtin-error", name: "Error", file: null, category: "builtin" },
];

export function SoundsPage() {
  const { customSounds, addSound, updateSound, deleteSound, licenseInfo, licenseInfo: { isPro } } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingSound, setEditingSound] = useState<any>(null);
  const [formData, setFormData] = useState<{ name: string; file: string | null; fileName: string }>({ name: "", file: null, fileName: "" });
  const [masterVolume, setMasterVolume] = useState(80);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const canAddSound = isPro || customSounds.length < (licenseInfo.limits?.customSounds || 3);
  const allSounds = [...builtInSounds, ...customSounds];

  // Load sounds from Dexie on mount (restores media blobs lost by partialize)
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const dbSounds = await getAllSounds();
        const store = useAppStore.getState();
        // Merge: only add sounds in DB but not in store (with files)
        for (const dbSound of dbSounds) {
          const existing = store.customSounds.find(s => s.id === dbSound.id);
          if (existing && !existing.file && dbSound.file) {
            store.updateSound(dbSound.id, { file: dbSound.file, fileName: dbSound.fileName });
          } else if (!existing) {
            store.addSound({ name: dbSound.name, file: dbSound.file, fileName: dbSound.fileName, enabled: true } as any);
          }
        }
      } catch (_) {}
    };
    loadFromDB();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", file: "" as any, fileName: "" });
    setEditingSound(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setFormData({ ...formData, file: reader.result as string, fileName: file.name });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.file) { alert("Name and file required"); return; }
    if (editingSound) {
      updateSound(editingSound.id, { name: formData.name, file: formData.file || "", fileName: formData.fileName });
      await saveSound(editingSound.id, formData.name, formData.file || "", formData.fileName);
    } else {
      if (!canAddSound) { alert(`Free plan limited to ${licenseInfo.limits?.customSounds || 3} custom sounds`); return; }
      addSound({ ...formData, file: formData.file || (formData as any).fileName || '', enabled: true } as any);
      // The store auto-generates the id; we'll grab it from the latest entry
      const latest = useAppStore.getState().customSounds.slice(-1)[0];
      if (latest) await saveSound(latest.id, latest.name, latest.file, latest.fileName);
    }
    setShowModal(false);
  };

  const playSound = (sound: any) => {
    if (playingId === sound.id) { setPlayingId(null); return; }
    if (sound.file) {
      const audio = new Audio(sound.file);
      audio.volume = masterVolume / 100;
      audio.play().then(() => setPlayingId(sound.id)).catch(console.error);
      audio.onended = () => setPlayingId(null);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Sounds</h1>
            <p className="text-xs text-white/40">Manage your sound library</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-white/50" />
              <input type="range" min="0" max="100" value={masterVolume} onChange={(e) => setMasterVolume(parseInt(e.target.value))} className="w-32 h-2 accent-primary" />
              <span className="text-xs text-white/50 w-10 text-right">{masterVolume}%</span>
            </div>
            <Button onClick={() => { resetForm(); setShowModal(true); }} disabled={!canAddSound} className="gap-2">
              <Plus className="w-4 h-4" /> Add Sound
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Master Toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Sounds Enabled</h3>
              <p className="text-xs text-white/40">Globally enable/disable all sounds</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-11 h-6 bg-white/[0.08] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
          </label>
        </div>
      </motion.div>

      {/* Sounds Grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-sm font-semibold text-white mb-3">Built-in Sounds</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {builtInSounds.map((sound) => (
            <motion.div key={sound.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/[0.06] bg-card p-4 hover:border-white/[0.12] transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-green" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{sound.name}</p>
                    <p className="text-xs text-white/40">Built-in</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => playSound(sound)}>
                  {playingId === sound.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {customSounds.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-white mb-3">Custom Sounds</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customSounds.map((sound) => (
                <motion.div key={sound.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/[0.06] bg-card p-4 hover:border-white/[0.12] transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{sound.name}</p>
                        <p className="text-xs text-white/40">{sound.fileName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => playSound(sound)}>
                        {playingId === sound.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditingSound(sound); setFormData({ name: sound.name, file: sound.file, fileName: sound.fileName }); setShowModal(true); }}>
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={async () => { deleteSound(sound.id); await deleteSoundFromDB(sound.id); }} className="text-danger/60 hover:text-danger">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {customSounds.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/[0.06] bg-card p-8 text-center">
            <Music className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white mb-1">No custom sounds yet</h3>
            <p className="text-xs text-white/40 mb-4">Upload your own sound files to use in actions</p>
            <Button onClick={() => { resetForm(); setShowModal(true); }} disabled={!canAddSound} className="gap-2">
              <Plus className="w-4 h-4" /> Add Your First Sound
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Add/Edit Sound Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowModal(false); resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{editingSound ? "Edit Sound" : "Add Custom Sound"}</h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Sound Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Custom Sound"
                    required
                    className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Audio File (MP3, WAV, OGG)</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    required
                    className="w-full text-xs text-white/40 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                  />
                  {formData.fileName && <p className="text-xs text-white/40 mt-1">{formData.fileName}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
                  <Button variant="ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
                  <Button type="submit" className="gap-2">
                    {editingSound ? "Update Sound" : "Add Sound"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}