'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  children?: FolderNode[];
}

interface FileNode {
  id: string;
  name: string;
  folderId: string | null;
}

interface FileTreeProps {
  folders: FolderNode[];
  files: FileNode[];
  currentFolderId?: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onDeleteFolder?: (id: string) => void;
}

function FolderItem({
  folder,
  level,
  currentFolderId,
  onFolderSelect,
  onDeleteFolder,
}: {
  folder: FolderNode;
  level: number;
  currentFolderId?: string | null;
  onFolderSelect: (id: string | null) => void;
  onDeleteFolder?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = currentFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group text-sm ${
          isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${(level + 1) * 12}px` }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0"
        >
          {hasChildren ? (open ? '▼' : '▶') : ' '}
        </button>
        <span
          onClick={() => onFolderSelect(folder.id)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <span>{open ? '📂' : '📁'}</span>
          <span className="truncate">{folder.name}</span>
        </span>
        {onDeleteFolder && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`确定删除文件夹 "${folder.name}" 及其所有内容？`)) {
                onDeleteFolder(folder.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 flex-shrink-0"
          >
            ✕
          </button>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              currentFolderId={currentFolderId}
              onFolderSelect={onFolderSelect}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  folders,
  currentFolderId,
  onFolderSelect,
  onDeleteFolder,
}: FileTreeProps) {
  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <div className="text-sm">
      <div
        onClick={() => onFolderSelect(null)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm font-medium mb-1 ${
          currentFolderId === null || currentFolderId === undefined
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        <span>🏠</span>
        <span>根目录</span>
      </div>

      {rootFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          level={0}
          currentFolderId={currentFolderId}
          onFolderSelect={onFolderSelect}
          onDeleteFolder={onDeleteFolder}
        />
      ))}
    </div>
  );
}
