<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let blockId: string;
	export let content: string;
	export let placeholder: string = '';

	const dispatch = createEventDispatcher<{
		input: { blockId: string; content: string };
		focus: { blockId: string };
		blur: { blockId: string; content: string };
		backspaceatstart: { blockId: string };
	}>();

	let draft = content;
	let textareaEl: HTMLTextAreaElement;

	$: draft = content;

	function onInput(e: Event) {
		draft = (e.target as HTMLTextAreaElement).value;
		autoGrow(e.target as HTMLTextAreaElement);
		dispatch('input', { blockId, content: draft });
	}

	function onFocus() {
		dispatch('focus', { blockId });
	}

	function onBlur() {
		if (draft !== content) {
			dispatch('blur', { blockId, content: draft });
		}
	}

	function onKeydown(e: KeyboardEvent) {
		// Backspace at position 0 of an empty block → merge with previous
		if (e.key === 'Backspace' && textareaEl?.selectionStart === 0 && textareaEl?.selectionEnd === 0) {
			if (!draft) {
				e.preventDefault();
				dispatch('backspaceatstart', { blockId });
			}
		}
	}

	function autoGrow(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = Math.max(32, el.scrollHeight) + 'px';
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

	export function focusAtEnd() {
		if (textareaEl) {
			textareaEl.focus();
			textareaEl.selectionStart = textareaEl.value.length;
			textareaEl.selectionEnd = textareaEl.value.length;
		}
	}
</script>

<textarea
	class="text-block"
	value={draft}
	on:input={onInput}
	on:focus={onFocus}
	on:blur={onBlur}
	on:keydown={onKeydown}
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
		min-height: 32px;
		outline: none;
	}

	.text-block::placeholder {
		color: var(--ink-faint);
		font-style: italic;
	}
</style>
