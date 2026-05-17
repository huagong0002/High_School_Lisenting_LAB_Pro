// 模拟材料数据 - 用于本地测试
export const mockMaterials = [
  {
    id: 'mock-material-1',
    title: '2026期中考试听力',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    script: '[00:00] 欢迎来到期中考试听力测试。\n[00:05] 第一部分：短对话。\n[00:10] 请听下面的对话。',
    segments: [
      { id: 'seg-1', startTime: 0, endTime: 5, label: '欢迎语', script: '欢迎来到期中考试听力测试。' },
      { id: 'seg-2', startTime: 5, endTime: 10, label: '第一部分', script: '第一部分：短对话。' },
      { id: 'seg-3', startTime: 10, endTime: 15, label: '提示', script: '请听下面的对话。' },
    ],
    lastModified: Date.now(),
    userId: 'test-user-1',
  },
  {
    id: 'mock-material-2',
    title: '高考英语听力模拟',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    script: '[00:00] 高考英语听力模拟测试。\n[00:08] Section A。\n[00:15] Questions 1-3。',
    segments: [
      { id: 'seg-a', startTime: 0, endTime: 8, label: '开场', script: '高考英语听力模拟测试。' },
      { id: 'seg-b', startTime: 8, endTime: 15, label: 'Section A', script: 'Section A。' },
      { id: 'seg-c', startTime: 15, endTime: 22, label: '题目范围', script: 'Questions 1-3。' },
    ],
    lastModified: Date.now(),
    userId: 'test-user-1',
  },
  {
    id: 'mock-material-3',
    title: '大学英语四级听力',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    script: '[00:00] CET-4 Listening Test。\n[00:06] Directions。\n[00:12] Now listen carefully.',
    segments: [
      { id: 'seg-4a', startTime: 0, endTime: 6, label: '考试名称', script: 'CET-4 Listening Test。' },
      { id: 'seg-4b', startTime: 6, endTime: 12, label: '说明', script: 'Directions。' },
      { id: 'seg-4c', startTime: 12, endTime: 18, label: '提示', script: 'Now listen carefully.' },
    ],
    lastModified: Date.now(),
    userId: 'test-user-1',
  },
];

// 模拟用户数据
export const mockUser = {
  id: 'test-user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
};
