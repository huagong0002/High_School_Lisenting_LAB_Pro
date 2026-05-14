import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();

// --- 1. Supabase 核心初始化 ---
const supabaseUrl: string = process.env.SUPABASE_URL || '';
const supabaseKey: string = process.env.SUPABASE_KEY || '';

let supabase: SupabaseClient | null = null;

try {
  // 仅在环境便利存在且格式正确时初始化，防止启动崩溃
  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase Client Initialized Successfully');
  } else {
    console.warn('⚠️ Supabase credentials missing or invalid. Check Environment Variables.');
  }
} catch (error) {
  console.error('❌ Supabase Initialization Error:', error);
}

// --- 2. 中间件配置 (Middleware) ---
app.set('trust proxy', true);

// 跨域配置：允许所有来源以便调试，支持凭证
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-JSON']
}));

// 解析 JSON 请求体，设置 50mb 上限以支持大型资料同步
app.use(express.json({ limit: '50mb' }));

// 简易日志记录器
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- 3. 内存备用数据库 (当数据库连接失败或未配置时保证程序不崩) ---
let LOCAL_STORE: Record<string, any[]> = {}; // 用户 ID -> 资料数组
let LOCAL_USERS: any[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin', name: 'Jerry Admin' },
  { id: '2', username: 'test', password: 'password', role: 'user', name: 'Test User' }
];

// --- 4. API 路由定义 ---

/**
 * [GET] 健康检查
 * 用于排查 Vercel 环境变量和数据库连接状态
 */
app.get('/api/health', async (req: Request, res: Response) => {
  let dbStatus = 'Not Attempted';
  if (supabase) {
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    dbStatus = error ? `Error: ${error.message}` : 'Connected';
  }

  res.json({
    status: 'ok',
    supabaseConnected: !!supabase,
    databaseConnection: dbStatus,
    env: {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      nodeEnv: process.env.NODE_ENV
    },
    time: new Date().toISOString()
  });
});

/**
 * [POST] 用户登录
 */
app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

      if (data) {
        const { password: _, ...userWithoutPassword } = data;
        // Map user fields from snake_case to camelCase
        const mappedUser = {
          id: userWithoutPassword.id,
          username: userWithoutPassword.username,
          email: userWithoutPassword.email,
          role: userWithoutPassword.role
        };
        return res.json({ success: true, user: mappedUser });
      }
    }
  } catch (err) {
    console.error('Database Login Error:', err);
  }

  // 备用逻辑：检查本地模拟数据库
  const user = LOCAL_USERS.find(u => u.username === username && u.password === password);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ success: true, user: userWithoutPassword });
  }
  
  res.status(401).json({ error: '用户名或密码错误' });
});

/**
 * [POST] 用户注册
 */
app.post('/api/register', async (req: Request, res: Response) => {
  const { username, password, email } = req.body;
  
  try {
    if (supabase) {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      
      if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      
      // Create new user
      const newUser = {
        id: randomUUID(),
        username,
        password,
        email: email || '',
        role: 'user'
      };
      
      const { data, error } = await supabase
        .from('users')
        .insert(newUser)
        .select()
        .single();
      
      if (data) {
        const { password: _, ...userWithoutPassword } = data;
        const mappedUser = {
          id: userWithoutPassword.id,
          username: userWithoutPassword.username,
          email: userWithoutPassword.email,
          role: userWithoutPassword.role
        };
        return res.json({ success: true, user: mappedUser });
      }
      if (error) throw error;
    } else {
      // Fallback: add to local store
      const newUser = {
        id: randomUUID(),
        username,
        password,
        email: email || '',
        role: 'user'
      };
      LOCAL_USERS.push(newUser);
      const { password: _, ...userWithoutPassword } = newUser;
      return res.json({ success: true, user: userWithoutPassword });
    }
  } catch (err) {
    console.error('Database Register Error:', err);
    return res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

 /**
 * [GET] 获取所有资料库内容
 */
app.get('/api/materials', async (req: Request, res: Response) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('last_modified', { ascending: false });
      
      if (data) {
        // Map database snake_case fields to frontend camelCase
        const mappedData = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          title: item.title,
          audioUrl: item.audio_url,
          script: item.script,
          segments: item.segments,
          lastModified: item.last_modified
        }));
        return res.json(mappedData);
      }
      if (error) throw error;
    }
  } catch (err) {
    console.error('Fetch Materials Error:', err);
  }
  
  // 备用逻辑：返回内存中的所有资料
  res.json(Object.values(LOCAL_STORE).flat().sort((a, b) => b.lastModified - a.lastModified));
});

/**
 * [POST] 同步资料库 (批量 Upsert)
 */
app.post('/api/materials/sync', async (req: Request, res: Response) => {
  const { materials, userId } = req.body;

  if (!userId || !Array.isArray(materials)) {
    return res.status(400).json({ error: '数据格式不正确或缺少用户ID' });
  }

  if (!supabase) {
    return res.status(500).json({ error: '数据库未连接' });
  }

  try {
    // --- 精准映射：前端对象 -> 数据库列名 ---
// api/index.ts 同步接口部分的加固修改
  const records = materials.map((m: any) => ({
    id: m.id,
    user_id: userId,
    title: m.title || 'Untitled',
    audio_url: m.audioUrl || '',
    script: m.script || '',
    segments: Array.isArray(m.segments) ? m.segments : [],
  // 关键：强制转换为字符串，以匹配你修改后的数据库 text 类型
    last_modified: String(m.lastModified || Date.now()) 
  }));

    console.log(`准备同步 ${records.length} 条数据到 Supabase...`);

    // 执行 upsert
    const { data, error } = await supabase
      .from('materials')
      .upsert(records, { onConflict: 'id' });

    if (error) {
      console.error('❌ Supabase 同步详细报错:', error);
      return res.status(400).json({ 
        success: false, 
        error: error.message,
        details: error.details 
      });
    }

    console.log('✅ 数据同步成功');
    res.json({ success: true, count: records.length });

  } catch (err: any) {
    console.error('💥 服务器同步逻辑崩溃:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * [DELETE] 删除资料 (仅限管理员或所有者逻辑可在此扩展)
 */
app.delete('/api/materials/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    if (supabase) {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
    }
  } catch (err) {
    console.error('Delete Error:', err);
  }

  // 备用逻辑：从内存清理
  Object.keys(LOCAL_STORE).forEach(uid => {
    LOCAL_STORE[uid] = LOCAL_STORE[uid].filter(m => m.id !== id);
  });

  res.json({ success: true });
});
/**
 * [POST] 上传音频文件到 Supabase Storage (增强版)
 * 支持进度、压缩、错误重试
 */
app.post('/api/upload-audio', async (req: Request, res: Response) => {
  if (!supabase) {
    return res.status(500).json({ error: '数据库未连接' });
  }
  
  try {
    const { audioData, fileName, contentType, userId, materialId, compress = true } = req.body;
    
    if (!audioData || !fileName || !contentType) {
      return res.status(400).json({ error: '缺少音频数据或文件信息' });
    }
    
    // 生成唯一存储路径
    const safeFileName = `${userId}/${materialId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // 将 base64 转换为 buffer
    let buffer = Buffer.from(audioData, 'base64');
    const originalSize = buffer.length;
    
    console.log(`[Upload] 开始上传: ${fileName}, 原始大小: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
    
    // 上传到 Supabase Storage (重试3次)
    let uploadResult = null;
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error } = await supabase
          .storage
          .from('audio-files')
          .upload(safeFileName, buffer, {
            contentType: contentType,
            upsert: true
          });

        if (!error) {
          uploadResult = data;
          break;
        }
        
        lastError = error;
        console.log(`[Upload] 第 ${attempt} 次尝试失败，2秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!uploadResult || lastError) {
      console.error('Upload Error:', lastError);
      return res.status(500).json({ error: '上传失败', details: lastError?.message });
    }

    // 获取公共访问 URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('audio-files')
      .getPublicUrl(safeFileName);

    const finalSize = buffer.length;
    console.log(`[Upload] 上传成功: ${fileName}, 最终大小: ${(finalSize / 1024 / 1024).toFixed(2)}MB`);

    res.json({ 
      success: true, 
      url: publicUrl,
      path: safeFileName,
      size: finalSize,
      originalSize: originalSize
    });
    
  } catch (err: any) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: '上传失败', message: err.message });
  }
});

/**
 * [GET] 获取用户存储使用统计
 */
app.get('/api/storage/stats', async (req: Request, res: Response) => {
  if (!supabase) {
    return res.status(500).json({ error: '数据库未连接' });
  }
  
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  try {
    // 列出用户目录下的所有文件
    const { data: files, error } = await supabase
      .storage
      .from('audio-files')
      .list(String(userId), {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Storage Stats Error:', error);
      return res.status(500).json({ error: '获取统计失败' });
    }

    // 计算总大小
    let totalSize = 0;
    const fileList = files?.map(file => {
      const size = file.metadata?.size || 0;
      totalSize += size;
      return {
        name: file.name,
        size: size,
        createdAt: file.created_at,
        path: `${userId}/${file.name}`
      };
    }) || [];

    res.json({
      success: true,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      fileCount: fileList.length,
      files: fileList
    });
    
  } catch (err: any) {
    console.error('Storage Stats Error:', err);
    res.status(500).json({ error: '获取统计失败', message: err.message });
  }
});

/**
 * [GET] 批量获取音频文件URL (预签名)
 */
app.post('/api/storage/signed-urls', async (req: Request, res: Response) => {
  if (!supabase) {
    return res.status(500).json({ error: '数据库未连接' });
  }
  
  const { paths } = req.body;
  if (!Array.isArray(paths)) {
    return res.status(400).json({ error: '路径格式不正确' });
  }
  
  try {
    const signedUrls = [];
    
    for (const path of paths) {
      const { data, error } = await supabase
        .storage
        .from('audio-files')
        .createSignedUrl(path, 3600); // 1小时有效期
      
      if (!error && data) {
        signedUrls.push({
          path: path,
          signedUrl: data.signedUrl
        });
      }
    }

    res.json({
      success: true,
      urls: signedUrls
    });
    
  } catch (err: any) {
    console.error('Signed URLs Error:', err);
    res.status(500).json({ error: '获取URL失败', message: err.message });
  }
});

/**
 * [DELETE] 删除音频文件
 */
app.delete('/api/audio', async (req: Request, res: Response) => {
  if (!supabase) {
    return res.status(500).json({ error: '数据库未连接' });
  }

  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: '缺少文件路径' });
    }
    
    const { error } = await supabase
      .storage
      .from('audio-files')
      .remove([path]);

    if (error) {
      console.error('Delete Audio Error:', error);
      return res.status(500).json({ error: '删除失败', details: error.message });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete Audio Error:', err);
    res.status(500).json({ error: err.message });
  }
});
// --- 5. 统一错误处理与导出 ---

// 处理未匹配的 API 路径
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `接口 ${req.originalUrl} 未找到` });
});

// 全局 500 错误捕获
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Critical Server Error:', err);
  res.status(500).json({ 
    error: '服务器内部错误', 
    message: process.env.NODE_ENV === 'development' ? err.message : '请检查服务器日志'
  });
});

// 导出给 Vercel 使用
export default app;
