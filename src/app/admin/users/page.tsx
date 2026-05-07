'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type UserRole = 'USER' | 'ADMIN';

interface ManagedUser {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
  _count: {
    folders: number;
    markdownFiles: number;
  };
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roleDraft, setRoleDraft] = useState<Record<string, UserRole>>({});
  const [passwordDraft, setPasswordDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '加载用户失败');
        return;
      }

      setUsers(data);
      const nextDraft: Record<string, UserRole> = {};
      for (const user of data) {
        nextDraft[user.id] = user.role;
      }
      setRoleDraft(nextDraft);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    if (status === 'authenticated' && session.user.role === 'ADMIN') {
      loadUsers();
    }
  }, [status, session, router, loadUsers]);

  const handleUpdateRole = async (id: string) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleDraft[id] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '更新角色失败');
        return;
      }

      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: data.role } : u)));
      setMessage('角色更新成功');
    } catch {
      setError('网络错误，请稍后重试');
    }
  };

  const handleResetPassword = async (id: string) => {
    const newPassword = passwordDraft[id] || '';
    if (newPassword.length < 6) {
      setError('重置密码至少6个字符');
      return;
    }

    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '重置密码失败');
        return;
      }

      setPasswordDraft((prev) => ({ ...prev, [id]: '' }));
      setMessage(`已重置用户 ${data.username} 的密码`);
    } catch {
      setError('网络错误，请稍后重试');
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`确定删除用户 ${username} 吗？`)) {
      return;
    }

    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '删除用户失败');
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== id));
      setMessage('用户删除成功');
    } catch {
      setError('网络错误，请稍后重试');
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword) {
      setError('请输入用户名和密码');
      return;
    }

    if (newUsername.trim().length < 3) {
      setError('用户名至少3个字符');
      return;
    }

    if (newPassword.length < 6) {
      setError('密码至少6个字符');
      return;
    }

    setCreating(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '创建用户失败');
        return;
      }

      setNewUsername('');
      setNewPassword('');
      setNewRole('USER');
      setMessage(`用户 ${data.username} 创建成功`);
      await loadUsers();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setCreating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理员可修改角色、重置密码与删除用户</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            返回仪表盘
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}
        {message && (
          <div className="mb-4 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{message}</div>
        )}

        <div className="bg-white rounded-xl border p-4 md:p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">添加用户</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="border rounded-md px-3 py-2.5"
              placeholder="用户名(至少3位)"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="border rounded-md px-3 py-2.5"
              placeholder="密码(至少6位)"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="border rounded-md px-3 py-2.5"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              onClick={handleCreateUser}
              disabled={creating}
              className="px-3 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? '创建中...' : '添加用户'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">用户名</th>
                  <th className="text-left px-4 py-3">角色</th>
                  <th className="text-left px-4 py-3">文件夹</th>
                  <th className="text-left px-4 py-3">文件</th>
                  <th className="text-left px-4 py-3">创建时间</th>
                  <th className="text-left px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t align-top">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.username}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={roleDraft[user.id] || user.role}
                          onChange={(e) =>
                            setRoleDraft((prev) => ({ ...prev, [user.id]: e.target.value as UserRole }))
                          }
                          className="border rounded-md px-2 py-1"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole(user.id)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          保存角色
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{user._count.folders}</td>
                    <td className="px-4 py-3 text-gray-700">{user._count.markdownFiles}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(user.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 min-w-56">
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={passwordDraft[user.id] || ''}
                            onChange={(e) =>
                              setPasswordDraft((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }
                            className="border rounded-md px-2 py-1 flex-1"
                            placeholder="新密码(至少6位)"
                          />
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            重置
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          删除用户
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{user.username}</p>
                  <p className="text-xs text-gray-500">{new Date(user.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{user.role}</span>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                文件夹 {user._count.folders} · 文件 {user._count.markdownFiles}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={roleDraft[user.id] || user.role}
                    onChange={(e) =>
                      setRoleDraft((prev) => ({ ...prev, [user.id]: e.target.value as UserRole }))
                    }
                    className="border rounded-md px-2 py-2 flex-1"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    onClick={() => handleUpdateRole(user.id)}
                    className="px-3 py-2 text-xs bg-blue-600 text-white rounded"
                  >
                    保存角色
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={passwordDraft[user.id] || ''}
                    onChange={(e) =>
                      setPasswordDraft((prev) => ({ ...prev, [user.id]: e.target.value }))
                    }
                    className="border rounded-md px-3 py-2 flex-1"
                    placeholder="新密码(至少6位)"
                  />
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    className="px-3 py-2 text-xs bg-emerald-600 text-white rounded"
                  >
                    重置
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteUser(user.id, user.username)}
                  className="w-full px-3 py-2.5 text-xs bg-red-600 text-white rounded"
                >
                  删除用户
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}