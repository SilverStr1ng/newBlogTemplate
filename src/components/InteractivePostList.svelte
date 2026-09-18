<script lang="ts">
  import { Search, X, Hash } from '@lucide/svelte';

  interface PostItem {
    id: string;
    title: string;
    description: string;
    pubDate: string;
    tags: string[];
    readTime?: string;
  }

  interface Props {
    posts: PostItem[];
    allTags: string[];
  }

  let { posts = [], allTags = [] }: Props = $props();

  let selectedTag = $state('');
  let searchQuery = $state('');

  const filteredPosts = $derived(
    posts.filter((p) => {
      const matchTag = !selectedTag || p.tags.includes(selectedTag);
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchTag && matchSearch;
    })
  );

  function formatDate(iso: string) {
    return iso.slice(0, 10).replace(/-/g, '.');
  }
</script>

<div class="space-y-6">
  <!-- Minimal Search & Tags Row -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
    <div class="relative flex-1 max-w-xs">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      <input
        type="text"
        placeholder="搜索文章..."
        bind:value={searchQuery}
        class="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors font-mono"
      />
      {#if searchQuery}
        <button
          onclick={() => (searchQuery = '')}
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <X class="w-3 h-3" />
        </button>
      {/if}
    </div>

    <!-- Tags -->
    <div class="flex flex-wrap items-center gap-1 text-xs font-mono">
      {#each allTags as tag}
        <button
          onclick={() => (selectedTag = selectedTag === tag ? '' : tag)}
          class={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
            selectedTag === tag
              ? 'bg-sky-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          #{tag}
        </button>
      {/each}
    </div>
  </div>

  <!-- Minimal List -->
  <div class="divide-y divide-slate-900/90">
    {#each filteredPosts as post (post.id)}
      <a
        href={`/posts/${post.id}`}
        class="group flex items-baseline justify-between gap-4 py-3.5 hover:border-slate-800 transition-colors"
      >
        <div class="flex items-baseline gap-4 sm:gap-6 min-w-0">
          <time class="text-xs font-mono text-slate-400 shrink-0 select-none">
            {formatDate(post.pubDate)}
          </time>
          <span class="text-sm sm:text-base text-slate-300 font-normal group-hover:text-sky-300 transition-colors truncate">
            {post.title}
          </span>
        </div>

        <div class="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-400">
          {#if post.tags[0]}
            <span class="hidden sm:inline text-slate-400">
              #{post.tags[0]}
            </span>
          {/if}
          <span class="text-slate-400">
            {post.readTime || '5 min'}
          </span>
        </div>
      </a>
    {/each}
  </div>

  {#if filteredPosts.length === 0}
    <div class="py-12 text-center text-slate-600 font-mono text-xs">
      未找到匹配文章
    </div>
  {/if}
</div>
