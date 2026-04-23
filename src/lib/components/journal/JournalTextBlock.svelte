<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let blockId: string;
	export let content: string;
	export let placeholder: string = '';

	const dispatch = createEventDispatcher<{
		input: { blockId: string; content: string };
		cursorposition: { blockId: string; cursorPos: number };
	}>();

	let draft = content;
	let textareaEl: HTMLTextAreaElement;

	$: draft = content;

	function onInput(e: Event) {
		draft = (e.target as HTMLTextAreaElement).value;
		autoGrow(e.target as HTMLTextAreaElement);
		dispatch('input', { blockId, content: draft });
	}

	function autoGrow(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = Math.max(48, el.scrollHeight) + 'px';
	}

	function initTextarea(el: HTMLTextAreaElement): { destroy?: () => void } {
		textareaEl = el;
		autoGrow(el);
		return {};
	}

	export function getCursorPosition(): number {
		return textareaEl?.selectionStart ?? draft.length;
	}

	export function focus() {
		textareaEl?.focus();
	}
</script>

<textarea
	class="text-block"
	value={draft}
	on:input={onInput}
	use:initTextarea
	{placeholder}
	rows="1"
></textarea>

<style>
	.text-block {
		width: 100%;
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--ink);
		background: transparent;
		border: none;
		padding: 0.25rem 0;
		resize: none;
		line-height: 1.55;
		min-height: 48px;
		outline: none;
	}

	.text-block::placeholder {
		color: var(--ink-faint);
		font-style: italic;
	}
</style>
