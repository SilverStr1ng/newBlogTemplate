<script lang="ts">
  import { Search, X } from '@lucide/svelte';

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
  }

  let { posts = [] }: Props = $props();

  let searchQuery = $state('');

  const filteredPosts = $derived(
    posts.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
  );

  // Group filtered posts by Year
  const groupedByYear = $derived.by(() => {
    const map = new Map<number, PostItem[]>();
    for (const post of filteredPosts) {
      const year = new Date(post.pubDate).getFullYear();
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(post);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}.${day}`;
  }
</script>

<div class="space-y-8">
  <!-- Minimal, Unified Search Input (No Crowded Tags Row) -->
  <div class="flex items-center justify-between gap-4 pb-4 border-b border-zinc-800">
    <div class="relative flex-1 max-w-md">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      <input
        type="text"
        placeholder="搜索文章标题、着色器或技术关键词..."
        bind:value={searchQuery}
        class="w-full pl-10 pr-8 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
      />
      {#if searchQuery}
        <button
          onclick={() => (searchQuery = '')}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          aria-label="Clear search"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      {/if}
    </div>

    <div class="text-xs font-mono text-zinc-500">
      {filteredPosts.length} 篇
    </div>
  </div>

  <!-- Year-Grouped Article List -->
  <div class="space-y-12">
    {#each groupedByYear as [year, yearPosts] (year)}
      <div>
        <div class="text-xs font-mono font-bold text-zinc-500 mb-2 select-none">
          {year}
        </div>
        <div class="divide-y divide-zinc-900/80 border-t border-zinc-900/80">
          {#each yearPosts as post (post.id)}
            <a
              href={`/posts/${post.id}`}
              class="group flex items-baseline justify-between gap-4 py-3.5 hover:border-zinc-800 transition-colors"
            >
              <div class="flex items-baseline gap-4 sm:gap-6 min-w-0">
                <time class="text-xs font-mono text-zinc-500 shrink-0 select-none">
                  {formatDate(post.pubDate)}
                </time>
                <span class="text-sm sm:text-base text-zinc-300 font-normal group-hover:text-white transition-colors truncate">
                  {post.title}
                </span>
              </div>

              <div class="flex items-center gap-3 shrink-0 text-xs font-mono text-zinc-500">
                {#if post.tags[0]}
                  <span class="hidden sm:inline text-zinc-500 group-hover:text-zinc-400 transition-colors">
                    #{post.tags[0]}
                  </span>
                {/if}
                <span>
                  {post.readTime || '5 min'}
                </span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if filteredPosts.length === 0}
    <div class="py-16 text-center text-zinc-600 font-mono text-xs border border-dashed border-zinc-900 rounded-2xl">
      未找到匹配文章
    </div>
  {/if}
</div>
