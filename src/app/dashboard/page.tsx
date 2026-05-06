'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import FileTree, { FolderNode } from '@/components/FileTree';
import UploadModal from '@/components/UploadModal';
import NewFolderModal from '@/components/NewFolderModal';
import NewFileModal from '@/components/NewFileModal';

interface FileItem {
  id: string;
  name: string;
  folderId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

function buildTree(folders: FolderNode[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  folders.forEach((f) => map.set(f.id, { ...f, children: [] }));
  const roots: FolderNode[] = [];
  map.forEach((folder) => {
    if (folder.parentId) {
      const parent = map.get(folder.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(folder);
      } else {
        roots.push(folder);
      }
    } else {
      roots.push(folder);
    }
  });
  return roots;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const loadAllFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders?all=true');
      if (res.ok) {
        const data = await res.json();
        setFolders(buildTree(data));
      }
    } catch {}
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const params = currentFolderId ? `?folderId=${currentFolderId}` : '';
      const res = await fetch(`/api/files${params}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch {}
  }, [currentFolderId]);

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([loadAllFolders(), loadFiles()]).finally(() => setLoading(false));
    }
  }, [status, loadAllFolders, loadFiles]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFiles();
    }
  }, [currentFolderId, status, loadFiles]);

  const handleDeleteFolder = async (id: string) => {
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    await loadAllFolders();
    if (currentFolderId === id) setCurrentFolderId(null);
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('确定删除此文件？')) return;
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    await loadFiles();
  };

  const getCurrentFolderName = () => {
    if (!currentFolderId) return '根目录';
    const find = (nodes: FolderNode[]): string => {
      for (const n of nodes) {
        if (n.id === currentFolderId) return n.name;
        if (n.children) {
          const found = find(n.children);
          if (found) return found;
        }
      }
      return '';
    };
    return find(folders) || '未知文件夹';
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="切换侧边栏"
            >
              ☰
            </button>
            <span className="text-xl font-bold text-gray-900">📝 Kruby</span>
          </div>

          <div className="flex-1 max-w-md mx-4 hidden sm:block">
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">
              👤 {session.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              退出
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden px-4 pb-3">
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } transition-all duration-200 bg-white border-r overflow-y-auto overflow-x-hidden flex-shrink-0`}
        >
          <div className="p-4 min-w-64">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">文件夹</h2>
              <button
                onClick={() => setShowNewFolder(true)}
                className="text-blue-600 hover:text-blue-800 text-xl leading-none"
                title="新建文件夹"
              >
                +
              </button>
            </div>

            <FileTree
              folders={folders}
              files={files}
              currentFolderId={currentFolderId}
              onFolderSelect={setCurrentFolderId}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {/* Breadcrumb & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{getCurrentFolderName()}</h1>
                <p className="text-gray-500 text-sm mt-0.5">{filteredFiles.length} 个文件</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowNewFile(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <span>+</span> 新建文件
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <span>↑</span> 上传文件
                </button>
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  <span>📁</span> 新建文件夹
                </button>
              </div>
            </div>

            {/* File grid */}
            {filteredFiles.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">📂</p>
                <p className="text-gray-500 text-lg mb-2">
                  {searchQuery ? '没有找到匹配的文件' : '此目录为空'}
                </p>
                {!searchQuery && (
                  <p className="text-gray-400 text-sm">点击"新建文件"或"上传文件"开始使用</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white rounded-xl border hover:shadow-md transition-shadow group"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => router.push(`/files/${file.id}`)}
                    >
                      <div className="text-3xl mb-3">📄</div>
                      <h3 className="font-medium text-gray-900 truncate" title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(file.updatedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex border-t">
                      <button
                        onClick={() => router.push(`/files/${file.id}`)}
                        className="flex-1 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-bl-xl"
                      >
                        查看
                      </button>
                      <button
                        onClick={() => router.push(`/files/${file.id}?mode=edit`)}
                        className="flex-1 py-2 text-xs text-green-600 hover:bg-green-50 border-l"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="flex-1 py-2 text-xs text-red-500 hover:bg-red-50 rounded-br-xl border-l"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {showUpload && (
        <UploadModal
          folderId={currentFolderId}
          onClose={() => setShowUpload(false)}
          onSuccess={loadFiles}
        />
      )}
      {showNewFolder && (
        <NewFolderModal
          parentId={currentFolderId}
          onClose={() => setShowNewFolder(false)}
          onSuccess={loadAllFolders}
        />
      )}
      {showNewFile && (
        <NewFileModal
          folderId={currentFolderId}
          onClose={() => setShowNewFile(false)}
          onSuccess={(id) => router.push(`/files/${id}?mode=edit`)}
        />
      )}
    </div>
  );
}
