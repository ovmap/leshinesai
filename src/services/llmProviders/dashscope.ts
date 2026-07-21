import type OpenAI from 'openai'
import { getDashScopeClient } from '../apiClients'
import { useSettingsStore } from '../../stores/settingsStore'
import { createProviderModel, listModelsViaMainProcess } from './modelDiscovery'
import { createOpenAICompatibleResponse } from './openAICompatible'
import {
  DASHSCOPE_OPENAI_BASE_URL,
  DASHSCOPE_TEXT_MODELS,
} from './providerCatalog'

function createDashScopeModel(id: string): OpenAI.Models.Model {
  return createProviderModel(id, 'dashscope')
}

function listStaticDashScopeTextModels(): OpenAI.Models.Model[] {
  return DASHSCOPE_TEXT_MODELS.map(model => createDashScopeModel(model.id))
}

function isAuthError(error: any): boolean {
  return error?.status === 401 || error?.status === 403
}

function filterDashScopeTextModels(
  models: OpenAI.Models.Model[]
): OpenAI.Models.Model[] {
  const textModelIds = new Set(DASHSCOPE_TEXT_MODELS.map(model => model.id))
  return models.filter(model => textModelIds.has(model.id))
}

export async function listDashScopeModelsForConfig(
  apiKey: string,
  baseURL = DASHSCOPE_OPENAI_BASE_URL
): Promise<OpenAI.Models.Model[]> {
  try {
    const models = await listModelsViaMainProcess({
      apiKey,
      baseURL,
      providerName: 'DashScope',
    })
    const textModels = filterDashScopeTextModels(models)
    return textModels.length > 0 ? textModels : listStaticDashScopeTextModels()
  } catch (error) {
    if (isAuthError(error)) {
      throw error
    }
    return listStaticDashScopeTextModels()
  }
}

export const listDashScopeModels = async (): Promise<OpenAI.Models.Model[]> => {
  const settings = useSettingsStore().config
  return listDashScopeModelsForConfig(
    settings.VITE_DASHSCOPE_API_KEY || '',
    settings.dashscopeBaseUrl || DASHSCOPE_OPENAI_BASE_URL
  )
}

export const createDashScopeResponse = async (
  input: OpenAI.Responses.Request.InputItemLike[],
  _previousResponseId: string | null,
  stream: boolean = false,
  customInstructions?: string,
  signal?: AbortSignal
): Promise<any> => {
  return createOpenAICompatibleResponse(
    'dashscope',
    getDashScopeClient,
    input,
    stream,
    customInstructions,
    signal
  )
}
