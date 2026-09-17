import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { useDeleteRevisionGroup } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { useSelectionStore } from '@/store/useSelectionStore'

/**
 * 「删除整页」确认框：整组（该页全部版本）一次性删除。
 * 卡片入口和详情入口都只往 nav store 投递 pendingDeleteGroup，
 * 删除逻辑、缓存/勾选/导航收尾统一收敛在这里，避免两处各写一遍。
 */
export function DeleteGroupDialog() {
  const target = useNavStore((s) => s.pendingDeleteGroup)
  const clearDeleteGroup = useNavStore((s) => s.clearDeleteGroup)
  const deleteGroup = useDeleteRevisionGroup()

  function confirm() {
    if (!target || deleteGroup.isPending) return
    const { groupId } = target
    deleteGroup.mutate(groupId, {
      onSuccess: () => {
        // 导出清单里对这一页的勾选一起清掉
        useSelectionStore.getState().remove(groupId)
        // 正被这一页占用详情/全屏查看时，关掉避免留下空壳
        if (useNavStore.getState().activeGroupId === groupId) {
          useNavStore.getState().closeGroup()
        }
        clearDeleteGroup()
      },
    })
  }

  return (
    <Dialog
      open={target != null}
      onClose={clearDeleteGroup}
      title={`删除页面「${target?.title ?? ''}」？`}
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearDeleteGroup}
            disabled={deleteGroup.isPending}
          >
            取消
          </Button>
          <Button variant="danger" size="sm" onClick={confirm} disabled={deleteGroup.isPending}>
            {deleteGroup.isPending ? '删除中…' : '删除'}
          </Button>
        </>
      }
    >
      <p className="text-caption leading-6 text-mute">
        这一页的全部版本历史会一起移除，导出清单里对它的勾选也会清掉。删除后不能恢复。
      </p>
    </Dialog>
  )
}
