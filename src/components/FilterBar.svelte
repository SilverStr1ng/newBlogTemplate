<script lang="ts">
  import { Search, Hash, X } from '@lucide/svelte';

  interface Props {
    allTags: string[];
    selectedTag?: string;
    onSelectTag?: (tag: string) => void;
    onSearch?: (query: string) => void;
  }

  let { allTags = [], selectedTag = '', onSelectTag, onSearch }: Props = $props();

  let searchQuery = $state('');

  function handleTagClick(tag: string) {
    if (onSelectTag) {
      onSelectTag(selectedTag === tag ? '' : tag);
    }
  }

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchQuery = val;
    if (onSearch) onSearch(val);
  }
</script>

<div class="mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
  <!-- Search input -->
  <div class="relative flex-1 max-w-md">
    <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
    <input
      type="text"
      placeholder="搜索标题、关键词或着色器..."
      value={searchQuery}
      oninput={handleInput}
      class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-all font-sans"
    />
    {#if searchQuery}
      <button
        onclick={() => {
          searchQuery = '';
          if (onSearch) onSearch('');
        }}
        class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
      >
        <X class="w-4 h-4" />
      </button>
    {/if}
  </div>

  <!-- Tags Pill Row -->
  <div class="flex flex-wrap items-center gap-1.5 text-xs font-mono">
    {#each allTags as tag}
      <button
        onclick={() => handleTagClick(tag)}
        class={`px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-1 ${
          selectedTag === tag
            ? 'bg-sky-500 text-slate-950 font-semibold shadow-[0_0_12px_rgba(56,189,248,0.4)]'
            : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
        }`}
      >
        <Hash class="w-3 h-3 opacity-60" />
        <span>{tag}</span>
      </button>
    {/each}
  </div>
</div>
