'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function flattenTree(folders: FolderNode[]): FolderNode[] {
  const result: FolderNode[] = [];
  const visit = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };
  visit(folders);
  return result;
}

function getDescendantIds(folderId: string, folders: FolderNode[]): string[] {
  const result: string[] = [];
  const findChildren = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (node.parentId === folderId) {
        result.push(node.id);
        findChildren(folders.filter((folder) => folder.parentId === node.id));
      }
    }
  };

  findChildren(folders.filter((folder) => folder.parentId === folderId));
  return result;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFolderId = searchParams?.get('folderId') || null;
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [fileMoveTarget, setFileMoveTarget] = useState<string>('ROOT');
  const [folderMoveTarget, setFolderMoveTarget] = useState<string>('ROOT');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const folderId = searchParams?.get('folderId') || null;
    setCurrentFolderId(folderId || null);
  }, [searchParams]);

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
      loadAllFolders().finally(() => setLoading(false));
    }
  }, [status, loadAllFolders]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadFiles();
    }
  }, [currentFolderId, status, loadFiles]);

  useEffect(() => {
    setSelectedFileIds([]);
  }, [currentFolderId, files]);

  const updateFolderSelection = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (folderId) {
      params.set('folderId', folderId);
    } else {
      params.delete('folderId');
    }
    router.replace(params.toString() ? `/dashboard?${params.toString()}` : '/dashboard');
  }, [router, searchParams]);

  const handleDeleteFolder = async (id: string) => {
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    await loadAllFolders();
    if (currentFolderId === id) updateFolderSelection(null);
  };

  const handleMoveFolder = async () => {
    if (!currentFolderId) return;

    const parentId = folderMoveTarget === 'ROOT' ? null : folderMoveTarget;
    const res = await fetch(`/api/folders/${currentFolderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '移动文件夹失败');
      return;
    }

    await loadAllFolders();
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('确定删除此文件？')) return;
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    await loadFiles();
  };

  const handleToggleFileSelection = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredFiles.map((file) => file.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedFileIds.includes(id));

    setSelectedFileIds(allVisibleSelected ? [] : visibleIds);
  };

  const handleBatchDeleteFiles = async () => {
    if (selectedFileIds.length === 0) return;
    if (!confirm(`确定删除选中的 ${selectedFileIds.length} 个文件吗？`)) return;

    const res = await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedFileIds }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '批量删除失败');
      return;
    }

    setSelectedFileIds([]);
    await loadFiles();
  };

  const handleBatchMoveFiles = async () => {
    if (selectedFileIds.length === 0) return;

    const targetFolderId = fileMoveTarget === 'ROOT' ? null : fileMoveTarget;
    const res = await fetch('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedFileIds, targetFolderId }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '批量移动失败');
      return;
    }

    setSelectedFileIds([]);
    await loadFiles();
  };

  const openFile = (fileId: string, mode?: 'edit') => {
    const params = new URLSearchParams();
    if (mode) {
      params.set('mode', mode);
    }
    if (currentFolderId) {
      params.set('folderId', currentFolderId);
    }

    router.push(params.toString() ? `/files/${fileId}?${params.toString()}` : `/files/${fileId}`);
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
  const flatFolders = flattenTree(folders);
  const currentFolderDescendantIds = currentFolderId ? getDescendantIds(currentFolderId, flatFolders) : [];
  const folderMoveOptions = flatFolders.filter(
    (folder) => folder.id !== currentFolderId && !currentFolderDescendantIds.includes(folder.id)
  );
  const allVisibleSelected = filteredFiles.length > 0 && filteredFiles.every((file) => selectedFileIds.includes(file.id));

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

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">
              👤 {session.user?.name}
            </span>
            <button
              onClick={() => router.push('/account')}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              修改密码
            </button>
            {session.user?.role === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin/users')}
                className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                用户管理
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              退出
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden px-4 pb-3 space-y-2">
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-gray-500 whitespace-nowrap">👤 {session.user?.name}</span>
            <button
              onClick={() => router.push('/account')}
              className="px-3 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg whitespace-nowrap"
            >
              修改密码
            </button>
            {session.user?.role === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin/users')}
                className="px-3 py-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg whitespace-nowrap"
              >
                用户管理
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-3 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg whitespace-nowrap"
            >
              退出
            </button>
          </div>
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
              onFolderSelect={updateFolderSelection}
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

              <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setShowNewFile(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <span>+</span> 新建文件
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <span>↑</span> 上传文件
                </button>
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  <span>📁</span> 新建文件夹
                </button>
              </div>
            </div>

            {currentFolderId && (
              <div className="bg-white rounded-xl border p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="text-sm font-medium text-gray-700 min-w-0">移动当前文件夹</div>
                <select
                  value={folderMoveTarget}
                  onChange={(e) => setFolderMoveTarget(e.target.value)}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="ROOT">根目录</option>
                  {folderMoveOptions.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.path}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleMoveFolder}
                  className="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"
                >
                  移动文件夹
                </button>
              </div>
            )}

            {filteredFiles.length > 0 && (
              <div className="bg-white rounded-xl border p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-gray-300"
                  />
                  全选当前列表
                </label>
                <span className="text-sm text-gray-500">已选 {selectedFileIds.length} 个文件</span>
                <select
                  value={fileMoveTarget}
                  onChange={(e) => setFileMoveTarget(e.target.value)}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm lg:ml-auto"
                >
                  <option value="ROOT">移动到根目录</option>
                  {flatFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.path}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBatchMoveFiles}
                  disabled={selectedFileIds.length === 0}
                  className="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium disabled:opacity-50"
                >
                  批量移动
                </button>
                <button
                  onClick={handleBatchDeleteFiles}
                  disabled={selectedFileIds.length === 0}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  批量删除
                </button>
              </div>
            )}

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
                    <div className="px-4 pt-4">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          onChange={() => handleToggleFileSelection(file.id)}
                          className="rounded border-gray-300"
                        />
                        选择
                      </label>
                    </div>
                    <div
                      className="p-4 pt-2 cursor-pointer"
                      onClick={() => openFile(file.id)}
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
                        onClick={() => openFile(file.id)}
                        className="flex-1 py-2.5 text-sm sm:text-xs text-blue-600 hover:bg-blue-50 rounded-bl-xl"
                      >
                        查看
                      </button>
                      <button
                        onClick={() => openFile(file.id, 'edit')}
                        className="flex-1 py-2.5 text-sm sm:text-xs text-green-600 hover:bg-green-50 border-l"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="flex-1 py-2.5 text-sm sm:text-xs text-red-500 hover:bg-red-50 rounded-br-xl border-l"
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
          onSuccess={(id) => openFile(id, 'edit')}
        />
      )}
    </div>
  );
}
