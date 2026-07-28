import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCustomAvatarsStore } from '../customAvatarsStore'
import { useSettingsStore } from '../settingsStore'
import type { CustomAvatarsSnapshot } from '../../../types/customAvatars'

const baseSnapshot = (): CustomAvatarsSnapshot => ({
  avatars: [
    {
      id: 'custom:Galaxy',
      name: 'Galaxy',
      folderName: 'Galaxy',
      source: 'custom',
      stateVideos: {
        speaking: 'leshine-avatar://Galaxy/speaking.mp4',
        thinking: 'leshine-avatar://Galaxy/thinking.mp4',
        standby: 'leshine-avatar://Galaxy/standby.mp4',
      },
      previewVideo: 'leshine-avatar://Galaxy/standby.mp4',
    },
  ],
  customizationRoot: '/tmp/user-customization/custom-avatars',
})

function installMockAPI(override?: Partial<CustomAvatarsSnapshot>) {
  const snap = { ...baseSnapshot(), ...override }
  const api = {
    list: vi.fn().mockResolvedValue({ success: true, data: snap }),
    refresh: vi.fn().mockResolvedValue({ success: true, data: snap }),
  }
  ;(globalThis as any).window = {
    customAvatarsAPI: api,
  }
  return api
}

describe('useCustomAvatarsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).window
  })

  it('loads custom avatars and merges with built-in avatar', async () => {
    const api = installMockAPI()
    const store = useCustomAvatarsStore()

    await store.ensureInitialized()

    expect(api.list).toHaveBeenCalledTimes(1)
    expect(store.customAvatars).toHaveLength(1)
    expect(store.allAvatars).toHaveLength(2)
    expect(store.activeAvatarId).toBe('leshine')
  })

  it('tracks selected avatar from settings store', async () => {
    installMockAPI()
    const settingsStore = useSettingsStore()
    const store = useCustomAvatarsStore()

    await store.ensureInitialized()
    settingsStore.settings.assistantAvatar = 'custom:Galaxy'

    expect(store.activeAvatar.id).toBe('custom:Galaxy')
    expect(store.activeAvatar.stateVideos.standby).toContain(
      'Galaxy/standby.mp4'
    )
  })

  it('refresh updates snapshot and exposes errors', async () => {
    const api = installMockAPI()
    const store = useCustomAvatarsStore()
    await store.ensureInitialized()

    const updatedSnapshot = baseSnapshot()
    updatedSnapshot.avatars.push({
      id: 'custom:Neon',
      name: 'Neon',
      folderName: 'Neon',
      source: 'custom',
      stateVideos: {
        speaking: 'leshine-avatar://Neon/speaking.mp4',
        thinking: 'leshine-avatar://Neon/thinking.mp4',
        standby: 'leshine-avatar://Neon/standby.mp4',
      },
      previewVideo: 'leshine-avatar://Neon/standby.mp4',
    })
    api.refresh.mockResolvedValue({ success: true, data: updatedSnapshot })

    await store.refresh()

    expect(store.customAvatars).toHaveLength(2)

    api.refresh.mockResolvedValue({
      success: false,
      error: 'Unable to scan avatars',
    })

    await expect(store.refresh()).rejects.toThrow()
    expect(store.error).toBe('Unable to scan avatars')
  })
})
