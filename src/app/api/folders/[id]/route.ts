import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
  }

  // Delete all files in folder recursively
  await deleteFolder(id);

  return NextResponse.json({ success: true });
}

async function deleteFolder(folderId: string) {
  const children = await prisma.folder.findMany({ where: { parentId: folderId } });
  for (const child of children) {
    await deleteFolder(child.id);
  }
  await prisma.markdownFile.deleteMany({ where: { folderId } });
  await prisma.folder.delete({ where: { id: folderId } });
}
