import { randomUUID } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// --- Supabase 初始化 ---
const supabaseUrl: string = process.env.SUPABASE_URL || '';
const supabaseKey: string = process.env.SUPABASE_KEY || '';

let supabase: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase Client Initialized');
  } else {
    console.warn('⚠️ Supabase credentials missing');
  }
} catch (error) {
  console.error('❌ Supabase Initialization Error:', error);
}

// --- 内存备用存储 ---
let LOCAL_STORE: Record<string, any[]> = {};
let LOCAL_USERS: any[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin', name: 'Jerry Admin' },
];

// --- 工具函数 ---
function parseBody(body: string | Buffer): any {
  try {
    return JSON.parse(typeof body === 'string' ? body : body.toString());
  } catch {
    return {};
  }
}

// --- API 处理函数 ---
async function handleHealth() {
  let dbStatus = 'Not Attempted';
  try {
    if (supabase) {
      const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
      dbStatus = error ? `Error: ${error.message}` : 'Connected';
    }
  } catch (err) {
    dbStatus = `Exception: ${(err as Error).message}`;
  }

  return {
    status: 'ok',
    supabaseConnected: !!supabase,
    databaseConnection: dbStatus,
    env: {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      nodeEnv: process.env.NODE_ENV
    },
    time: new Date().toISOString()
  };
}

async function handleLogin(body: any) {
  const { username, password } = body;
  
  if (!username || !password) {
    return { error: '用户名和密码不能为空' };
  }
  
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
        return { success: true, user: {
          id: String(userWithoutPassword.id),
          username: userWithoutPassword.username,
          email: userWithoutPassword.email,
          role: userWithoutPassword.role || 'user'
        }};
      }
    }
  } catch (err) {
    console.error('Database Login Error:', err);
  }

  const user = LOCAL_USERS.find(u => u.username === username && u.password === password);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
  }
  
  return { error: '用户名或密码错误' };
}

async function handleRegister(body: any) {
  const { username, password, email } = body;
  
  if (!username || !password) {
    return { error: '用户名和密码不能为空' };
  }
  
  if (password.length < 6) {
    return { error: '密码长度至少需要6位' };
  }
  
  try {
    if (supabase) {
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (checkError) {
        console.error('Check User Error:', checkError);
        return { error: '检查用户失败' };
      }

      if (existing) {
        return { error: '用户名已存在' };
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          username,
          password,
          email: email || null,
          role: 'user',
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Insert User Error:', insertError);
        return { error: '注册失败，请重试' };
      }

      if (newUser) {
        const { password: _, ...userWithoutPassword } = newUser;
        return { success: true, user: {
          id: String(userWithoutPassword.id),
          username: userWithoutPassword.username,
          email: userWithoutPassword.email,
          role: userWithoutPassword.role || 'user'
        }};
      }
    }
  } catch (err) {
    console.error('Register Error:', err);
    return { error: '注册失败，请重试' };
  }

  const existingLocal = LOCAL_USERS.find(u => u.username === username);
  if (existingLocal) {
    return { error: '用户名已存在' };
  }

  const newLocalUser = {
    id: String(Date.now()),
    username,
    password,
    email: email || '',
    role: 'user',
    name: username
  };
  LOCAL_USERS.push(newLocalUser);
  
  const { password: _, ...userWithoutPassword } = newLocalUser;
  return { success: true, user: userWithoutPassword };
}

async function handleGetMaterials(query: any) {
  const userId = query.userId;
  
  try {
    if (supabase) {
      let queryBuilder = supabase.from('materials').select('*').order('last_modified', { ascending: false });
      
      if (userId) {
        queryBuilder = queryBuilder.eq('user_id', userId);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Fetch Materials Error:', error);
        return [];
      }
      
      if (data) {
        return data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          title: item.title,
          audioUrl: item.audio_url,
          script: item.script,
          segments: item.segments,
          lastModified: item.last_modified
        }));
      }
    }
  } catch (err) {
    console.error('Fetch Materials Error:', err);
  }
  
  let result = Object.values(LOCAL_STORE).flat();
  if (userId) {
    result = result.filter((m: any) => m.userId === userId);
  }
  return result.sort((a: any, b: any) => b.lastModified - a.lastModified);
}

async function handleSyncMaterials(body: any) {
  const { materials, userId } = body;

  if (!userId || !Array.isArray(materials)) {
    return { error: '数据格式不正确或缺少用户ID' };
  }

  if (!supabase) {
    console.warn('⚠️ Database not connected, using memory fallback');
    try {
      LOCAL_STORE[userId] = materials;
      return { success: true, count: materials.length, storedIn: 'memory' };
    } catch (err) {
      console.error('Memory Storage Error:', err);
      return { error: '内存存储失败' };
    }
  }

  try {
    const records = materials.map((m: any) => ({
      id: m.id,
      user_id: userId,
      title: m.title || 'Untitled',
      audio_url: m.audioUrl || '',
      script: m.script || '',
      segments: Array.isArray(m.segments) ? m.segments : [],
      last_modified: String(m.lastModified || Date.now()) 
    }));

    console.log(`Syncing ${records.length} records...`);

    const { error } = await supabase
      .from('materials')
      .upsert(records, { onConflict: 'id' });

    if (error) {
      console.error('Supabase Sync Error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Sync successful');
    return { success: true, count: records.length };

  } catch (err: any) {
    console.error('Sync Error:', err);
    return { error: err.message };
  }
}

async function handleDeleteMaterial(params: any) {
  const { id } = params;
  
  try {
    if (supabase) {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
    }
  } catch (err) {
    console.error('Delete Error:', err);
  }

  Object.keys(LOCAL_STORE).forEach(uid => {
    LOCAL_STORE[uid] = LOCAL_STORE[uid].filter((m: any) => m.id !== id);
  });

  return { success: true };
}

async function handleDeleteAudio(body: any) {
  const { path } = body;
  
  if (!path) {
    return { error: '缺少文件路径' };
  }
  
  if (!supabase) {
    return { error: '数据库未连接' };
  }
  
  try {
    console.log(`[Delete Audio] 删除文件: ${path}`);
    
    const { error } = await supabase
      .storage
      .from('audio-files')
      .remove([path]);
    
    if (error) {
      console.error('Delete Audio Error:', error);
      return { error: '删除失败', message: error.message };
    }
    
    console.log(`[Delete Audio] 删除成功: ${path}`);
    return { success: true };
    
  } catch (err: any) {
    console.error('Delete Audio Error:', err);
    return { error: '删除失败', message: err.message };
  }
}

async function handleStorageStats(query: any) {
  if (!supabase) {
    console.error('Storage Stats Error: Supabase not connected');
    return { error: '数据库未连接' };
  }
  
  const { userId } = query;
  if (!userId) {
    console.error('Storage Stats Error: Missing userId');
    return { error: '缺少用户ID' };
  }
  
  try {
    console.log(`[Storage Stats] Fetching files for userId: ${userId}`);
    
    const { data: folders, error: foldersError } = await supabase
      .storage
      .from('audio-files')
      .list(String(userId));

    if (foldersError) {
      console.error('Storage Stats Error (list folders):', foldersError);
      return { error: '获取文件列表失败', message: foldersError.message };
    }

    console.log(`[Storage Stats] Found ${folders?.length || 0} folders`);
    
    let totalSize = 0;
    const fileList: any[] = [];

    if (folders && folders.length > 0) {
      for (const folder of folders) {
        if (folder.name && !folder.name.includes('.')) {
          const { data: files, error: filesError } = await supabase
            .storage
            .from('audio-files')
            .list(`${userId}/${folder.name}`);

          if (filesError) {
            console.warn('Storage Stats Warning (list files in folder):', filesError);
            continue;
          }

          for (const file of files || []) {
            const size = file.metadata?.size || file.size || 0;
            totalSize += size;
            fileList.push({
              name: file.name,
              size: size,
              createdAt: file.created_at || file.metadata?.created_at,
              path: `${userId}/${folder.name}/${file.name}`
            });
          }
        }
      }
    }

    console.log(`[Storage Stats] Total files: ${fileList.length}, Total size: ${totalSize} bytes`);

    return {
      success: true,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      fileCount: fileList.length,
      files: fileList
    };
    
  } catch (err: any) {
    console.error('Storage Stats Error:', err);
    return { error: '获取统计失败', message: err.message };
  }
}

// --- Vercel Serverless Function 处理程序 ---
export default async function handler(req: any, res: any) {
  const { method, url, body, query } = req;
  
  console.log(`[${new Date().toISOString()}] ${method} ${url}`);
  
  // 去掉查询参数，只匹配路径
  const path = url.split('?')[0];
  console.log(`[Router] 匹配路径: ${path}`);
  
  let result: any;
  let statusCode = 200;

  try {
    const parsedBody = typeof body === 'string' || Buffer.isBuffer(body) ? parseBody(body) : body;
    
    if (method === 'GET' && path === '/api/health') {
      result = await handleHealth();
    } else if (method === 'POST' && path === '/api/login') {
      result = await handleLogin(parsedBody);
      if (result.error) statusCode = 401;
    } else if (method === 'POST' && path === '/api/register') {
      result = await handleRegister(parsedBody);
      if (result.error) statusCode = 400;
    } else if (method === 'GET' && path.startsWith('/api/materials')) {
      result = await handleGetMaterials(query);
    } else if (method === 'POST' && path === '/api/materials/sync') {
      result = await handleSyncMaterials(parsedBody);
      if (result.error) statusCode = result.error.includes('缺少') ? 400 : 500;
    } else if (method === 'DELETE' && path.startsWith('/api/materials/')) {
      const id = path.split('/')[3];
      result = await handleDeleteMaterial({ id });
    } else if (method === 'DELETE' && path === '/api/audio') {
      result = await handleDeleteAudio(parsedBody);
      if (result.error) statusCode = 400;
    } else if (method === 'GET' && path.startsWith('/api/storage/stats')) {
      result = await handleStorageStats(query);
      if (result.error) statusCode = result.error.includes('缺少') ? 400 : 500;
    } else {
      console.log(`[Router] 未找到匹配路由: ${path}`);
      result = { error: 'Not Found' };
      statusCode = 404;
    }
  } catch (err: any) {
    console.error('Handler Error:', err);
    result = { error: '服务器内部错误', message: err.message };
    statusCode = 500;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  res.status(statusCode).send(JSON.stringify(result));
}
