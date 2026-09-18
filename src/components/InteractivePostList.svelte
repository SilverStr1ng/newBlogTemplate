<script lang="ts">
  import FilterBar from './FilterBar.svelte';

  interface PostItem {
    id: string;
    title: string;
    description: string;
    pubDate: string;
    tags: string[];
    readTime?: string;
    featured?: boolean;
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
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchTag && matchSearch;
    })
  );

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  }
</script>

<div>
  <!-- Search and Tag filter -->
  <FilterBar
    {allTags}
    {selectedTag}
    onSelectTag={(t) => (selectedTag = t)}
    onSearch={(q) => (searchQuery = q)}
  />

  <!-- Results Count -->
  <div class="mb-6 flex items-center justify-between text-xs font-mono text-slate-500">
    <span>FOUND {filteredPosts.length} ARTICLE{filteredPosts.length === 1 ? '' : 'S'}</span>
    {#if selectedTag || searchQuery}
      <button
        onclick={() => {
          selectedTag = '';
          searchQuery = '';
        }}
        class="text-sky-400 hover:underline cursor-pointer"
      >
        RESET FILTERS
      </button>
    {/if}
  </div>

  <!-- Posts Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    {#each filteredPosts as post (post.id)}
      <article class="group relative rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80 p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between">
        <div class="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        <div class="relative z-10">
          <!-- Meta row -->
          <div class="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400 mb-3">
            <time>{formatDate(post.pubDate)}</time>
            <span class="text-slate-700">•</span>
            <span>{post.readTime || '5 min read'}</span>
            {#if post.featured}
              <span class="text-slate-700">•</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                FEATURED
              </span>
            {/if}
          </div>

          <!-- Title -->
          <h3 class="text-xl font-bold text-slate-100 group-hover:text-sky-300 transition-colors leading-snug">
            <a href={`/posts/${post.id}`}>
              {post.title}
            </a>
          </h3>

          <!-- Description -->
          <p class="mt-2.5 text-sm text-slate-400 line-clamp-2 leading-relaxed">
            {post.description}
          </p>
        </div>

        <!-- Tags -->
        <div class="relative z-10 mt-6 pt-4 border-t border-slate-800/50 flex flex-wrap items-center gap-1.5">
          {#each post.tags as tag}
            <button
              onclick={(e) => {
                e.stopPropagation();
                selectedTag = tag;
              }}
              class="text-[11px] font-mono text-slate-400 bg-slate-800/60 hover:bg-slate-800 hover:text-sky-300 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              #{tag}
            </button>
          {/each}
        </div>
      </article>
    {/each}
  </div>

  {#if filteredPosts.length === 0}
    <div class="py-16 text-center text-slate-500 font-mono text-sm border border-dashed border-slate-800 rounded-2xl">
      NO MATCHING ARTICLES FOUND. TRY CLEARING FILTERS.
    </div>
  {/if}
</div>
