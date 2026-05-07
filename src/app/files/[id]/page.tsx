'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import MarkdownViewer from '@/components/MarkdownViewer';

const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'), { ssr: false });

interface FileData {
  id: string;
  name: string;
  content: string;
  folderId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  folder?: { id: string; name: string; path: string } | null;
  user?: { username: string };
}

export default function FilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(searchParams?.get('mode') === 'edit');
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const backFolderId = searchParams?.get('folderId') || file?.folderId || null;
  const backHref = backFolderId ? `/dashboard?folderId=${backFolderId}` : '/dashboard';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const loadFile = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/${id}`);
      if (res.status === 404) {
        setError('文件不存在');
        return;
      }
      if (!res.ok) {
        setError('加载失败');
        return;
      }
      const data = await res.json();
      setFile(data);
      setEditContent(data.content);
      setEditName(data.name);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFile();
    }
  }, [status, loadFile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, name: editName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFile((prev) => prev ? { ...prev, ...updated } : prev);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除文件 "${file?.name}"？`)) return;
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    router.push(backHref);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-5xl mb-4">❌</p>
          <p className="text-gray-700 text-lg mb-4">{error}</p>
          <button
            onClick={() => router.push(backHref)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  if (!file) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(backHref)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0"
              title="返回"
            >
              ←
            </button>

            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-semibold border-b-2 border-blue-500 focus:outline-none bg-transparent min-w-0"
              />
            ) : (
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{file.name}</h1>
                {file.folder && (
                  <p className="text-xs text-gray-500">{file.folder.path}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(file.content);
                    setEditName(file.name);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : saveSuccess ? '✓ 已保存' : '保存'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-sm text-red-500 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  删除
                </button>
              </>
            )}
          </div>
        </div>

        {/* File meta */}
        {!isEditing && (
          <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-400">
            <span>👤 {file.user?.username}</span>
            <span>📅 {new Date(file.updatedAt).toLocaleString('zh-CN')}</span>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        {isEditing ? (
          <div className="bg-white rounded-xl border overflow-hidden">
            <MarkdownEditor value={editContent} onChange={setEditContent} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-6 md:p-8">
            <MarkdownViewer content={file.content} />
          </div>
        )}
      </main>
    </div>
  );
}
