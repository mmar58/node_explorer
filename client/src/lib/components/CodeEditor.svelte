<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import 'monaco-editor/min/vs/editor/editor.main.css';

	type MonacoEditor = import('monaco-editor').editor.IStandaloneCodeEditor;
	type MonacoModule = typeof import('monaco-editor');

	export let value = '';
	export let language = 'plaintext';
	export let readOnly = false;
	export let onChange: (value: string) => void = () => {};

	let container: HTMLDivElement;
	let editor: MonacoEditor | null = null;
	let monaco: MonacoModule | null = null;
	let applyingExternalValue = false;

	$: if (editor && value !== editor.getValue()) {
		applyingExternalValue = true;
		editor.setValue(value);
		applyingExternalValue = false;
	}

	$: if (editor) {
		editor.updateOptions({ readOnly });
	}

	$: if (monaco && editor) {
		const model = editor.getModel();

		if (model) {
			monaco.editor.setModelLanguage(model, language);
		}
	}

	onMount(() => {
		let cleanup = () => {};

		void (async () => {
			monaco = await import('monaco-editor');
			editor = monaco.editor.create(container, {
				value,
				language,
				automaticLayout: true,
				minimap: { enabled: false },
				theme: 'vs-dark',
				fontSize: 14,
				readOnly,
				wordWrap: 'on',
				scrollBeyondLastLine: false,
				tabSize: 2
			});

			const disposable = editor.onDidChangeModelContent(() => {
				if (applyingExternalValue || !editor) {
					return;
				}

				onChange(editor.getValue());
			});

			cleanup = () => {
				disposable.dispose();
				editor?.dispose();
			};
		})();

		return () => cleanup();
	});
</script>

<div bind:this={container} class="editor"></div>

<style>
	.editor {
		height: 100%;
		min-height: 360px;
	}
</style>