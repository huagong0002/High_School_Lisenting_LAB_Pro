// 自动检测 API 基础路径
const getApiBase = () => {
  if (typeof window === 'undefined') return "";
  const host = window.location.hostname;
  
  // 如果是 localhost 或 AI Studio 环境，使用相对路径
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('.run.app')) {
    return "";
  }

  // 默认使用相对路径，除非明确需要跨域到主域名
  // 这里我们改为默认使用相对路径，以解决 CORS 问题并确保访问的是当前环境的后端
  return ""; 
};

const API_BASE = getApiBase();
// 调试日志，帮助确定当前请求目标
console.log(`[API Config] Target Base: "${API_BASE || 'Relative'}"`);

// Supabase 前端客户端配置（用于直接上传文件，绕过 Vercel 限制）
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://erskfzsqaqlrwvmtwzds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyc2tmenNxYXFscnd2bXR3emRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDYwNzksImV4cCI6MjA5MzM4MjA3OX0.zeI1tFI2nMZi7Dud1qHMl-H2PE27uD1ZMttZS-rbduQ';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // 增加超时时间，支持大文件上传
  fetchOptions: {
    timeout: 300000, // 5分钟超时
  },
  // 存储配置
  storage: {
    retry: {
      maxRetries: 3,
      maxDelay: 5000,
    },
  },
});

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings2, 
  BookOpen, 
  Clock, 
  Plus, 
  Trash2,
  Lock,
  Download,
  Upload,
  FastForward,
  Rewind,
  CheckCircle2,
  ListMusic,
  ArrowRight,
  Save,
  Library,
  Folder,
  FileAudio,
  Calendar,
  ChevronRight,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AudioSegment, ListeningMaterial, User as UserType } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safe ID generation fallback
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails for some reason
    }
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [authForm, setAuthForm] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({ username: '', password: '', email: '' });
  const [authError, setAuthError] = useState<string | null>(null);

  const [mode, setMode] = useState<'library' | 'setup' | 'edit' | 'train' | 'storage'>('library');
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<ListeningMaterial[]>([]);
  const [material, setMaterial] = useState<ListeningMaterial>({
    id: generateId(),
    title: '未命名听力材料',
    audioUrl: null,
    script: '',
    segments: [],
    lastModified: Date.now(),
  });

  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Persistence: Sync library to backend manual trigger
    const syncToBackend = async (dataToSync = materials) => {
    if (!user || !dataToSync) return;
    
    try {
      setLastSaved('同步中...');
      console.log(`[Sync] 开始同步 ${dataToSync.length} 个材料到后端`);
      // 检查每个材料的audioUrl状态
      dataToSync.forEach((m: any, i: number) => {
        console.log(`[Sync] 材料 ${i+1}: ID=${m.id}, audioUrl=${m.audioUrl ? '存在' : '空'}`);
      });
      
      const response = await fetch(`${API_BASE}/api/materials/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: dataToSync, userId: user.id }),
        mode: 'cors',
        credentials: API_BASE ? 'include' : 'same-origin'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[Sync] 同步成功:`, result);
        localStorage.setItem(`echomaster_library_shared`, JSON.stringify(dataToSync));
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        console.error(`[Sync] 同步失败，状态码: ${response.status}`);
        setLastSaved('同步失败');
      }
    } catch (e: any) {
      console.error("[Sync] Backend Sync Error", e);
      setLastSaved('网络异常');
    }
  };

  const fetchLibrary = async () => {
    if (!user) return;
    try {
      setLastSaved('正在同步...');
      console.log(`[Library] 开始从后端获取材料列表...`);
      // 获取所有共享材料（不按用户ID过滤）
      const response = await fetch(`${API_BASE}/api/materials`, {
        mode: 'cors',
        credentials: API_BASE ? 'include' : 'same-origin'
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`[Library] 从后端获取到 ${data?.length || 0} 个材料`);
        if (Array.isArray(data)) {
          // 检查每个材料的audioUrl状态
          data.forEach((m: any, index: number) => {
            console.log(`[Library] 材料 ${index + 1}: ID=${m.id}, 标题=${m.title}, audioUrl=${m.audioUrl ? '存在' : '空'}`);
          });
          setMaterials(data);
          setLastSaved(new Date().toLocaleTimeString());
        }
      } else {
        console.error(`[Library] 获取材料失败，状态码: ${response.status}`);
      }
    } catch (e: any) {
      console.error("[Library] Backend Library Refresh Error", e);
      setLastSaved('同步失败');
      const savedLibrary = localStorage.getItem(`echomaster_library_shared`);
      if (savedLibrary) {
        const localData = JSON.parse(savedLibrary);
        console.log(`[Library] 从本地存储恢复 ${localData?.length || 0} 个材料`);
        setMaterials(localData);
      }
    }
  };

  // Persistence: Load library from backend on mount or user change
  useEffect(() => {
    if (!user) {
      setMaterials([]);
      return;
    }
    console.log(`[Library] 用户登录，开始加载材料库，用户ID: ${user.id}`);
    fetchLibrary();
  }, [user]);

  // Update effect for material selection
  useEffect(() => {
    if (currentMaterialId) {
      const active = materials.find(m => m.id === currentMaterialId);
      // Only update if the object in library is different or contains new data to avoid infinite loops
      if (active && JSON.stringify(active) !== JSON.stringify(material)) {
        setMaterial(active);
      }
      localStorage.setItem('echomaster_current_id', currentMaterialId);
    }
  }, [currentMaterialId, materials]);

  // Debug: Check Backend Health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const checkUrl = `${API_BASE}/api/health`;
        const res = await fetch(checkUrl, { mode: 'cors' });
        if (res.ok) {
          const data = await res.json();
          console.log("Server health data:", data);
        }
      } catch (e) {
        console.error("Server health check FAILED.", e);
      }
    };
    checkHealth();
  }, []);

  const handleImmediateSave = async () => {
    if (!material || !user) return;
    
    // 1. First sync current material to the list
    const updatedMaterials = materials.map(m => 
      m.id === material.id ? { ...material, lastModified: Date.now() } : m
    );
    setMaterials(updatedMaterials);
    
    // 2. Immediately trigger backend sync
    await syncToBackend(updatedMaterials);
  };

  // Persistence: Auto sync library to backend whenever materials change
  useEffect(() => {
    if (!user || materials.length === 0) return;

    // 使用更长的debounce时间（30秒）减少自动同步频率
    // 只在材料数量或内容发生显著变化时触发自动同步
    const timer = setTimeout(() => {
      // 只有当材料数量大于0且至少有一个材料有音频URL时才自动同步
      const hasAudioContent = materials.some(m => m.audioUrl);
      if (hasAudioContent) {
        syncToBackend(materials);
      }
    }, 30000); 
    return () => clearTimeout(timer);
  }, [materials, user]);

  // Sync current material changes back to local materials list
  useEffect(() => {
    if (!material) return;
    
    const timer = setTimeout(() => {
      setMaterials(prev => {
        const index = prev.findIndex(m => m.id === material.id);
        if (index === -1) return prev;
        
        // Only update if content actually changed to avoid redundant re-renders
        const existing = prev[index];
        const { lastModified: _old, ...restExisting } = existing;
        const { lastModified: _new, ...restCurrent } = material;
        
        if (JSON.stringify(restExisting) === JSON.stringify(restCurrent)) {
          return prev;
        }
        
        const newList = [...prev];
        newList[index] = { ...material, lastModified: Date.now() };
        return newList;
      });
      setLastSaved(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearTimeout(timer);
  }, [material]);

  const selectMaterial = (id: string) => {
    setCurrentMaterialId(id);
    setMode('train');
  };

  const createNewMaterial = () => {
    if (!user) return;
    const newMaterial: ListeningMaterial = {
      id: generateId(),
      title: `新听力材料 ${materials.length + 1}`,
      audioUrl: null,
      script: '',
      segments: [],
      lastModified: Date.now(),
      userId: user.id
    };
    setMaterials(prev => [newMaterial, ...prev]);
    setCurrentMaterialId(newMaterial.id);
    setMode('setup');
  };

    // 从 URL 中提取 Supabase Storage 路径的辅助函数
  const extractStoragePathFromUrl = (url: string): string | null => {
    if (!url || !url.includes('supabase')) return null;
    try {
      const match = url.match(/\/audio-files\/(.+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const deleteMaterial = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const targetMaterial = materials.find(m => m.id === id);
    const isOwnerOrAdmin = user?.role === 'admin' || user?.username === 'admin' || targetMaterial?.userId === user?.id;
    if (!isOwnerOrAdmin) {
      alert('权限不足：只有管理员或创建者可以删除此项');
      return;
    }
    if (user && window.confirm('确定要删除这个听力任务吗？（这将同步从云端库中移除）')) {
      try {
        // 1. 如果有云端音频，先删除云端文件
        if (targetMaterial?.audioUrl) {
          const storagePath = extractStoragePathFromUrl(targetMaterial.audioUrl);
          if (storagePath) {
            await fetch(`${API_BASE}/api/audio`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: storagePath }),
              mode: 'cors',
              credentials: API_BASE ? 'include' : 'same-origin'
            });
          }
        }

        // 2. 删除数据库记录
        const response = await fetch(`${API_BASE}/api/materials/${id}?username=${user.username}`, {
          method: 'DELETE',
          mode: 'cors',
          credentials: API_BASE ? 'include' : 'same-origin'
        });
        if (response.ok) {
          setMaterials(prev => prev.filter(m => m.id !== id));
          if (currentMaterialId === id) setCurrentMaterialId(null);
        } else {
          const err = await response.json();
          alert(err.error || '删除失败');
        }
      } catch (e: any) {
        console.error("Delete Error", e);
      }
    }
  };

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [bufferProgress, setBufferProgress] = useState(0); // 缓冲进度 0-100
  
  // 使用ref存储最新的audioUrl，解决闭包问题
  const latestAudioUrlRef = useRef<string | undefined>(material.audioUrl);
  
  // 音频元数据缓存，只缓存时长信息，避免缓存整个音频元素
  const audioMetadataCache = useRef<Map<string, { duration: number; ready: boolean }>>(new Map());
  
  useEffect(() => {
    latestAudioUrlRef.current = material.audioUrl;
  }, [material.audioUrl]);
  
  // 监听audioUrl变化，强制重新加载音频
  useEffect(() => {
    if (audioRef.current && material.audioUrl) {
      console.log(`[Audio] 重新加载音频: ${material.audioUrl}`);
      audioRef.current.pause();
      setIsPlaying(false);
      requestAnimationFrame(() => {
        if (audioRef.current) {
          audioRef.current.load();
        }
      });
    }
  }, [material.audioUrl]);

  // 监听currentMaterialId变化，确保音频正确加载
  useEffect(() => {
    if (currentMaterialId && audioRef.current) {
      const currentMaterial = materials.find(m => m.id === currentMaterialId);
      const audioUrl = currentMaterial?.audioUrl;
      
      console.log(`[Audio] 材料切换 - 材料ID: ${currentMaterialId}`);
      console.log(`[Audio] 当前材料:`, currentMaterial);
      console.log(`[Audio] 音频URL: ${audioUrl}`);
      
      if (audioUrl) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setAudioLoading(true);
        setAudioError(null);
        
        console.log(`[Audio] 加载音频: ${audioUrl}`);
        audioRef.current.src = audioUrl;
        requestAnimationFrame(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.load();
          }
        });
      } else {
        console.warn(`[Audio] 警告: 当前材料没有音频URL，材料ID: ${currentMaterialId}`);
        setAudioError('当前材料没有音频文件');
        setAudioLoading(false);
      }
    }
  }, [currentMaterialId, materials]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const timestamp = Date.now();
    const apiUrl = `${API_BASE}/api/login?t=${timestamp}`;
    console.log(`--- Attempting Login ---`);
    console.log(`Target: ${apiUrl}`);
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          username: authData.username.trim(), 
          password: authData.password 
        }),
        mode: 'cors',
        credentials: API_BASE ? 'include' : 'same-origin'
      });
      
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        console.log('Login Success:', data.user.username);
        setUser(data.user);
        localStorage.setItem('echomaster_user', JSON.stringify(data.user));
      } else {
        // Handle failure cases (JSON error or HTML 404/500)
        let errorMsg = `连接失败 (状态码: ${res.status})`;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await res.json();
            const errDetail = data.error || data.message || data;
            errorMsg = typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail);
          } catch (e) {
            console.error("Failed to parse JSON error", e);
          }
        } else {
          const text = await res.text();
          console.warn('Backend returned non-JSON:', text.substring(0, 100));
          if (res.status === 404) {
            errorMsg = `接口地址未找到 (404)。请确保后端服务在 ${API_BASE || '当前主域名'} 正常运行。`;
          }
        }
        
        setAuthError(errorMsg);
      }
    } catch (err: any) {
      console.error('CRITICAL: Login Network Error', err);
      setAuthError(`网络请求失败: ${err.message || '请检查您的网络连接或后端跨域配置'}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const timestamp = Date.now();
    const apiUrl = `${API_BASE}/api/register?t=${timestamp}`;
    console.log('--- Attempting Register ---');
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          username: authData.username.trim(), 
          password: authData.password 
        }),
        mode: 'cors',
        credentials: API_BASE ? 'include' : 'same-origin'
      });
      
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        console.log('Register Success:', data.user.username);
        setUser(data.user);
        localStorage.setItem('echomaster_user', JSON.stringify(data.user));
      } else {
        let errorMsg = `注册失败 (状态码: ${res.status})`;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await res.json();
            const errDetail = data.error || data.message || data;
            errorMsg = typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail);
          } catch (e) {
            console.error("Failed to parse JSON error", e);
          }
        }
        
        setAuthError(errorMsg);
      }
    } catch (err: any) {
      console.error('CRITICAL: Register Network Error', err);
      setAuthError(`注册异常: ${err.message || '无法连接到服务器'}`);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('echomaster_user');
  };

  // Check for saved user session and server health
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, {
          mode: 'cors',
          credentials: API_BASE ? 'include' : 'same-origin'
        });
        if (res.ok) console.log("Server health check passed");
      } catch (e: any) {
        console.error("Server health check FAILED.", e);
      }
    };
    checkServer();

    const savedUser = localStorage.getItem('echomaster_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("User session restore failed");
      }
    }
  }, []);

  // Restore saved state on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('echomaster_user');
    if (savedUser && !user) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("User session restore failed");
      }
    }
    
    const savedId = localStorage.getItem('echomaster_current_id');
    if (savedId && !currentMaterialId) setCurrentMaterialId(savedId);
    
    // Handle visibility change to refresh UI
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[App] 页面隐藏');
      } else {
        console.log('[App] 页面显示');
        // 页面重新显示时，强制触发一次重渲染
        if (user) {
          fetchLibrary();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);

  // 权限检查：只有管理员或创建者可以编辑
  const canEdit = useMemo(() => {
    if (!user || !material) return false;
    // 管理员始终有权
    if (user.username === 'admin' || user.role === 'admin') return true;
    // 任务创建者有权
    return material.userId === user.id;
  }, [user, material]);

  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number>(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { progress: number; status: 'uploading' | 'success' | 'error' } }>({});
  const [storageStats, setStorageStats] = useState<any>(null);

  // 获取存储使用统计（共享模式，显示所有用户的文件）
  const fetchStorageStats = async () => {
    if (!user) return;
    try {
      // 尝试通过后端 API 获取（使用共享模式）
      const response = await fetch(`${API_BASE}/api/storage/stats?userId=${user.id}&shared=true`);
      if (response.ok) {
        const data = await response.json();
        setStorageStats(data);
        return;
      }
    } catch (e) {
      console.warn('Failed to fetch storage stats via API, trying direct Supabase access:', e);
    }
    
    // 备用方案：前端直接从 Supabase Storage 获取所有文件（共享模式）
    try {
      console.log(`[Storage Stats] 尝试直接从 Supabase 获取所有文件（共享模式）`);
      
      const { data: files, error } = await supabaseClient
        .storage
        .from('audio-files')
        .list('');
      
      if (error) {
        console.error('Supabase Storage list error:', error);
        return;
      }
      
      let totalSize = 0;
      const fileList: any[] = [];
      
      if (files && files.length > 0) {
        for (const file of files) {
          if (file.name && file.name.includes('.') && !file.name.startsWith('_')) {
            // 共享模式：显示所有文件
            const size = file.metadata?.size || file.size || 0;
            totalSize += size;
            fileList.push({
              name: file.name,
              size: size,
              createdAt: file.created_at || file.metadata?.created_at,
              path: file.name
            });
          }
        }
      }
      
      setStorageStats({
        success: true,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        fileCount: fileList.length,
        files: fileList
      });
      
      console.log(`[Storage Stats] 直接获取成功: ${fileList.length} 个文件, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
    } catch (e) {
      console.error('Failed to fetch storage stats directly:', e);
    }
  };

  // File Upload Handlers
  // 上传音频到云端（直接上传到 Supabase Storage，无文件大小限制）
  const uploadAudioToCloud = async (file: File, materialId: string, customName?: string): Promise<string | null> => {
    if (!user) {
      console.error('[Upload] 用户未登录');
      return null;
    }
    
    const uploadKey = materialId;
    setUploadProgress(prev => ({ ...prev, [uploadKey]: { progress: 0, status: 'uploading' } }));
    
    // 设置定时器，确保进度至少更新一次
    let progressInterval: ReturnType<typeof setInterval>;
    let lastProgress = 0;
    
    try {
      // 获取文件扩展名
      const ext = file.name.split('.').pop() || 'mp3';
      
      // 使用材料名称或自定义名称作为文件名
      let baseName = customName || material?.title || 'audio';
      console.log(`[Upload] 原始文件名: "${baseName}"`);
      
      // 清理文件名中的特殊字符，只保留 ASCII 字符（防止 Supabase 报错）
      baseName = baseName
        .replace(/[^\x00-\x7F]/g, '_')  // 移除所有非ASCII字符（包括中文）
        .replace(/[^a-zA-Z0-9_-]/g, '_');  // 只保留字母、数字、下划线和连字符
      console.log(`[Upload] 清理后文件名: "${baseName}"`);
      
      // 生成友好的文件名：用户ID_材料ID_时间戳.扩展名
      const simpleUserId = user.id.replace(/-/g, '').slice(0, 8);
      const simpleMaterialId = materialId.replace(/-/g, '').slice(0, 8);
      const timestamp = Date.now();
      // 使用纯ASCII字符文件名，避免Supabase Storage报错
      const safeFileName = `${simpleUserId}_${simpleMaterialId}_${timestamp}.${ext}`;
      
      console.log(`[Upload] 开始上传: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`[Upload] 原始材料名: "${baseName}"`);
      console.log(`[Upload] 存储文件名: ${safeFileName}`);
      
      // 启动进度轮询（防止onUploadProgress不触发）
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[uploadKey];
          if (current && current.status === 'uploading') {
            // 当进度达到90%以上时，自动增加到100%，改善用户体验
            if (current.progress >= 90 && current.progress < 100) {
              return { ...prev, [uploadKey]: { ...current, progress: 100 } };
            } else if (current.progress < 90) {
              // 正常进度增加，但不超过89%
              return { ...prev, [uploadKey]: { ...current, progress: Math.min(current.progress + 2, 89) } };
            }
          }
          return prev;
        });
      }, 1000);
      
      // 直接上传到Supabase Storage（绕过Vercel限制）
      let uploadResult;
      let uploadError;
      const maxRetries = 2;
      let retryCount = 0;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`[Upload] 尝试上传 (第 ${retryCount + 1} 次)`);
          uploadResult = await supabaseClient
            .storage
            .from('audio-files')
            .upload(safeFileName, file, {
              contentType: file.type,
              upsert: true,
              // 上传进度回调 - 优化进度更新
              onUploadProgress: (progress) => {
                const percentage = Math.round((progress.loaded / progress.total) * 100);
                lastProgress = percentage;
                // 只在进度变化时更新，避免频繁重渲染
                setUploadProgress(prev => {
                  const current = prev[uploadKey];
                  if (!current || current.progress !== percentage) {
                    return { ...prev, [uploadKey]: { progress: percentage, status: 'uploading' } };
                  }
                  return prev;
                });
                console.log(`[Upload] 进度: ${percentage}% (${progress.loaded}/${progress.total})`);
              }
            });
          uploadError = uploadResult.error;
          if (!uploadError) break; // 上传成功，退出重试循环
        } catch (e: any) {
          console.error(`[Upload] 上传异常 (第 ${retryCount + 1} 次):`, e);
          uploadError = { name: 'UploadException', message: e.message };
        }
        
        retryCount++;
        if (retryCount <= maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // 指数退避
          console.log(`[Upload] 重试等待 ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // 立即更新进度到100%
      setUploadProgress(prev => ({ ...prev, [uploadKey]: { progress: 100, status: 'uploading' } }));
      clearInterval(progressInterval);
      
      if (uploadError) {
        console.error('[Upload] 上传错误:', uploadError);
        console.error('[Upload] 错误详情:', JSON.stringify(uploadError, null, 2));
        setUploadProgress(prev => ({ ...prev, [uploadKey]: { progress: 0, status: 'error' } }));
        
        let errorMsg = '上传失败';
        if (uploadError.message) {
          if (uploadError.message.includes('CORS') || uploadError.message.includes('cors')) {
            errorMsg = '跨域配置错误，请检查 Supabase CORS 设置';
          } else if (uploadError.message.includes('permission') || uploadError.message.includes('Permission')) {
            errorMsg = '权限不足，请检查存储桶权限设置';
          } else if (uploadError.message.includes('network') || uploadError.message.includes('Network')) {
            errorMsg = '网络连接失败，请检查网络后重试';
          } else if (uploadError.message.includes('Failed to fetch')) {
            errorMsg = '网络请求失败，请检查网络连接或稍后重试';
          } else {
            errorMsg = `上传失败: ${uploadError.message}`;
          }
        }
        alert(errorMsg);
        return null;
      }
      
      console.log('[Upload] 文件上传成功:', uploadResult.data);
      
      // 获取公共访问 URL
      const { data: urlData, error: urlError } = supabaseClient
        .storage
        .from('audio-files')
        .getPublicUrl(safeFileName);
      
      if (urlError) {
        console.error('[Upload] 获取公共URL失败:', urlError);
      }
      
      const publicUrl = urlData?.publicUrl || '';
      
      setUploadProgress(prev => ({ ...prev, [uploadKey]: { progress: 100, status: 'success' } }));
      console.log(`[Upload] 上传成功: ${publicUrl}`);
      
      // 显示上传成功提示
      alert('音频文件上传成功！');
      
      // 刷新存储统计
      setTimeout(fetchStorageStats, 1000);
      
      return publicUrl;
      
    } catch (e: any) {
      clearInterval(progressInterval);
      console.error('[Upload] 异常错误:', e);
      console.error('[Upload] 异常详情:', e.stack);
      setUploadProgress(prev => ({ ...prev, [uploadKey]: { progress: 0, status: 'error' } }));
      alert(`上传失败: ${e.message || '未知错误，请检查控制台日志'}`);
      return null;
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !material) return;
    
    console.log(`[Upload] handleAudioUpload 被调用, material.id: ${material.id}, 当前audioUrl: ${material.audioUrl}`);
    
    // 检查是否正在上传，防止重复上传
    const currentProgress = uploadProgress[material.id];
    if (currentProgress && currentProgress.status === 'uploading') {
      console.warn('[Upload] 正在上传中，跳过重复请求');
      return;
    }

    // 1. 先显示本地预览（提升用户体验）
    const localUrl = URL.createObjectURL(file);
    console.log(`[Upload] 设置本地URL: ${localUrl}`);
    setMaterial(prev => ({ ...prev, audioUrl: localUrl }));

    // 2. 上传到云端（使用材料标题作为文件名）
    const cloudUrl = await uploadAudioToCloud(file, material.id, material.title);
    
    console.log(`[Upload] uploadAudioToCloud 返回: ${cloudUrl}`);
    
    if (cloudUrl) {
      console.log(`[Upload] 更新audioUrl为云端地址: ${cloudUrl}`);
      
      // 3. 更新为云端 URL（使用回调确保状态正确）
      setMaterial(prev => {
        const updated = { ...prev, audioUrl: cloudUrl };
        console.log(`[Upload] 材料audioUrl已更新: ${updated.audioUrl}`);
        return updated;
      });
      
      // 4. 立即保存更新后的材料（使用setMaterials回调获取最新状态）
      const materialId = material.id;
      const materialTitle = material.title;
      const materialScript = material.script;
      const materialSegments = material.segments;
      const userIdValue = user?.id || '';
      
      // 立即保存到材料列表，不延迟
      setMaterials(prevMaterials => {
        const existingIndex = prevMaterials.findIndex(m => m.id === materialId);
        
        let updated: typeof prevMaterials;
        
        if (existingIndex >= 0) {
          updated = prevMaterials.map(m => 
            m.id === materialId ? { ...m, audioUrl: cloudUrl, lastModified: Date.now() } : m
          );
          console.log(`[Upload] 更新现有材料，索引: ${existingIndex}`);
        } else {
          const updatedMaterial: ListeningMaterial = {
            id: materialId,
            title: materialTitle,
            audioUrl: cloudUrl,
            script: materialScript,
            segments: materialSegments,
            lastModified: Date.now(),
            userId: userIdValue
          };
          updated = [...prevMaterials, updatedMaterial];
          console.log(`[Upload] 添加新材料到数组`);
        }
        
        // 立即同步到后端
        syncToBackend(updated);
        return updated;
      });
    } else {
      console.warn('[Upload] 上传失败，保持本地预览');
    }

    if (mode === 'setup') setMode('edit');
  };

  // Playback Control
  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // 尝试播放，添加错误处理
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        console.log(`[Audio] 播放成功`);
      } catch (e) {
        console.error(`[Audio] 播放失败:`, e);
        setAudioError('播放失败，请重试');
      }
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  // Auto-segmentation helper (based on time markers in text like [00:12])
  const extractSegmentsFromScript = () => {
    const script = material.script || '';
    const regex = /\[(\d{1,2}):(\d{2})\]/g;
    const matches = Array.from(script.matchAll(regex));
    if (matches.length === 0) return;

    const newSegments: AudioSegment[] = matches.map((match, index) => {
      const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
      const nextMatch = matches[index + 1];
      const endSec = nextMatch 
        ? parseInt(nextMatch[1]) * 60 + parseInt(nextMatch[2]) 
        : duration || startSec + 30;
      
      // Get text between this timestamp and next
      const startIndex = match.index! + match[0].length;
      const endIndex = nextMatch ? nextMatch.index : script.length;
      const content = script.substring(startIndex, endIndex).trim();

      return {
        id: generateId(),
        label: `题目 ${index + 1}`,
        startTime: startSec,
        endTime: endSec,
        subtitle: content
      };
    });
    setMaterial(prev => ({ ...prev, segments: newSegments }));
  };

  // 1. Clear all segments with a safer implementation
  const clearAllSegments = () => {
    setMaterial(prev => ({
      ...prev,
      segments: []
    }));
    setActiveSegmentIndex(null);
    setCurrentTime(0); // Reset time to start to ensure clean state
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Check for segment changes in training mode
      if (mode === 'train') {
        const currentIdx = material.segments.findIndex(
          seg => audio.currentTime >= seg.startTime && audio.currentTime < seg.endTime
        );
        if (currentIdx !== activeSegmentIndex) {
          setActiveSegmentIndex(currentIdx === -1 ? null : currentIdx);
        }
      }
    };

    const handleLoadedMetadata = () => {
      console.log(`[Audio] 音频元数据加载完成，时长: ${audio.duration}s`);
      setDuration(audio.duration);
      setAudioLoading(false);
      setAudioError(null);
      
      // 更新音频元数据缓存
      if (audio.src) {
        audioMetadataCache.current.set(audio.src, {
          duration: audio.duration,
          ready: true
        });
        console.log(`[Audio] 音频元数据已缓存，URL: ${audio.src}`);
      }
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const errorMsg = target.error?.message || '音频加载失败';
      console.error(`[Audio] 音频加载错误: ${errorMsg}`);
      console.error(`[Audio] 错误码: ${target.error?.code}`);
      console.error(`[Audio] 当前src: ${target.src}`);
      setAudioError(errorMsg);
      setAudioLoading(false);
      // 尝试重新加载
      if (target.src) {
        console.log(`[Audio] 尝试重新加载音频: ${target.src}`);
        target.load();
      }
    };

    const handleAbort = () => {
      console.warn(`[Audio] 音频加载被中止`);
      setAudioLoading(false);
    };
    
    const handleCanPlay = () => {
      console.log(`[Audio] 音频可以播放了`);
      setAudioLoading(false);
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const progress = (bufferedEnd / audio.duration) * 100;
        setBufferProgress(Math.min(progress, 100));
        console.log(`[Audio] 缓冲进度: ${progress.toFixed(1)}%`);
      }
    };

    const handleWaiting = () => {
      console.log(`[Audio] 等待缓冲...`);
      // 播放过程中不显示加载状态，只在初始加载时显示
      // setAudioLoading(true);
    };

    const handleCanPlayThrough = () => {
      console.log(`[Audio] 音频可以流畅播放`);
      setAudioLoading(false);
      setBufferProgress(100);
    };

    const handleStalled = () => {
      console.warn(`[Audio] 音频播放停滞，正在重新缓冲`);
      // 播放过程中不显示加载状态，只在初始加载时显示
      // setAudioLoading(true);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('abort', handleAbort);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('abort', handleAbort);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('stalled', handleStalled);
    };
  }, [material.segments, mode, activeSegmentIndex]);

  // Handle auto-scroll to active segment
  useEffect(() => {
    if (mode === 'train' && syncScroll && activeSegmentIndex !== null && transcriptRef.current) {
      const activeElement = transcriptRef.current.querySelector(`[data-segment-index="${activeSegmentIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex, mode, syncScroll]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const formatTime = (time: number) => {
    return `${Math.floor(time)}s`;
  };

  // Helper to render script with highlighting
  const renderTranscript = (onlyActive: boolean = false) => {
    if (!material || !Array.isArray(material.segments)) return null;

    let items = material.segments.map((seg, idx) => ({
      index: idx,
      text: seg.subtitle || '',
      startTime: seg.startTime,
      endTime: seg.endTime
    }));

    if (onlyActive && activeSegmentIndex !== null && items[activeSegmentIndex]) {
      items = [items[activeSegmentIndex]];
    } else if (onlyActive) {
      items = [];
    }

    if (items.length === 0 || (onlyActive && activeSegmentIndex === null)) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 italic py-10 opacity-40">
          <BookOpen size={48} className="mb-4" />
          <p>{onlyActive ? "点击左侧题目查看脚本" : "暂无分段脚本内容"}</p>
        </div>
      );
    }
    
    return (
      <div className={cn("flex flex-col w-full", onlyActive ? "gap-4" : "gap-12 py-10")}>
        {items.map((item, idx) => {
          const isActive = onlyActive ? true : item.index === activeSegmentIndex;
          const text = item.text || '';
          const duration = item.endTime - item.startTime;
          
          return (
            <motion.div 
              key={`${item.index}-${idx}`}
              data-segment-index={item.index}
              initial={false}
              animate={{ 
                opacity: showSubtitles ? (isActive ? 1 : 0.3) : 0,
                x: isActive ? 4 : 0,
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className={cn(
                "w-full text-left transition-all duration-500",
                onlyActive ? "px-0" : "px-0 py-2",
                isActive ? "text-white" : "text-slate-500"
              )}
            >
              <div className="space-y-2 whitespace-pre-wrap">
                {text.split('\n').map((line, lIdx) => (
                  <div key={lIdx} className="flex flex-wrap gap-x-2 gap-y-1.5">
                    {(line.trim() ? line.split(/\s+/) : []).map((word, wIdx) => {
                      let isWordActive = false;
                      const totalWordsBefore = text.split('\n').slice(0, lIdx).join(' ').split(/\s+/).filter(Boolean).length;
                      
                      if (isActive && duration > 0) {
                        const elapsed = currentTime - item.startTime;
                        // Approximate word progress relative to whole segment text
                        const totalWords = text.split(/\s+/).filter(Boolean).length;
                        const wordTime = (elapsed / duration) * totalWords;
                        isWordActive = (totalWordsBefore + wIdx) <= wordTime;
                      }
                      
                      return (
                        <motion.span
                          key={wIdx}
                          initial={false}
                          animate={{
                            color: isActive && isWordActive ? '#60a5fa' : 'inherit',
                            scale: isActive && isWordActive ? 1.05 : 1,
                          }}
                          className={cn(
                            "text-xl md:text-2xl font-semibold leading-snug",
                            isActive && isWordActive ? "font-bold" : ""
                          )}
                        >
                          {word}
                        </motion.span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/30">
              E
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">EchoMaster Pro</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] mt-1">High School Listening Lab</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <nav className="flex items-center gap-3">
                {lastSaved && (
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter opacity-70">
                    {lastSaved} 已保存
                  </span>
                )}
                {canEdit && (
                  <button 
                    onClick={handleImmediateSave}
                    className="btn-glass p-2.5 rounded-xl text-blue-400 hover:text-white transition-all group"
                    title="立即保存到云端"
                  >
                    <Save size={18} className="group-active:scale-95" />
                  </button>
                )}
                <button 
                  onClick={fetchLibrary}
                  className="btn-glass p-2.5 rounded-xl text-green-400 hover:text-white transition-all group"
                  title="从云端同步更新"
                >
                  <RotateCcw size={18} className="group-active:rotate-180 transition-transform duration-500" />
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1" />
                <button 
                  onClick={() => setMode('setup')}
                  className={cn(
                    "min-w-[80px] px-5 py-3 text-sm font-semibold transition-all duration-300 rounded-xl flex items-center justify-center gap-2",
                    mode === 'setup' ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-[1.02]" : "btn-glass text-slate-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Settings2 size={18} /> 设置
                  {!canEdit && material && <Lock size={12} className="text-amber-500" />}
                </button>
                <button 
                  onClick={() => setMode('library')}
                  className={cn(
                    "min-w-[80px] px-5 py-3 text-sm font-semibold transition-all duration-300 rounded-xl flex items-center justify-center gap-2",
                    mode === 'library' ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-[1.02]" : "btn-glass text-slate-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Library size={18} /> 文库
                </button>
                <button 
                  onClick={() => setMode('edit')}
                  className={cn(
                    "min-w-[80px] px-5 py-3 text-sm font-semibold transition-all duration-300 rounded-xl flex items-center justify-center gap-2",
                    mode === 'edit' ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-[1.02]" : "btn-glass text-slate-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Clock size={18} /> 分段
                  {!canEdit && material && <Lock size={12} className="text-amber-500" />}
                </button>
                <button 
                  onClick={() => setMode('train')}
                  className={cn(
                    "min-w-[80px] px-5 py-3 text-sm font-semibold transition-all duration-300 rounded-xl flex items-center justify-center gap-2",
                    mode === 'train' ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-600/30 scale-[1.02]" : "btn-glass text-slate-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Play size={18} /> 训练
                </button>
                <button 
                  onClick={() => {
                    fetchStorageStats();
                    setMode('storage');
                  }}
                  className={cn(
                    "min-w-[80px] px-5 py-3 text-sm font-semibold transition-all duration-300 rounded-xl flex items-center justify-center gap-2",
                    mode === 'storage' ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-600/30 scale-[1.02]" : "btn-glass text-slate-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Folder size={18} /> 存储
                </button>
              </nav>
            )}

            <div className="w-[1px] h-8 bg-white/10 mx-2 hidden md:block" />

            {user && (
              <div className="flex items-center gap-3 glass px-4 py-2 rounded-2xl border-blue-500/10">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-white tracking-tight">{(user as any).username || (user as any).displayName || user.email || '用户'}</span>
                  <button 
                    onClick={handleLogout}
                    className="text-xs text-red-400 font-semibold uppercase tracking-wider mt-1 hover:text-red-300 hover:underline transition-colors"
                  >
                    登出
                  </button>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 overflow-hidden border border-white/10">
                  {user.role === 'admin' ? <Settings2 size={20} /> : <User size={20} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!user ? (
          <div className="max-w-md mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-[40px] shadow-2xl border-white/10 space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-600/30 mb-4">
                  <BookOpen size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {authForm === 'login' ? '欢迎回来' : '开启听力之旅'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {authForm === 'login' ? '登录您的 E-Listen 账号以管理资源' : '创建一个新的账号来开始您的训练'}
                </p>
              </div>

              <form onSubmit={authForm === 'login' ? handleLogin : handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">用户名</label>
                  <input 
                    type="text" 
                    required
                    value={authData.username}
                    onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">密码</label>
                  <input 
                    type="password" 
                    required
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {authError && (
                  <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg">{authError}</p>
                )}

                <button 
                  type="submit"
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                >
                  {authForm === 'login' ? '立即登录' : '立即注册'}
                </button>
              </form>

              <div className="pt-6 border-t border-white/5 text-center">
                <button 
                  onClick={() => {
                    setAuthForm(authForm === 'login' ? 'register' : 'login');
                    setAuthError(null);
                  }}
                  className="text-xs text-blue-400 font-bold hover:underline"
                >
                  {authForm === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {mode === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white">材料库</h2>
                  <p className="text-slate-400 text-sm mt-1">管理您的所有听力任务和分段配置。</p>
                </div>
                <button 
                  onClick={createNewMaterial}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                >
                  <Plus size={20} /> 新建任务
                </button>
              </div>

              {materials.length === 0 ? (
                <div className="glass p-20 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-slate-500 mb-2">
                    <Folder size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-white">库中暂无材料</h3>
                  <p className="text-slate-400 max-w-xs">点击右上角“新建任务”开始您的第一个英语听力训练。</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.isArray(materials) && materials.map((m) => (
                    <motion.div
                      layout
                      key={m.id}
                      onClick={() => selectMaterial(m.id)}
                      className={cn(
                        "glass group rounded-[32px] p-6 cursor-pointer border-white/5 hover:border-blue-500/50 hover:bg-white/[0.08] transition-all relative overflow-hidden",
                        currentMaterialId === m.id && "ring-2 ring-blue-500/50 border-blue-500/50"
                      )}
                    >
                      <div className="flex flex-col h-full space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
                            m.audioUrl ? "bg-blue-600/20 text-blue-400" : "bg-white/5 text-slate-600"
                          )}>
                            <FileAudio size={24} />
                          </div>
                          {(user?.id === m.userId || user?.role === 'admin' || user?.username === 'admin') && (
                            <button 
                              onClick={(e) => deleteMaterial(e, m.id)}
                              className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10"
                              title="删除任务 (仅创建者或管理员)"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>

                        <div>
                          <input
                            onClick={(e) => e.stopPropagation()}
                            value={m.title}
                            onChange={(e) => {
                              const canEditThis = (user?.id === m.userId || user?.role === 'admin' || user?.username === 'admin');
                              if (!canEditThis) return;
                              const newTitle = e.target.value;
                              setMaterials(prev => prev.map(item => item.id === m.id ? { ...item, title: newTitle, lastModified: Date.now() } : item));
                            }}
                            disabled={!(user?.id === m.userId || user?.role === 'admin' || user?.username === 'admin')}
                            className={cn(
                              "text-lg font-bold bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 -ml-1 w-full transition-colors",
                              (user?.id === m.userId || user?.role === 'admin' || user?.username === 'admin') 
                                ? "text-white hover:bg-white/5 group-hover:text-blue-400 cursor-text" 
                                : "text-slate-500 cursor-default"
                            )}
                          />
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1"><Clock size={12} /> {m.segments.length}个分段</span>
                            <span className="flex items-center gap-1"><Calendar size={12} /> {m.lastModified ? new Date(m.lastModified).toLocaleDateString() : '未知时间'}</span>
                          </div>
                        </div>

                        <div className="pt-4 mt-auto border-t border-white/5 flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] uppercase font-black px-2 py-1 rounded-md tracking-tighter",
                            m.audioUrl && m.segments.length > 0 ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"
                          )}>
                            {m.audioUrl && m.segments.length > 0 ? "就绪" : "待配置"}
                          </span>
                          <ChevronRight size={18} className="text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {mode === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="glass p-10 rounded-[32px] space-y-8 relative">
                {!canEdit && material.id !== 'demo-1' && (
                  <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center rounded-[32px]">
                    <div className="glass p-6 rounded-2xl border-white/20 text-center space-y-3">
                      <Lock size={32} className="mx-auto text-amber-500" />
                      <p className="text-white font-bold">只读模式</p>
                      <p className="text-slate-300 text-xs">您没有修改此材料参数的权限</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white">开始新的听力任务</h2>
                  <p className="text-slate-400 text-sm">上传音频文件并粘贴听力脚本。包含 [00:15] 格式标记可自动分段。</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">材料名称</label>
                    <input 
                      type="text"
                      value={material.title}
                      onChange={(e) => setMaterial(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="例如：2024年期中考试英语听力A"
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">音频文件 (MP3/WAV)</label>
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleAudioUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-white/5 hover:bg-white/10 transition-all group-hover:border-blue-500/50">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                          <ListMusic size={28} />
                        </div>
                        
                        {/* 上传进度显示 */}
                        {uploadProgress[material?.id]?.status === 'uploading' && (
                          <div className="w-full space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-blue-400">上传中...</span>
                              <span className="text-slate-400">{uploadProgress[material?.id]?.progress}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress[material?.id]?.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {uploadProgress[material?.id]?.status === 'error' && (
                          <div className="w-full text-center">
                            <p className="text-red-400 text-sm">上传失败，请重试</p>
                          </div>
                        )}
                        
                        {uploadProgress[material?.id]?.status === 'success' && (
                          <div className="w-full text-center">
                            <p className="text-green-400 text-sm">✅ 上传成功！</p>
                          </div>
                        )}
                        
                        {!uploadProgress[material?.id]?.status && (
                          <span className="text-sm font-medium text-slate-300">
                            {material.audioUrl ? "音频已成功上传 ✅" : "点击或拖拽上传音频"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">使用指南 (给初次使用者的提示)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { step: "1", title: "上传素材", desc: "点击上方框选处上传音频，系统建议使用 MP3 格式。" },
                        { step: "2", title: "标记时间", desc: "在下方粘贴带有 [00:15] 格式时间戳的文本，或直接进入分段模式手动切分。" },
                        { step: "3", title: "配置题目", desc: "进入“分段”菜单，为每个题目微调起始时间并输入对应听力脚本。" },
                        { step: "4", title: "开始训练", desc: "在“训练”模式下，系统将根据配置自动同步高亮脚本，支持语速调节。" }
                      ].map((s) => (
                        <div key={s.step} className="p-5 glass-dark rounded-2xl border-white/5 space-y-2">
                          <div className="w-8 h-8 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center font-bold text-sm">
                            {s.step}
                          </div>
                          <h4 className="text-white font-bold">{s.title}</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <button 
                      disabled={!material.audioUrl}
                      onClick={() => setMode('edit')}
                      className="w-full h-14 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/30"
                    >
                      下一步：配置分段 <ArrowRight size={20} />
                    </button>

                    <button 
                      onClick={() => {
                        setMaterial({
                          id: 'demo-1',
                          title: '2023年高考英语听力模拟训练',
                          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                          script: `### Section A\n\n[00:00] **Question 1**: What is the man going to do this afternoon?\n\n[00:15] **Question 2**: Where does this conversation probably take place?\n\n[00:30] **Question 3**: What is the most likely relationship between the speakers?\n\n---\n\n### Section B\n\n[00:45] Now listen to a conversation about environmental protection...`,
                          segments: [
                            { id: '1', label: '题目 1', startTime: 0, endTime: 15, subtitle: 'Question 1: What is the man going to do this afternoon?' },
                            { id: '2', label: '题目 2', startTime: 15, endTime: 30, subtitle: 'Question 2: Where does this conversation probably take place?' },
                            { id: '3', label: '题目 3', startTime: 30, endTime: 45, subtitle: 'Question 3: What is the most likely relationship between the speakers?' },
                          ],
                          lastModified: Date.now()
                        });
                        setMode('edit');
                      }}
                      className="w-full h-14 btn-glass text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2"
                    >
                      加载演示案例
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'edit' && (
            <motion.div 
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Top: Player Section */}
              <div className="glass p-8 rounded-[40px] border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
                
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Settings2 size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">分段配置与脚本编辑</h2>
                        <input 
                          value={material.title}
                          onChange={(e) => setMaterial(p => ({ ...p, title: e.target.value }))}
                          disabled={!canEdit}
                          className={cn(
                            "text-sm font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0",
                            canEdit ? "text-blue-400" : "text-slate-500"
                          )}
                          placeholder="输入材料标题..."
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                       <button 
                         onClick={clearAllSegments}
                         disabled={!canEdit || material.segments.length === 0}
                         className="px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all uppercase tracking-widest disabled:opacity-30 flex items-center gap-2"
                       >
                         <Trash2 size={12} /> 全部清空
                       </button>
                       <button 
                         onClick={extractSegmentsFromScript}
                         disabled={!canEdit}
                         className="px-4 py-2 text-[10px] font-bold text-blue-400 hover:bg-blue-600/10 border border-blue-500/20 rounded-xl transition-all uppercase tracking-widest disabled:opacity-30 flex items-center gap-2"
                       >
                         <CheckCircle2 size={12} /> 从总脚本提取
                       </button>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-[32px] p-6 border border-white/5 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
                      <div className="space-y-4">
                         <div className="flex justify-between text-[10px] font-mono text-slate-500 tracking-widest">
                           <span className="text-blue-400">{formatTime(currentTime)}</span>
                           <span>{formatTime(duration)}</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" 
                           max={duration} 
                           value={currentTime}
                           onChange={(e) => {
                             if (audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value);
                           }}
                           className="w-full h-3 md:h-4 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500 shadow-sm"
                         />
                      </div>

                    <div className="flex items-center justify-center gap-8 md:gap-12">
                      <button onClick={() => skip(-10)} className="w-14 h-14 rounded-full glass flex items-center justify-center text-slate-500 hover:text-white transition-all"><Rewind size={24} /></button>
                      <button onClick={togglePlay} className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                        {isPlaying ? <Pause size={32} /> : <Play size={32} className="translate-x-1" />}
                      </button>
                      <button onClick={() => skip(10)} className="w-14 h-14 rounded-full glass flex items-center justify-center text-slate-500 hover:text-white transition-all"><FastForward size={24} /></button>
                    </div>

                      <div className="flex items-center gap-4 glass-dark p-3 rounded-2xl border-white/5 min-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">倍速</span>
                          <span className="text-sm font-mono font-bold text-blue-400">{playbackSpeed.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.1"
                          value={playbackSpeed}
                          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                          className="flex-grow h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Split Editor (1:2 ratio) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[600px]">
                {/* Left (1/3): Segment List */}
                <div className="lg:col-span-4 glass rounded-[32px] overflow-hidden flex flex-col border-white/10">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2 tracking-tight">
                      <ListMusic size={18} className="text-blue-500" /> 题目分段 (1/3)
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        disabled={!canEdit}
                        onClick={() => {
                          const segments = material.segments || [];
                          const newSeg = {
                            id: generateId(),
                            label: `题目 ${segments.length + 1}`,
                            startTime: currentTime,
                            endTime: Math.min(currentTime + 5, duration),
                            subtitle: ''
                          };
                          setMaterial(prev => ({ ...prev, segments: [...(prev.segments || []), newSeg] }));
                          setEditingSegmentIndex(segments.length);
                        }}
                        className="w-10 h-10 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {(!material.segments || material.segments.length === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-3">
                        <Clock size={32} />
                        <p className="text-xs font-bold uppercase tracking-widest">暂无分段，请新增</p>
                      </div>
                    ) : (
                      Array.isArray(material.segments) && material.segments.map((seg, idx) => (
                        <div 
                          key={seg.id}
                          onClick={() => setEditingSegmentIndex(idx)}
                          className={cn(
                            "p-4 rounded-2xl cursor-pointer border transition-all relative group",
                            editingSegmentIndex === idx 
                              ? "bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/5" 
                              : "bg-white/5 border-white/5 hover:border-white/10"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                             <span className={cn(
                               "text-xs font-bold",
                               editingSegmentIndex === idx ? "text-white" : "text-slate-400"
                             )}>{seg.label}</span>
                             {canEdit && (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setMaterial(p => {
                                     const remaining = p.segments.filter(s => s.id !== seg.id);
                                     return { ...p, segments: remaining.map((s, i) => ({ ...s, label: `题目 ${i + 1}` })) };
                                   });
                                   if (editingSegmentIndex >= idx) setEditingSegmentIndex(Math.max(0, editingSegmentIndex - 1));
                                 }}
                                 className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md"
                               >
                                 <Trash2 size={14} />
                               </button>
                             )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                             <div className="flex items-center gap-1">
                               <span className="opacity-50">S:</span>
                               <span className="text-blue-400/70">{formatTime(seg.startTime)}</span>
                             </div>
                             <div className="flex items-center gap-1">
                               <span className="opacity-50">E:</span>
                               <span className="text-blue-400/70">{formatTime(seg.endTime)}</span>
                             </div>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (audioRef.current) audioRef.current.currentTime = seg.startTime;
                                 setIsPlaying(true);
                                 audioRef.current?.play();
                               }}
                               className="ml-auto w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500"
                             >
                               <Play size={10} className="translate-x-px" />
                             </button>
                          </div>
                          {editingSegmentIndex === idx && (
                            <motion.div layoutId="active-indicator" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-full" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right (2/3): Script Content Editor */}
                <div className="lg:col-span-8 glass rounded-[32px] overflow-hidden flex flex-col border-white/10">
                  {material.segments[editingSegmentIndex] ? (
                    <>
                      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                          <BookOpen size={20} className="text-blue-400" />
                          <div className="flex flex-col">
                            <h3 className="font-bold text-white tracking-tight">脚本编辑</h3>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">EDITING: {material.segments[editingSegmentIndex].label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2 glass-dark px-3 py-2 rounded-xl border-white/5">
                               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">区间:</span>
                              <input 
                                type="number" 
                                value={Math.floor(material.segments[editingSegmentIndex].startTime)}
                                onChange={(e) => {
                                  const newSegs = [...material.segments];
                                  newSegs[editingSegmentIndex].startTime = parseInt(e.target.value) || 0;
                                  setMaterial(p => ({ ...p, segments: newSegs }));
                                }}
                                disabled={!canEdit}
                                className="w-12 bg-transparent text-xs font-mono text-white text-center focus:outline-none disabled:opacity-50"
                              />
                              <span className="text-slate-700">-</span>
                              <input 
                                type="number" 
                                value={Math.floor(material.segments[editingSegmentIndex].endTime)}
                                onChange={(e) => {
                                  const newSegs = [...material.segments];
                                  newSegs[editingSegmentIndex].endTime = parseInt(e.target.value) || 0;
                                  setMaterial(p => ({ ...p, segments: newSegs }));
                                }}
                                disabled={!canEdit}
                                className="w-12 bg-transparent text-xs font-mono text-white text-center focus:outline-none disabled:opacity-50"
                              />
                              <span className="text-[9px] text-slate-500 font-bold uppercase ml-1">S</span>
                           </div>
                        </div>
                      </div>
                      
                      <div className="flex-grow p-8 bg-black/20 relative">
                        <textarea 
                          value={material.segments[editingSegmentIndex].subtitle || ''}
                          onChange={(e) => {
                            const newSegs = [...material.segments];
                            newSegs[editingSegmentIndex].subtitle = e.target.value;
                            setMaterial(p => ({ ...p, segments: newSegs }));
                          }}
                          disabled={!canEdit}
                          placeholder={canEdit ? "在这里输入对应分段的听力脚本内容..." : "此听力脚本由创建者发布，仅供查阅"}
                          className="w-full h-full bg-transparent border-none text-lg text-slate-200 placeholder:text-slate-700 focus:outline-none focus:ring-0 resize-none leading-relaxed transition-all disabled:opacity-70"
                        />
                        <div className="absolute bottom-6 right-8 opacity-20 pointer-events-none italic text-sm">
                          Markdown 支持加载演示
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-slate-600 space-y-4 p-20 text-center">
                      <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center">
                        <ArrowRight size={32} />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-2">请先选择题目</h4>
                        <p className="text-sm max-w-xs">从左侧题目列表中点击一个题目，即可在这里编辑对应的脚本内容。</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-6 border-t border-white/5 bg-white/[0.01]">
                    <button 
                      onClick={() => setMode('train')}
                      disabled={material.segments.length === 0}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 group"
                    >
                      <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" />
                      保存并开始训练模式
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'train' && (
            <motion.div 
               key="train"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="max-w-7xl mx-auto space-y-8"
            >
              {/* Top: Global Player */}
              <div className="glass p-8 rounded-[40px] border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
                
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em]">Integrated Listening System</span>
                      <h2 className="text-3xl font-black tracking-tighter text-white leading-tight">
                        练习工作台
                      </h2>
                    </div>

                    <div className="flex items-center gap-6 glass-dark p-4 rounded-3xl border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">PLAYBACK SPEED</span>
                        <span className="text-sm font-mono font-bold text-blue-400">{playbackSpeed.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                        className="w-40 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-[32px] p-8 border border-white/5 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-10 items-center">
                      {/* Left info */}
                      <div className="hidden md:flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">CURRENT FOCUS</span>
                        <p className="text-white font-bold truncate">
                          {activeSegmentIndex !== null ? material.segments[activeSegmentIndex].label : "自由浏览中..."}
                        </p>
                        {/* 音频加载状态 */}
                        {audioLoading && (
                          <span className="text-[10px] font-mono text-amber-400">加载中...</span>
                        )}
                        {audioError && (
                          <span className="text-[10px] font-mono text-red-400">{audioError}</span>
                        )}
                      </div>

                      {/* Center Controls */}
                      <div className="flex flex-col items-center gap-6">
                        <div className="flex items-center gap-8">
                          <button onClick={() => skip(-10)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-500 glass hover:text-white transition-all">
                            <Rewind size={24} />
                          </button>
                          <button 
                            onClick={togglePlay} 
                            className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_0_40px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all"
                          >
                            {isPlaying ? <Pause size={32} /> : <Play size={32} className="translate-x-1" />}
                          </button>
                          <button onClick={() => skip(10)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-500 glass hover:text-white transition-all">
                            <FastForward size={24} />
                          </button>
                        </div>

                        <div className="w-full max-w-sm space-y-2">
                          <input 
                             type="range" 
                             min="0" 
                             max={duration} 
                             value={currentTime}
                             onChange={(e) => {
                               if (audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value);
                             }}
                             className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                           />
                           <div className="flex justify-between text-[10px] font-mono font-bold">
                             <span className="text-blue-500">{formatTime(currentTime)}</span>
                             <span className="text-slate-600">{formatTime(duration)}</span>
                           </div>
                        </div>
                      </div>

                      {/* Right decoration */}
                      <div className="hidden md:flex items-center justify-end gap-1 px-4 h-12">
                        {[...Array(12)].map((_, i) => (
                          <motion.div 
                            key={i}
                            animate={{ height: isPlaying ? [10, 30, 15, 40, 20][i % 5] : 4 }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                            className="w-1 bg-blue-500/40 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Splits Display */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left-Bottom: Topic List */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="glass p-6 rounded-[32px] border-white/10 space-y-6 min-h-[400px]">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                      <ListMusic size={16} className="text-blue-500" /> 题目库
                    </h3>
                    <div className="space-y-2 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                      {Array.isArray(material.segments) && material.segments.map((seg, idx) => (
                        <button 
                          key={seg.id}
                          onClick={() => {
                            if (audioRef.current) audioRef.current.currentTime = seg.startTime;
                            setIsPlaying(true);
                            audioRef.current?.play();
                          }}
                          className={cn(
                            "w-full px-5 py-4 rounded-2xl flex items-center justify-between border transition-all text-left text-sm group",
                            activeSegmentIndex === idx 
                              ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg shadow-blue-500/5" 
                              : "bg-white/5 border-white/5 text-slate-400 hover:border-white/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                              activeSegmentIndex === idx ? "bg-blue-500 text-white" : "bg-white/10 text-slate-500"
                            )}>{idx + 1}</span>
                            <span className="font-bold">{seg.label}</span>
                          </div>
                          <span className="text-[10px] font-mono opacity-50">{formatTime(seg.startTime)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right-Bottom: Focused Transcript */}
                <div className="lg:col-span-8">
                  <div className="glass p-8 rounded-[40px] border-white/10 flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <BookOpen size={20} className="text-blue-400" />
                        <h3 className="font-bold text-white">当前题目脚本</h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setShowSubtitles(!showSubtitles)}
                          className={cn(
                            "px-4 py-2 text-[10px] font-bold rounded-xl transition-all border",
                            showSubtitles ? "bg-blue-600 border-blue-500 text-white" : "btn-glass border-white/5 text-slate-500"
                          )}
                        >
                          显示字幕：{showSubtitles ? "开" : "关"}
                        </button>
                        <button 
                          onClick={() => setSyncScroll(!syncScroll)}
                          className={cn(
                            "px-4 py-2 text-[10px] font-bold rounded-xl transition-all border",
                            syncScroll ? "bg-blue-600 border-blue-500 text-white" : "btn-glass border-white/5 text-slate-500"
                          )}
                        >
                          同步滚动：{syncScroll ? "开" : "关"}
                        </button>
                      </div>
                    </div>
                    
                    <div ref={transcriptRef} className="flex-grow overflow-y-auto custom-scrollbar">
                       {renderTranscript(true)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'storage' && (
            <motion.div 
              key="storage"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Storage Stats */}
              <div className="glass p-8 rounded-[40px] border-white/10 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <Folder size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">存储管理</h2>
                      <p className="text-slate-400 text-sm">管理您上传的音频文件和存储空间</p>
                    </div>
                  </div>
                  <button 
                    onClick={fetchStorageStats}
                    className="btn-glass px-6 py-3 rounded-xl flex items-center gap-2 text-sm font-bold"
                  >
                    <RotateCcw size={16} /> 刷新
                  </button>
                </div>

                {storageStats?.success ? (
                  <>
                    {/* Usage Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">总存储空间</div>
                        <div className="text-3xl font-black text-purple-400">{storageStats.totalSizeMB} MB</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">文件总数</div>
                        <div className="text-3xl font-black text-blue-400">{storageStats.fileCount}</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">状态</div>
                        <div className="text-lg font-bold text-green-400">正常</div>
                      </div>
                    </div>

                    {/* File List */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">音频文件列表</h3>
                      {storageStats.files?.length > 0 ? (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                          {storageStats.files.map((file: any, idx: number) => (
                            <div key={idx} className="bg-white/5 rounded-2xl p-5 border border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center text-purple-400">
                                  <FileAudio size={18} />
                                </div>
                                <div>
                                  <div className="font-bold text-white text-sm">{file.name}</div>
                                  <div className="text-xs text-slate-500">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.createdAt ? new Date(file.createdAt).toLocaleString('zh-CN') : '未知'}
                                  </div>
                                </div>
                              </div>
                              <button
                                className="p-2 text-slate-500 hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10"
                                title="删除文件"
                                onClick={async () => {
                                  try {
                                    console.log(`[Delete] 尝试删除文件: ${file.path}`);

                                    // 确认删除
                                    if (!confirm(`确定要删除文件 "${file.name}" 吗？`)) {
                                      return;
                                    }

                                    // 使用后端API删除（后端有service role key权限）
                                    const response = await fetch(`${API_BASE}/api/audio`, {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ path: file.path })
                                    });

                                    const result = await response.json();
                                    console.log(`[Delete] API响应:`, result);

                                    if (!response.ok || result.error) {
                                      console.error('[Delete] API删除失败:', result);
                                      alert(`删除失败: ${result.error || result.message || '未知错误'}`);
                                      return;
                                    }

                                    console.log('[Delete] 删除成功');
                                    fetchStorageStats();
                                    alert('文件删除成功！');
                                  } catch (e) {
                                    console.error('Delete failed', e);
                                    alert('删除失败，请检查控制台日志');
                                  }
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-500">
                          <Folder size={48} className="mx-auto mb-4 opacity-30" />
                          <p>暂无上传的音频文件</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <p>加载存储信息中...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      </main>

      <audio 
        ref={audioRef}
        src={material.audioUrl || undefined}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        autoPlay={false}
        loop={false}
        controls={false}
        disableRemotePlayback
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E5E5;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D4D4D4;
        }
      `}</style>
    </div>
  );
}
