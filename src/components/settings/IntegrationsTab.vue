<template>
  <div class="space-y-6">
    <h3 class="text-xl font-semibold mb-4 text-purple-400">
      Integrations & APIs
    </h3>

    <fieldset
      class="fieldset bg-gray-900 border-cyan-500/50 rounded-box w-full border p-4"
    >
      <legend class="fieldset-legend">Remote MCP Servers</legend>
      <div class="p-2 space-y-4">
        <div>
          <label for="mcp-servers-config" class="block mb-1 text-sm">
            MCP Servers JSON Configuration (Array)
          </label>
          <textarea
            id="mcp-servers-config"
            v-model="currentSettings.mcpServersConfig"
            rows="10"
            class="textarea textarea-bordered w-full focus:textarea-primary h-60 bg-gray-800"
            :placeholder="mcpPlaceholder"
          ></textarea>
          <p class="text-xs text-gray-400 mt-1">
            Enter a JSON array of MCP server configurations. Each object should
            follow the
            <a
              href="https://cookbook.openai.com/examples/mcp/mcp_tool_guide"
              target="_blank"
              class="link link-hover"
              >OpenAI MCP tool format</a
            >.
          </p>
        </div>
      </div>
    </fieldset>

    <fieldset
      class="fieldset bg-gray-900 border-gray-600/50 rounded-box w-full border p-4"
    >
      <legend class="fieldset-legend">Web Search API</legend>
      <div class="p-2">
        <div
          v-if="currentSettings.assistantTools.includes('perform_web_search')"
        >
          <label for="metaso-key" class="block mb-1 text-sm"
            >Metaso API Key (秘塔网页搜索)</label
          >
          <input
            id="metaso-key"
            type="password"
            v-model="currentSettings.VITE_METASO_API_KEY"
            class="input focus:outline-none w-full"
            autocomplete="new-password"
            placeholder="mk-..."
          />
          <p class="text-xs text-gray-400 mt-1">
            国内可用的网页搜索 API。获取 API Key:
            <a
              href="https://metaso.cn"
              target="_blank"
              class="link link-primary"
              >Metaso (秘塔)</a
            >.
          </p>
        </div>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { LeshineSettings } from '../../stores/settingsStore'

defineProps<{
  currentSettings: LeshineSettings
}>()

const mcpPlaceholder = `[
  {
    "type": "mcp",
    "server_label": "deepwiki",
    "server_url": "https://mcp.deepwiki.com/mcp",
    "require_approval": "never"
  }
]`
</script>
