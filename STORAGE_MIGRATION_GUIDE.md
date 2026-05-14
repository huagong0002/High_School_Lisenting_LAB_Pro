# 音频文件云存储升级指南

## 🎯 升级目标

将原本本地浏览器存储的音频文件迁移到 Supabase Storage，实现：
- ✅ 跨设备同步访问
- ✅ 数据安全备份
- ✅ 存储空间管理
- ✅ 更好的播放性能

---

## 📋 已完成的功能

### 1. 后端 API 增强 (`api/index.ts`)

**新增接口：**

#### `GET /api/storage/stats`
- 获取用户存储使用统计
- 参数：`userId`
- 返回：文件列表、总占用空间

#### `POST /api/storage/signed-urls`
- 批量获取预签名 URL
- 用于安全访问私有文件

#### `POST /api/upload-audio` (已增强)
- 支持3次自动重试
- 更好的错误处理
- 返回文件大小信息

#### `DELETE /api/audio`
- 删除云端音频文件

### 2. 前端优化 (`src/App.tsx`)

**新增功能：**

- 📊 **上传进度显示** - 实时显示上传百分比和状态
- 🔄 **自动重试机制** - 上传失败自动重试3次
- 📁 **存储管理界面** - 查看、管理已上传的文件
- 📈 **空间使用统计** - 显示总占用和文件数量
- 🎨 **更好的用户体验** - 本地预览 + 云端上传

---

## 🚀 部署步骤

### 1. 确保 Supabase 配置正确

在 Vercel 或本地环境中设置：

```bash
# 环境变量
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

### 2. 检查 Supabase Storage 配置

确保在 Supabase Dashboard 中：
- ✅ 创建了名为 `audio-files` 的存储桶
- ✅ 配置了 CORS（允许你的域名）
- ✅ 设置了正确的访问权限（public 或 private）

### 3. 数据库表结构

确保 `materials` 表包含字段：
```sql
id (uuid)
user_id (uuid)
title (text)
audio_url (text) - 存储云文件URL
script (text)
segments (jsonb)
last_modified (bigint)
```

### 4. 部署新版本

```bash
# 提交更改
git add .
git commit -m "feat: 音频云存储升级 - 支持跨设备同步"
git push origin master
```

Vercel 将自动部署。

---

## 🔄 迁移现有音频

### 对于已有用户数据：

1. **检查本地存储** - 在浏览器 DevTools > Application > Local Storage 查看 `echomaster_library_shared`
2. **重新上传** - 用户需要重新上传音频文件（第一次使用时）
3. **自动同步** - 上传后会自动保存到云端数据库

### 迁移脚本（可选）：

如果需要批量迁移，参考以下 Node.js 脚本：

```javascript
// migration.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrateAudioFiles(userId, files) {
  for (const file of files) {
    // 上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from('audio-files')
      .upload(`${userId}/${file.name}`, file.data);
    
    // 更新数据库
    if (!error) {
      const { publicUrl } = supabase.storage
        .from('audio-files')
        .getPublicUrl(`${userId}/${file.name}`);
      
      // 更新 material 记录
    }
  }
}
```

---

## 📊 使用指南

### 新用户流程：

1. **注册/登录** - 使用邮箱或用户名登录
2. **创建材料** - 点击「新建任务」
3. **上传音频** - 选择音频文件，会自动：
   - 显示本地预览（立即播放）
   - 后台上传到云端（显示进度）
   - 更新为云端 URL
4. **自动保存** - 材料自动同步到数据库
5. **存储管理** - 在「存储」页面查看和管理文件

### 跨设备使用：

1. 在设备 A 上传音频
2. 在设备 B 登录同一账号
3. 在「库」页面点击同步按钮
4. 音频文件和材料立即可用

---

## 🔧 故障排查

### 上传失败：

1. 检查网络连接
2. 检查 Supabase Storage 配额
3. 查看浏览器 Console 错误信息

### 无法播放：

1. 检查 `audio_url` 是否正确
2. 检查 Storage 访问权限设置
3. 确认 CORS 配置

### 存储占用过大：

1. 在「存储」页面删除不需要的文件
2. 建议单个音频文件不超过 50MB

---

## 📝 技术细节

### 文件组织：

```
audio-files/
├── user-uuid-1/
│   ├── material-uuid-1/
│   │   └── 1234567890-recording.mp3
│   └── material-uuid-2/
│       └── ...
└── user-uuid-2/
    └── ...
```

### 支持的格式：

- MP3（推荐）
- WAV
- OGG
- M4A

---

## 🎉 完成！

现在您的项目已经支持完整的云端音频存储和跨设备同步！

有问题请查看：
- Vercel 日志（服务器端错误）
- 浏览器 Console（前端错误）
- Supabase Dashboard（存储状态）
