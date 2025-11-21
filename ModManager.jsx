import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc 
} from 'firebase/firestore';
import { 
  RefreshCw, 
  Trash2, 
  Plus, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  Download,
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  Server,
  Target,
  Share2,
  Filter,
  Upload,
  Copy,
  X,
  Gift,
  ThumbsUp,
  ArrowDownToLine,
  LogOut,
  Shield,
  Users,
  Lock,
  Wifi,
  Hash,
  Globe,
  Link as LinkIcon,
  FileText,
  Terminal,
  Save,
  Zap,
  Link2,
  Layers,
  Eye,
  EyeOff,
  Edit3,
  Archive,
  FolderOpen
} from 'lucide-react';

// --- Configuration ---
const MODRINTH_API_BASE = "https://api.modrinth.com/v2";

// ------------------------------------------------------------------
// --- FIREBASE CONFIGURATION ---
// Paste your config object from the Firebase Console below.
// ------------------------------------------------------------------
const manualConfig = {
  apiKey: "AIzaSyAKmyXDM-1YbhWD8rPxszq1o9RxP918bKU",
  authDomain: "modrinth-manager.firebaseapp.com",
  projectId: "modrinth-manager",
  storageBucket: "modrinth-manager.firebasestorage.app",
  messagingSenderId: "567380643150",
  appId: "1:567380643150:web:8683fe9269ff817a6f221f",
  measurementId: "G-48CPQ9VVJM"
};

// Logic to select the correct config (Manual vs Environment)
const getFirebaseConfig = () => {
  if (manualConfig.apiKey) return manualConfig;
  if (typeof __firebase_config !== 'undefined') return JSON.parse(__firebase_config);
  return {}; // Fallback to prevent crash, will error on connection
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Unique ID for this specific instance of the app to separate data
const storageAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-mod-manager';

const MC_VERSIONS = [
  "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6", "1.21.5", 
  "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21", 
  "1.20.6", "1.20.4", "1.20.2", "1.20.1", 
  "1.19.4", "1.19.2", "1.18.2", "1.16.5"
];

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-sm ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, title = "" }) => {
  const baseStyle = "px-4 py-2 rounded font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-500 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50",
    ghost: "hover:bg-slate-700/50 text-slate-400 hover:text-slate-200",
    outline: "border border-slate-600 hover:border-slate-500 text-slate-300 hover:bg-slate-800",
    purple: "bg-purple-600 hover:bg-purple-500 text-white"
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-700 text-slate-300",
    green: "bg-emerald-900/50 text-emerald-400 border border-emerald-800",
    yellow: "bg-amber-900/50 text-amber-400 border border-amber-800",
    red: "bg-red-900/50 text-red-400 border border-red-800",
    purple: "bg-purple-900/50 text-purple-400 border border-purple-800",
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- Helper Logic ---

const generateCode = (prefix) => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No 0,1,I,O for readability
  let result = '';
  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${prefix}-${result}`; // e.g. ADM-X92Z
};

// Robust Copy Function
const copyToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    return true;
  } catch (err) {
    console.error('Failed to copy', err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
};

// Helper to resolve dependency ID to Title (Moved outside component to be accessible)
const resolveDependencyName = async (depId) => {
    try {
        const response = await fetch(`${MODRINTH_API_BASE}/project/${depId}`);
        if (!response.ok) return null;
        const json = await response.json();
        return { id: json.id, slug: json.slug, title: json.title };
    } catch (e) { return null; }
}

// --- Sub-Components ---

const ScriptModal = ({ isOpen, onClose, mods, targetVersion }) => {
  if (!isOpen) return null;

  // 1. Filter for ready mods
  const readyMods = mods.filter(m => m.target_version_number !== 'None Found');
  
  // 2. Ensure Uniqueness (Double safety, though app logic shouldn't allow dupes)
  // Map by slug to ensure we only have one download command per mod
  const uniqueMods = [...new Map(readyMods.map(item => [item.slug, item])).values()];

  // Generate the bash script
  let script = `#!/bin/bash\n# Auto-generated Mod Migration Script for ${targetVersion}\n`;
  script += `# Contains ${uniqueMods.length} unique mods\n\n`;
  script += `mkdir -p mods\ncd mods\n\n`;
  
  uniqueMods.forEach(mod => {
    // Prefer primary file URL, fallback to target_file_url (page) with warning if strictly needed
    const url = mod.primary_file_url || mod.target_file_url;
    const filename = `${mod.slug}-${mod.target_version_number}.jar`;
    
    script += `echo "Downloading ${mod.title}..."\n`;
    // -O forces the filename. -nc skips download if file exists (No Clobber)
    script += `wget -nc -O "${filename}" "${url}"\n`; 
  });

  script += `\necho "Download complete! ${uniqueMods.length} mods processed."`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" /> Server Download Script
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-slate-400 text-sm mb-3">
          Run this in your server's terminal to download all <strong>{uniqueMods.length} Ready</strong> mods. 
          <br/><span className="text-amber-400 text-xs">Note: Ensure you are in an empty folder or your 'mods' folder before running.</span>
        </p>
        <div className="bg-slate-950 border border-slate-700 rounded p-3 mb-4 relative group overflow-hidden">
          <pre className="text-xs font-mono text-emerald-400 break-all block max-h-[400px] overflow-y-auto whitespace-pre-wrap">
            {script}
          </pre>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => copyToClipboard(script)}>
            <Copy className="w-4 h-4" /> Copy Script
          </Button>
        </div>
      </div>
    </div>
  );
};

// Improved High-Contrast Note Component
const NoteInput = ({ initialValue, onSave }) => {
  const [value, setValue] = useState(initialValue || '');
  const [saved, setSaved] = useState(true);

  const handleChange = (e) => {
    setValue(e.target.value);
    setSaved(false);
  };

  const handleBlur = () => {
    if (value !== initialValue) {
      onSave(value);
      setSaved(true);
    }
  };

  return (
    <div className="mt-3 bg-slate-950 border-l-2 border-yellow-500 rounded-r-md p-2 relative group transition-all hover:bg-slate-900">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {saved ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Save className="w-3 h-3 text-amber-500 animate-pulse" />}
        </div>
        <div className="flex items-start gap-2">
            <FileText className="w-3 h-3 text-yellow-500 mt-1 shrink-0" />
            <textarea
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Add a note..."
                className="w-full bg-transparent border-none text-xs text-slate-200 placeholder:text-slate-600 focus:ring-0 p-0 resize-none h-auto min-h-[1.5em]"
                rows={1}
                style={{ fieldSizing: 'content' }}
            />
        </div>
    </div>
  );
};

// --- In-Card Dependency Section ---
const DependencySection = ({ mod, allMods, onAdd, onEdit }) => {
    const [resolvedDeps, setResolvedDeps] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!mod.dependencies || mod.dependencies.length === 0) {
            setResolvedDeps([]);
            setIsLoading(false);
            return;
        }

        const required = mod.dependencies.filter(d => d.dependency_type === 'required');
        
        if (required.length === 0) {
            setResolvedDeps([]);
            setIsLoading(false);
            return;
        }

        const resolve = async () => {
           setIsLoading(true);
           const results = await Promise.all(required.map(async (dep) => {
              // 1. Check if already installed (Local Lookup)
              const localMod = allMods.find(m => m.id === dep.project_id);
              if (localMod) {
                 return { 
                     ...dep, 
                     status: 'installed', 
                     title: localMod.title, 
                     slug: localMod.slug,
                     modData: localMod
                 };
              }
              
              // 2. If missing, Fetch Info
              const info = await resolveDependencyName(dep.project_id);
              return { 
                 ...dep, 
                 status: 'missing', 
                 title: info ? info.title : 'Unknown Dependency', 
                 slug: info ? info.slug : null 
              };
           }));
           setResolvedDeps(results);
           setIsLoading(false);
        };
        
        resolve();
    }, [mod.dependencies, allMods]);

    if (isLoading) return null; 
    if (resolvedDeps.length === 0) return null;

    return (
        <div className="mt-4 pt-3 border-t border-slate-700/50">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Dependencies
            </h4>
            <div className="flex flex-wrap gap-2">
                {resolvedDeps.map((dep, idx) => (
                    <button 
                        key={`${mod.id}-dep-${idx}`}
                        onClick={(e) => {
                            if(dep.status === 'missing' && dep.slug) onAdd(e, dep.slug);
                            if(dep.status === 'installed' && dep.modData) onEdit(dep.modData.id); // PASS ID ONLY
                        }}
                        disabled={dep.status === 'missing' && !dep.slug}
                        className={`flex items-center gap-2 px-2 py-1 rounded border text-xs transition-all ${
                            dep.status === 'installed' 
                                ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/30 cursor-pointer group' 
                                : 'bg-red-900/10 border-red-900/30 text-red-400 hover:bg-red-900/30'
                        }`}
                    >
                        {dep.status === 'installed' ? (
                            <CheckCircle className="w-3 h-3" />
                        ) : (
                            <AlertTriangle className="w-3 h-3" />
                        )}
                        
                        <span className="font-medium">{dep.title}</span>
                        
                        {dep.status === 'missing' && dep.slug && (
                            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold flex items-center gap-0.5">
                                <Plus className="w-2 h-2" /> ADD
                            </span>
                        )}

                        {dep.status === 'installed' && (
                             <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- Mod Card Component (Extracted for reuse in Modal) ---
const ModCard = ({ mod, allMods, isCheckingUpdates, accessLevel, activeTab, onVersionChange, onApprove, onRemove, onAddDependency, onEditDependency, isModal = false }) => {
    return (
        <Card className={`p-4 transition-colors ${isCheckingUpdates ? 'opacity-70' : 'opacity-100'} ${mod.target_version_number === 'None Found' ? 'border-red-900/30 bg-red-900/5' : 'hover:bg-slate-800/80'}`}>
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            
            {/* Mod Info */}
            <div className="flex items-start gap-4 flex-1">
                {mod.icon_url ? <img src={mod.icon_url} className="w-12 h-12 rounded bg-slate-900 object-cover" /> : <div className="w-12 h-12 rounded bg-slate-900 flex items-center justify-center text-slate-600 font-bold text-lg">{mod.title.charAt(0)}</div>}
                <div>
                <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg text-slate-200">{mod.title}</h3>
                    {mod.target_version_number === 'None Found' ? <Badge color="red">Missing</Badge> : <Badge color="green">Ready</Badge>}
                    <a href={mod.project_url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-emerald-400 transition-colors"><ExternalLink className="w-4 h-4" /></a>
                </div>
                <p className="text-sm text-slate-400 line-clamp-1 max-w-xl">{mod.description}</p>
                
                {/* Wishlist Note Input */}
                {activeTab === 'wishlist' && (
                    <NoteInput initialValue={mod.note} onSave={(val) => {/* Handled by parent for simplicity in extraction, or passed down */}} />
                )}
                </div>
            </div>

            {/* Versions Dropdown - Disabled if User & Active Tab */}
            <div className="flex items-center gap-6 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex flex-col items-end min-w-[140px]">
                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Installed</span>
                    <div className="relative w-full">
                    <select 
                        value={mod.installed_version}
                        onChange={(e) => onVersionChange(mod.id, e.target.value)}
                        disabled={activeTab === 'active' && accessLevel === 'user'} // LOCK FOR USERS
                        className="w-full appearance-none bg-slate-800 border border-slate-600 hover:border-slate-500 text-slate-300 text-sm font-mono py-1 pl-2 pr-6 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {!mod.server_candidates || mod.server_candidates.length === 0 
                        ? <option>No Ver</option> 
                        : [...new Set(mod.server_candidates)].map(v => <option key={v} value={v}>{v}</option>)
                        }
                    </select>
                    {(activeTab !== 'active' || accessLevel === 'admin') && <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-2 pointer-events-none" />}
                    </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                {/* Target Version Display (Read Only) */}
                <div className="flex flex-col items-start min-w-[140px]">
                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase mb-1">Target</span>
                    <div className="flex items-center gap-2 h-[28px]">
                    <span className={`font-mono text-sm font-bold ${mod.target_version_number === 'None Found' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {mod.target_version_number === 'None Found' ? 'Not Ready' : mod.target_version_number}
                    </span>
                    </div>
                </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Approve (Admin + Wishlist only) */}
                {activeTab === 'wishlist' && accessLevel === 'admin' && (
                    <button onClick={() => onApprove(mod)} className="p-2 text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40 rounded transition-colors"><ThumbsUp className="w-5 h-5" /></button>
                )}
                
                {/* Delete (Admin always, User only in Wishlist) */}
                {(accessLevel === 'admin' || activeTab === 'wishlist') && (
                    <button onClick={() => onRemove(mod.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"><Trash2 className="w-5 h-5" /></button>
                )}
            </div>
            </div>

            {/* Dependency Section (Shows BOTH Installed and Missing) */}
            {activeTab === 'active' && !isModal && (
                <DependencySection mod={mod} allMods={allMods} onAdd={onAddDependency} onEdit={onEditDependency} />
            )}
        </Card>
    );
};

// --- Dependency Edit Modal ---
const DependencyModal = ({ mod, allMods, isOpen, onClose, onRemove, ...props }) => {
    if (!isOpen || !mod) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl p-6 shadow-2xl relative">
                 <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                     <Layers className="w-5 h-5 text-emerald-500" /> Dependency Manager
                 </h2>
                 <p className="text-slate-400 text-sm mb-6">
                     You are editing a library mod. This mod is hidden from the main list to keep it clean.
                 </p>
                 
                 <ModCard 
                    mod={mod} 
                    allMods={allMods}
                    isModal={true}
                    onRemove={(id) => {
                         onRemove(id); // Call standard remove
                         onClose(); // Force close modal since item is gone
                    }}
                    {...props}
                 />
             </div>
        </div>
    );
};

// --- Main App ---

export default function ModManager() {
  // --- Auth & Routing State ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); // 'login', 'dashboard', 'create'
  const [accessLevel, setAccessLevel] = useState('guest'); // 'admin', 'user'
  const [serverDocId, setServerDocId] = useState(null);
  const [sessionCodes, setSessionCodes] = useState({ admin: '', user: '' }); // For display to admin
  const [serverName, setServerName] = useState('My Server');
  const [serverIP, setServerIP] = useState('');

  // --- Data State ---
  const [serverVersion, setServerVersion] = useState('1.21.8');
  const [targetVersion, setTargetVersion] = useState('1.21.10');
  const [loader, setLoader] = useState('fabric');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'wishlist'

  const [mods, setMods] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  // --- UI State ---
  const [modInput, setModInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [filter, setFilter] = useState('all'); 
  const [showLibraries, setShowLibraries] = useState(false); // Default HIDDEN
  const [joinCode, setJoinCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false); 
  const [ipCopyFeedback, setIpCopyFeedback] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [editingDependencyId, setEditingDependencyId] = useState(null); // STORES ID NOW

  // --- Creation State ---
  const [newServerName, setNewServerName] = useState('');
  const [newServerIP, setNewServerIP] = useState('');
  
  // --- Local Backup State ---
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null); // {type: 'success' | 'error', message: string}


  // --- Firebase Auth ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Authentication Error:", e);
        setError("Could not sign in. Check console for config errors.");
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- CORE JOIN LOGIC (Reusable) ---
  const attemptJoin = useCallback(async (code) => {
    if (!code || !user) return;
    setLoading(true);
    
    try {
      const q = query(
        collection(db, 'artifacts', storageAppId, 'public', 'data', 'servers')
      );
      
      const querySnapshot = await getDocs(q);
      let foundDoc = null;
      let role = 'guest';
      let foundCodes = { admin: '', user: '' };

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.adminCode === code.trim().toUpperCase()) {
          foundDoc = doc;
          role = 'admin';
          foundCodes = { admin: data.adminCode, user: data.userCode };
        } else if (data.userCode === code.trim().toUpperCase()) {
          foundDoc = doc;
          role = 'user';
          foundCodes = { admin: 'HIDDEN', user: data.userCode };
        }
      });

      if (foundDoc) {
        setServerDocId(foundDoc.id);
        setAccessLevel(role);
        setSessionCodes(foundCodes);
        // SAVE TO LOCAL STORAGE
        localStorage.setItem('modrinth-server-code', code.trim().toUpperCase());
        setView('dashboard');
      } else {
        setError("Invalid Access Code.");
      }

    } catch (err) {
      console.error(err);
      setError("Failed to join. Connection error.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // --- Auto-Login Effect ---
  useEffect(() => {
    if (!user) return;
    if (serverDocId) return;

    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    const storedCode = localStorage.getItem('modrinth-server-code');

    if (urlCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
        attemptJoin(urlCode);
    } else if (storedCode) {
        attemptJoin(storedCode);
    }
  }, [user, serverDocId, attemptJoin]);

  // --- Real-time Listener ---
  useEffect(() => {
    if (!user || !serverDocId) return;

    const docRef = doc(db, 'artifacts', storageAppId, 'public', 'data', 'servers', serverDocId);
    
    setIsSyncing(true);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMods(data.mods || []);
        setWishlist(data.wishlist || []);
        setServerVersion(data.serverVersion || '1.21.8');
        setTargetVersion(data.targetVersion || '1.21.10');
        setServerName(data.serverName || 'My Server');
        setServerIP(data.serverIP || '');
        setIsSyncing(false);
      } else {
        setError("Server deleted or unavailable.");
        localStorage.removeItem('modrinth-server-code');
        setView('login');
      }
    }, (err) => {
      console.error("Sync error:", err);
      if (err.code === 'permission-denied') {
         setError("Permission Denied. Check Firestore Rules.");
      } else {
         setError(`Connection Error: ${err.message}`);
      }
    });

    return () => unsubscribe();
  }, [user, serverDocId]);

  // --- Actions ---

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("Not connected to auth service.");
      return;
    }
    if (!newServerName.trim()) {
        setError("Please provide a Server Name.");
        return;
    }

    setLoading(true);
    setError(null);
    
    const adminCode = generateCode('ADM');
    const userCode = generateCode('USR');
    const newDocId = crypto.randomUUID();

    try {
      const docRef = doc(db, 'artifacts', storageAppId, 'public', 'data', 'servers', newDocId);
      await setDoc(docRef, {
        createdAt: new Date().toISOString(),
        serverName: newServerName.trim(),
        serverIP: newServerIP.trim(),
        adminCode,
        userCode,
        serverVersion: '1.21.8',
        targetVersion: '1.21.10',
        mods: [],
        wishlist: []
      });

      setServerDocId(newDocId);
      setSessionCodes({ admin: adminCode, user: userCode });
      setAccessLevel('admin');
      setServerName(newServerName.trim());
      setServerIP(newServerIP.trim());
      
      localStorage.setItem('modrinth-server-code', adminCode);
      
      setView('dashboard');
    } catch (err) {
      console.error("Creation Error:", err);
      if (err.code === 'permission-denied') {
         setError("Permission Denied. Did you enable Firestore Rules?");
      } else {
         setError(`Failed to create: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualJoin = (e) => {
    e.preventDefault();
    attemptJoin(joinCode);
  };

  const handleLogout = () => {
      localStorage.removeItem('modrinth-server-code');
      setServerDocId(null);
      setAccessLevel('guest');
      setView('login');
      setJoinCode('');
  };

  const saveToServer = async (newMods, newWishlist) => {
    if (!serverDocId) return;
    const docRef = doc(db, 'artifacts', storageAppId, 'public', 'data', 'servers', serverDocId);
    await updateDoc(docRef, {
      mods: newMods || mods,
      wishlist: newWishlist || wishlist,
      lastUpdated: new Date().toISOString()
    });
  };
  
  const saveVersions = async (sVer, tVer) => {
      if (!serverDocId || accessLevel !== 'admin') return;
      const docRef = doc(db, 'artifacts', storageAppId, 'public', 'data', 'servers', serverDocId);
      await updateDoc(docRef, {
          serverVersion: sVer,
          targetVersion: tVer
      });
  }

  const fetchModInfo = async (slug) => {
    const response = await fetch(`${MODRINTH_API_BASE}/project/${slug}`);
    if (!response.ok) throw new Error('Mod not found');
    return await response.json();
  };

  // Improved fetcher to get primary file URL for script
  const fetchModVersions = useCallback(async (slug) => {
    try {
      const query = `?loaders=["${loader}"]&game_versions=${JSON.stringify([serverVersion, targetVersion])}`;
      const response = await fetch(`${MODRINTH_API_BASE}/project/${slug}/version${query}`);
      const versions = await response.json();
      
      // Enhance versions with primary file URL
      return versions.map(v => {
          const primaryFile = v.files.find(f => f.primary) || v.files[0];
          return {
              ...v,
              primary_file_url: primaryFile ? primaryFile.url : null
          };
      });
    } catch (err) { return []; }
  }, [loader, serverVersion, targetVersion]);

  // --- Mod Logic ---

  const handleAddMod = async (e, manualInput = null) => {
    if(e) e.preventDefault();
    const inputVal = manualInput || modInput;

    if (!inputVal.trim()) return;
    
    const trimmed = inputVal.trim();
    const match = trimmed.match(/modrinth\.com\/[\w-]+\/([^\/?#\s]+)/);
    const cleanSlug = (match ? match[1] : trimmed).toLowerCase();

    if (mods.some(m => m.slug === cleanSlug)) {
      if (!manualInput) setError("This mod is already installed on the Server.");
      return;
    }

    if (activeTab === 'wishlist' && wishlist.some(m => m.slug === cleanSlug)) {
       if (!manualInput) setError("This mod is already in the Wishlist.");
      return;
    }

    setLoading(true);
    if (!manualInput) setError(null);

    try {
      const info = await fetchModInfo(cleanSlug);
      const allVersions = await fetchModVersions(info.slug);
      const serverCandidates = allVersions.filter(v => v.game_versions.includes(serverVersion));
      const targetCandidates = allVersions.filter(v => v.game_versions.includes(targetVersion));
      const latestServer = serverCandidates.length > 0 ? serverCandidates[0] : null;
      const latestTarget = targetCandidates.length > 0 ? targetCandidates[0] : null;

      const newMod = {
        id: info.id,
        slug: info.slug,
        title: info.title,
        icon_url: info.icon_url,
        description: info.description,
        installed_version: latestServer ? latestServer.version_number : 'Not Installed',
        server_candidates: serverCandidates.map(v => v.version_number),
        target_version_number: latestTarget ? latestTarget.version_number : 'None Found',
        target_file_url: latestTarget ? `https://modrinth.com/mod/${info.slug}/version/${latestTarget.version_number}` : null,
        primary_file_url: latestTarget ? latestTarget.primary_file_url : null,
        // Store dependencies so we can check them later
        dependencies: latestServer ? latestServer.dependencies : [],
        project_url: `https://modrinth.com/mod/${info.slug}`,
        updated_at: new Date().toISOString(),
        status: latestTarget ? 'ready' : 'missing',
        note: '' // For Wishlist
      };

      if (activeTab === 'active') {
        await saveToServer([...mods, newMod], null);
      } else {
        await saveToServer(null, [...wishlist, newMod]);
      }
      setModInput('');
    } catch (err) {
      console.error(err);
      if (!manualInput) setError("Could not find mod. Check slug/url.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMod = async (id) => {
    if (activeTab === 'active') {
      if (accessLevel !== 'admin') return; 
      const filtered = mods.filter(m => m.id !== id);
      await saveToServer(filtered, null);
    } else {
      const filtered = wishlist.filter(m => m.id !== id);
      await saveToServer(null, filtered);
    }
  };

  const handleApproveWishlist = async (mod) => {
     if (accessLevel !== 'admin') return;
     const newWishlist = wishlist.filter(m => m.id !== mod.id);
     
     let newMods = [...mods];
     if (!mods.some(m => m.slug === mod.slug)) {
        // Clear note before moving to active
        const cleanMod = { ...mod, note: undefined };
        newMods.push(cleanMod);
     }
     await saveToServer(newMods, newWishlist);
  };

  const handleUpdateNote = async (modId, newNote) => {
      const updatedWishlist = wishlist.map(m => 
          m.id === modId ? { ...m, note: newNote } : m
      );
      await saveToServer(null, updatedWishlist);
  };

  const handleVersionChange = async (modId, newVersion) => {
    if (activeTab === 'active' && accessLevel !== 'admin') return;

    const list = activeTab === 'active' ? mods : wishlist;
    const updatedList = list.map(mod => {
        if (mod.id === modId) return { ...mod, installed_version: newVersion };
        return mod;
    });

    if (activeTab === 'active') await saveToServer(updatedList, null);
    else await saveToServer(null, updatedList);
  };

  const handleCopyInviteLink = () => {
    const codeToShare = sessionCodes.user; 
    const url = `${window.location.origin}${window.location.pathname}?code=${codeToShare}`;
    const success = copyToClipboard(url);
    if (success) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleCopyIP = () => {
    if (!serverIP) return;
    const success = copyToClipboard(serverIP);
    if (success) {
      setIpCopyFeedback(true);
      setTimeout(() => setIpCopyFeedback(false), 2000);
    }
  };

  // --- Local Backup Handlers ---
  
  const handleExportBackup = () => {
      const data = {
          modManagerVersion: '1.0',
          timestamp: new Date().toISOString(),
          serverName,
          serverIP,
          serverVersion,
          targetVersion,
          mods,
          wishlist
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modrinth_manager_backup_${serverName.replace(/\s/g, '_')}_${new Date().toLocaleDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setImportStatus({type: 'success', message: 'Backup file downloaded.'});
      setTimeout(() => setImportStatus(null), 3000);
  };
  
  const triggerImport = () => {
      if (accessLevel !== 'admin') return; // Safety check
      fileInputRef.current.click();
  };

  const handleImportBackup = (event) => {
      if (accessLevel !== 'admin') {
          setImportStatus({type: 'error', message: 'Permission Denied: Only Admins can import data.'});
          // Reset file input value if possible to allow user to try again if permission changes
          event.target.value = null; 
          return;
      }

      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = JSON.parse(e.target.result);
              
              if (!content.mods || !content.wishlist) {
                  throw new Error("Invalid file structure. Missing mod lists.");
              }
              
              // 1. Update local versions immediately
              setServerVersion(content.serverVersion || '1.21.8');
              setTargetVersion(content.targetVersion || '1.21.10');
              
              // 2. Save the new data to the live Firebase document
              const docRef = doc(db, 'artifacts', storageAppId, 'public', 'data', 'servers', serverDocId);
              await updateDoc(docRef, {
                  serverName: content.serverName || serverName,
                  serverIP: content.serverIP || serverIP,
                  serverVersion: content.serverVersion || serverVersion,
                  targetVersion: content.targetVersion || targetVersion,
                  mods: content.mods,
                  wishlist: content.wishlist,
                  lastUpdated: new Date().toISOString()
              });

              setImportStatus({type: 'success', message: 'Data imported and synced to the server!'});
              setTimeout(() => setImportStatus(null), 4000);
          } catch (error) {
              console.error('Import Error:', error);
              setImportStatus({type: 'error', message: `Import Failed: ${error.message}`});
              setTimeout(() => setImportStatus(null), 4000);
          }
      };
      reader.readAsText(file);
      // Reset file input value to allow re-importing the same file
      event.target.value = null; 
  };


  // --- Bulk Check ---
  const checkAllUpdates = useCallback(async (listToUpdate = mods, tab = 'active') => {
    if (listToUpdate.length === 0) return;
    setCheckingUpdates(true);
    
    const updatedList = await Promise.all(listToUpdate.map(async (mod) => {
      const allVersions = await fetchModVersions(mod.slug);
      
      const serverCandidates = allVersions.filter(v => v.game_versions.includes(serverVersion));
      const targetCandidates = allVersions.filter(v => v.game_versions.includes(targetVersion));
      const latestServer = serverCandidates.length > 0 ? serverCandidates[0] : null;
      const latestTarget = targetCandidates.length > 0 ? targetCandidates[0] : null;
      
      const currentInstalled = mod.installed_version === 'Not Installed' && latestServer 
        ? latestServer.version_number 
        : mod.installed_version;

      // If the installed version is found in our list, grab its specific dependencies
      // This ensures dependency check is accurate to the VERSION, not just the mod
      const versionObj = serverCandidates.find(v => v.version_number === currentInstalled);
      const currentDependencies = versionObj ? versionObj.dependencies : (mod.dependencies || []);

      return {
        ...mod,
        server_candidates: serverCandidates.map(v => v.version_number),
        installed_version: currentInstalled,
        target_version_number: latestTarget ? latestTarget.version_number : 'None Found',
        target_file_url: latestTarget ? `https://modrinth.com/mod/${mod.slug}/version/${latestTarget.version_number}` : null,
        primary_file_url: latestTarget ? latestTarget.primary_file_url : null,
        dependencies: currentDependencies,
        status: latestTarget ? 'ready' : 'missing'
      };
    }));

    if (tab === 'active') await saveToServer(updatedList, null);
    else await saveToServer(null, updatedList);
    
    setCheckingUpdates(false);
  }, [fetchModVersions, serverVersion, targetVersion]);


  // --- Filter Logic for Libraries ---
  // Calculate which mods are dependencies of others
  const activeDependencyIds = new Set();
  if (activeTab === 'active') {
      mods.forEach(m => {
          if (m.dependencies) {
              m.dependencies.forEach(d => {
                  if (d.dependency_type === 'required') {
                      activeDependencyIds.add(d.project_id);
                  }
              });
          }
      });
  }

  // --- Compute the Active Modal Mod LIVE from the List ---
  // This fixes the sync issue. Instead of passing a stale object, we lookup the fresh object.
  const activeEditingMod = editingDependencyId 
      ? (activeTab === 'active' ? mods : wishlist).find(m => m.id === editingDependencyId)
      : null;


  // --- Views ---

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-200 font-sans">
        <style>{`
          html, body {
            background-color: #0f172a; /* Force dark background */
          }
        `}</style>
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="inline-flex p-4 bg-emerald-600 rounded-2xl shadow-2xl shadow-emerald-900/50 mb-4">
               <Package className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Fabric Mod Manager</h1>
            <p className="text-slate-400">Sync your server modpack with friends in real-time.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <form onSubmit={handleManualJoin} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Access Code</label>
                 <input 
                   type="text" 
                   value={joinCode}
                   onChange={(e) => setJoinCode(e.target.value)}
                   placeholder="e.g. ADM-1234"
                   className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-center font-mono text-lg tracking-widest text-white focus:border-emerald-500 focus:outline-none uppercase"
                 />
               </div>
               {error && <p className="text-red-400 text-sm text-center flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</p>}
               
               <Button onClick={handleManualJoin} className="w-full py-3" disabled={loading || !joinCode}>
                 {loading ? 'Connecting...' : 'Join Server'}
               </Button>
            </form>
            
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900 text-slate-600">OR</span></div>
            </div>

            <Button variant="outline" onClick={() => setView('create')} className="w-full py-3 border-dashed text-slate-400 hover:text-white hover:border-emerald-500/50">
               <Plus className="w-4 h-4" /> Create New Server
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-200 font-sans">
        <style>{`
          html, body {
            background-color: #0f172a; /* Force dark background */
          }
        `}</style>
        <div className="max-w-md w-full space-y-8">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-white tracking-tight">Setup Server</h1>
            <p className="text-slate-400 text-sm">Create a shared space for your mods.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl relative">
             <button onClick={() => setView('login')} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
             
             <form onSubmit={handleCreateServer} className="space-y-4">
                <div>
                   <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Server Name</label>
                   <input 
                     type="text" 
                     value={newServerName}
                     onChange={(e) => setNewServerName(e.target.value)}
                     placeholder="e.g. The Boys SMP"
                     className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 focus:border-emerald-500 focus:outline-none"
                     maxLength={30}
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Server IP (Optional)</label>
                   <div className="flex items-center gap-2">
                      <div className="bg-slate-950 px-3 py-3 rounded-l-lg border border-slate-800 border-r-0 text-slate-500">
                         <Globe className="w-4 h-4" />
                      </div>
                      <input 
                        type="text" 
                        value={newServerIP}
                        onChange={(e) => setNewServerIP(e.target.value)}
                        placeholder="e.g. play.myserver.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-r-lg px-4 py-3 text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                   </div>
                </div>

                {error && <p className="text-red-400 text-sm text-center flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</p>}

                <Button onClick={handleCreateServer} className="w-full py-3 mt-4" disabled={loading || !newServerName}>
                   {loading ? 'Creating...' : 'Create Server'}
                </Button>
             </form>
          </div>
        </div>
      </div>
    )
  }

  // --- Dashboard View ---

  const visibleList = activeTab === 'active' ? mods : wishlist;
  const filteredMods = visibleList.filter(mod => {
    // Status Filter
    if (filter === 'ready' && mod.target_version_number === 'None Found') return false;
    if (filter === 'missing' && mod.target_version_number !== 'None Found') return false;
    
    // Library/Dependency Hiding (Only in active tab)
    if (activeTab === 'active' && !showLibraries && activeDependencyIds.has(mod.id)) {
        return false;
    }
    
    return true;
  });

  const totalMods = visibleList.length;
  const readyMods = visibleList.filter(m => m.target_version_number !== 'None Found').length;
  const percentReady = totalMods === 0 ? 0 : Math.round((readyMods / totalMods) * 100);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500/30 pb-20">
      <style>{`
          html, body {
            background-color: #0f172a; /* Force dark background */
          }
      `}</style>
      
      <ScriptModal isOpen={showScriptModal} onClose={() => setShowScriptModal(false)} mods={mods} targetVersion={targetVersion} />
      
      <DependencyModal 
          mod={activeEditingMod} 
          allMods={mods}
          isOpen={!!activeEditingMod} 
          onClose={() => setEditingDependencyId(null)}
          activeTab={activeTab}
          accessLevel={accessLevel}
          isCheckingUpdates={checkingUpdates}
          onVersionChange={handleVersionChange}
          onApprove={handleApproveWishlist}
          onRemove={handleRemoveMod}
          onAddDependency={handleAddMod}
          onEditDependency={setEditingDependencyId}
      />

      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-lg transition-colors" title="Logout & Clear Session">
               <LogOut className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">{serverName}</h1>
                  {isSyncing ? <Wifi className="w-3 h-3 text-emerald-500 animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                </div>
                {/* IP Display */}
                {serverIP && (
                   <div className="flex items-center gap-2 mt-0.5 group cursor-pointer" onClick={handleCopyIP}>
                      <Globe className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-mono text-slate-400 group-hover:text-emerald-400 transition-colors">{serverIP}</span>
                      {ipCopyFeedback ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
                   </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
             {/* Admin Info Panel (Only visible to Admin) */}
             {accessLevel === 'admin' && (
                <div className="hidden md:flex items-center gap-4 mr-4">
                   <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/20 border border-emerald-900/50 rounded">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-emerald-500 font-bold uppercase leading-none">Admin Code</span>
                        <span className="text-xs text-emerald-400 font-mono font-bold tracking-wider leading-none mt-1">{sessionCodes.admin}</span>
                      </div>
                      <Copy className="w-3 h-3 text-emerald-600 cursor-pointer hover:text-emerald-400" onClick={() => copyToClipboard(sessionCodes.admin)} title="Copy Admin Code" />
                   </div>
                   
                   <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/50 border border-slate-800 rounded">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 font-bold uppercase leading-none">User Code</span>
                        <span className="text-xs text-slate-300 font-mono font-bold tracking-wider leading-none mt-1">{sessionCodes.user}</span>
                      </div>
                      <Copy className="w-3 h-3 text-slate-600 cursor-pointer hover:text-white" onClick={() => copyToClipboard(sessionCodes.user)} title="Copy User Code" />
                   </div>
                </div>
             )}

             {/* Version Selectors (Read Only for Users, Edit for Admin) */}
             <div className="flex flex-col items-end group">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">On Server</label>
                <div className="relative">
                  <select 
                    value={serverVersion} 
                    onChange={(e) => { setServerVersion(e.target.value); saveVersions(e.target.value, targetVersion); }}
                    disabled={accessLevel !== 'admin'}
                    className="appearance-none bg-slate-800 border border-slate-600 text-slate-200 font-mono font-bold py-1.5 pl-3 pr-8 rounded text-sm w-32 disabled:opacity-80 disabled:cursor-not-allowed"
                  >
                    {MC_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {accessLevel === 'admin' && <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-2 pointer-events-none" />}
                </div>
             </div>

            <ArrowRight className="w-5 h-5 text-slate-600 mt-5 hidden md:block" />

             <div className="flex flex-col items-end group">
                <label className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Target</label>
                <div className="relative">
                  <select 
                    value={targetVersion} 
                    onChange={(e) => { setTargetVersion(e.target.value); saveVersions(serverVersion, e.target.value); }}
                    disabled={accessLevel !== 'admin'}
                    className="appearance-none bg-slate-900 border border-emerald-500/30 text-emerald-400 font-mono font-bold py-1.5 pl-3 pr-8 rounded text-sm w-32 disabled:opacity-80 disabled:cursor-not-allowed"
                  >
                    {MC_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {accessLevel === 'admin' && <ChevronDown className="w-4 h-4 text-emerald-500 absolute right-2 top-2 pointer-events-none" />}
                </div>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* List Toggles */}
        <div className="flex justify-center">
           <div className="bg-slate-800 p-1 rounded-lg inline-flex">
              <button 
                onClick={() => setActiveTab('active')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Server Mods ({mods.length})
              </button>
              <button 
                onClick={() => setActiveTab('wishlist')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'wishlist' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Wishlist ({wishlist.length})
              </button>
           </div>
        </div>

        {/* Dashboard Status */}
        {totalMods > 0 && activeTab === 'active' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg relative overflow-hidden">
             {/* Progress bar content same as before */}
             <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 gap-4">
               <div>
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                   <Target className="w-5 h-5 text-emerald-400" />
                   Migration Target: <span className="font-mono text-emerald-400">{targetVersion}</span>
                 </h2>
                 <p className="text-slate-400 text-sm mt-1">
                   {readyMods === totalMods 
                     ? "All mods are ready for the target version." 
                     : `Waiting on ${totalMods - readyMods} mods.`}
                 </p>
               </div>
               <div className="text-right">
                 <div className="text-3xl font-bold font-mono text-white">{percentReady}%</div>
               </div>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-4 mb-2 overflow-hidden border border-slate-700">
              <div className={`h-full transition-all duration-1000 ease-out ${readyMods === totalMods ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${percentReady}%` }}></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Add Mod Form */}
          <Card className="md:col-span-2 p-5">
             {/* Disable Add to Server if User, Allow Add to Wishlist always */}
             {(activeTab === 'active' && accessLevel === 'user') ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500 py-4">
                    <Lock className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Only Admins can add directly to Server List.</p>
                    <p className="text-xs">Switch to Wishlist to make a request.</p>
                 </div>
             ) : (
                <>
                  <h2 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${activeTab === 'active' ? 'text-emerald-400' : 'text-purple-400'}`}>
                    <Plus className="w-4 h-4" /> Add to {activeTab === 'active' ? 'Server' : 'Wishlist'}
                  </h2>
                  <form onSubmit={handleAddMod} className="flex gap-3">
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        value={modInput}
                        onChange={(e) => setModInput(e.target.value)}
                        placeholder="Paste Modrinth URL or Enter Slug"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                      />
                      {error && <div className="absolute -bottom-6 left-0 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
                    </div>
                    <Button type="submit" disabled={loading || !modInput} variant={activeTab === 'active' ? 'primary' : 'purple'}>
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                    </Button>
                  </form>
                </>
             )}
          </Card>

          {/* Controls */}
          <Card className="p-5 flex flex-col">
             <div className="mb-4">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Actions</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleCopyInviteLink} className="text-xs py-2">
                    {copyFeedback ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <LinkIcon className="w-3 h-3" />}
                    {copyFeedback ? 'Copied Link!' : 'Copy Invite Link'}
                  </Button>
                  
                  {/* Admin Only Download Script */}
                  {accessLevel === 'admin' && activeTab === 'active' && (
                     <Button variant="outline" onClick={() => setShowScriptModal(true)} className="text-xs py-2">
                         <Terminal className="w-3 h-3" /> Get Download Script
                     </Button>
                  )}
                  
                  {/* Export (Available to ALL users) */}
                  <Button variant="outline" onClick={handleExportBackup} className="text-xs py-2">
                      <Archive className="w-3 h-3" /> Export Backup
                  </Button>
                  
                  {/* Import (Available only to ADMIN) */}
                  {accessLevel === 'admin' && (
                   <Button variant="outline" onClick={triggerImport} className="text-xs py-2">
                       <FolderOpen className="w-3 h-3" /> Import Backup
                       <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImportBackup} 
                            style={{ display: 'none' }}
                            accept=".json"
                       />
                   </Button>
                  )}
                   
                   {importStatus && (
                      <div className={`col-span-full text-xs font-medium px-2 py-1 rounded text-center ${importStatus.type === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                          {importStatus.message}
                      </div>
                   )}
               </div>
             </div>
             <Button variant="secondary" onClick={() => checkAllUpdates(activeTab === 'active' ? mods : wishlist, activeTab)} disabled={checkingUpdates || totalMods === 0} className="w-full mt-auto">
               <RefreshCw className={`w-4 h-4 ${checkingUpdates ? 'animate-spin' : ''}`} />
               {checkingUpdates ? 'Checking...' : 'Force Refresh'}
             </Button>
          </Card>
        </div>

        {/* Mods List */}
        <div className="space-y-4">
          {/* Filters & Headers (Same as before) */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium text-white">
                  {activeTab === 'active' ? 'Active Server Mods' : 'Requested Mods'}
              </h2>
              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${filter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>All</button>
                <button onClick={() => setFilter('ready')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${filter === 'ready' ? 'bg-emerald-900/50 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Ready</button>
                <button onClick={() => setFilter('missing')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${filter === 'missing' ? 'bg-amber-900/50 text-amber-400' : 'text-slate-400 hover:text-white'}`}>Missing</button>
              </div>
            </div>
            
            {/* Show Libraries Toggle (Only active tab) */}
            {activeTab === 'active' && (
                <button 
                    onClick={() => setShowLibraries(!showLibraries)} 
                    className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-white transition-colors px-3 py-1 rounded-md hover:bg-slate-800"
                >
                    {showLibraries ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3" />}
                    {showLibraries ? 'Hide Libraries' : 'Show Libraries'}
                </button>
            )}
          </div>

          {totalMods === 0 ? (
             <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
               <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
               <h3 className="text-slate-300 font-medium">List is empty</h3>
             </div>
          ) : (
            <div className="space-y-3">
              {filteredMods.map((mod) => (
                <ModCard 
                    key={mod.id}
                    mod={mod}
                    allMods={mods}
                    isCheckingUpdates={checkingUpdates}
                    accessLevel={accessLevel}
                    activeTab={activeTab}
                    onVersionChange={handleVersionChange}
                    onApprove={handleApproveWishlist}
                    onRemove={handleRemoveMod}
                    onAddDependency={handleAddMod}
                    onEditDependency={setEditingDependencyId}
                />
              ))}
              {filteredMods.length === 0 && totalMods > 0 && (
                  <div className="text-center py-8 bg-slate-900/50 rounded border border-dashed border-slate-800">
                      <p className="text-slate-500 text-sm">
                          {showLibraries ? "No mods match filter." : "Hidden libraries are active. Toggle 'Show Libraries' to see them."}
                      </p>
                  </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
