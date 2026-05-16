-- Supabase Storage RLS 策略修复
-- 请在 Supabase SQL Editor 中运行以下代码

-- 1. 确保存储桶存在（公共访问）
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 为 audio-files 存储桶启用 RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. 创建允许所有操作的策略（当前简化版本）
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
CREATE POLICY "Allow all uploads" ON storage.objects
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all reads" ON storage.objects;
CREATE POLICY "Allow all reads" ON storage.objects
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all deletes" ON storage.objects;
CREATE POLICY "Allow all deletes" ON storage.objects
FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow all updates" ON storage.objects;
CREATE POLICY "Allow all updates" ON storage.objects
FOR UPDATE USING (true);

-- 4. 验证策略创建
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects';
