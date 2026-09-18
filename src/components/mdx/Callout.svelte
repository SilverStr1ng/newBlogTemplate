<script lang="ts">
  import { Info, Sparkles, AlertTriangle, Lightbulb } from '@lucide/svelte';

  interface Props {
    type?: 'info' | 'tip' | 'warning' | 'optics';
    title?: string;
    children?: any;
  }

  let { type = 'info', title = '', children }: Props = $props();

  const configs = {
    info: {
      border: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
      icon: Info,
      iconColor: 'text-sky-400',
      defaultTitle: 'NOTE',
    },
    tip: {
      border: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
      icon: Lightbulb,
      iconColor: 'text-emerald-400',
      defaultTitle: 'PRO TIP',
    },
    warning: {
      border: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      defaultTitle: 'GPU WARNING',
    },
    optics: {
      border: 'border-purple-500/30 bg-purple-500/5 text-purple-300',
      icon: Sparkles,
      iconColor: 'text-purple-400',
      defaultTitle: 'OPTICS PHENOMENON',
    },
  };

  const current = $derived(configs[type] || configs.info);
</script>

<div class={`my-6 rounded-2xl border p-5 backdrop-blur-sm ${current.border}`}>
  <div class="flex items-center gap-2 mb-2 font-mono text-xs font-semibold tracking-wider">
    {#if type === 'optics'}
      <Sparkles class="w-4 h-4 {current.iconColor}" />
    {:else if type === 'tip'}
      <Lightbulb class="w-4 h-4 {current.iconColor}" />
    {:else if type === 'warning'}
      <AlertTriangle class="w-4 h-4 {current.iconColor}" />
    {:else}
      <Info class="w-4 h-4 {current.iconColor}" />
    {/if}
    <span>{title || current.defaultTitle}</span>
  </div>
  <div class="text-sm leading-relaxed text-slate-300 font-normal">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
