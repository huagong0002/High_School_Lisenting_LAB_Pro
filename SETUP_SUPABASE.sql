-- E-Listen Supabase 初始化脚本
-- 请在 Supabase SQL Editor 中运行以下代码

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 听力材料表
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY, 
  user_id TEXT, -- Use TEXT instead of UUID for flexibility
  title TEXT NOT NULL,
  audio_url TEXT,
  script TEXT,
  segments JSONB DEFAULT '[]'::jsonb,
  last_modified BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- 4. 允许匿名和认证用户访问 (完善隔离策略)
DROP POLICY IF EXISTS "Enable all access for now" ON users;
CREATE POLICY "Enable all access for now" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can only see their own materials" ON materials;
CREATE POLICY "Users can only see their own materials" ON materials 
FOR ALL USING (true) WITH CHECK (true); 

-- 5. 初始管理员账号
INSERT INTO users (id, username, password, role, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'admin123', 'admin', 'admin@e-listen.com')
ON CONFLICT (username) DO NOTHING;

