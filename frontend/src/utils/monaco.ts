import type * as Monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
// Only the diff worker is needed: models are previews, not a language server.
let loaded:Promise<typeof Monaco>|undefined;
export function loadMonaco(){return loaded??=import('monaco-editor/editor/editor.api').then(async monaco=>{
  (globalThis as typeof globalThis&{MonacoEnvironment?:Monaco.Environment}).MonacoEnvironment={getWorker:()=>new EditorWorker()};
  await import('monaco-editor/languages/definitions/_.contribution');
  monaco.editor.defineTheme('ares-review',{base:'vs-dark',inherit:true,rules:[],colors:{'editor.background':'#081318','editor.foreground':'#c7dce0','editorLineNumber.foreground':'#546e75','editorLineNumber.activeForeground':'#a9e6cf','editorGutter.background':'#081318','editor.lineHighlightBackground':'#112822','diffEditor.insertedTextBackground':'#2fe49b30','diffEditor.removedTextBackground':'#f25a7430','diffEditor.insertedLineBackground':'#153b2b66','diffEditor.removedLineBackground':'#43212b77','diffEditor.border':'#29443d','scrollbarSlider.background':'#34584b88','scrollbarSlider.hoverBackground':'#4e806d99'}});
  return monaco;
}).catch(error=>{loaded=undefined;throw error;});}
export function codeLanguage(path:string){const extension=path.split('.').at(-1)?.toLowerCase();return({ts:'typescript',tsx:'typescript',js:'javascript',jsx:'javascript',mjs:'javascript',cjs:'javascript',vue:'html',html:'html',css:'css',scss:'scss',py:'python',sql:'sql',md:'markdown',yaml:'yaml',yml:'yaml',json:'json',java:'java',cs:'csharp',go:'go',rs:'rust'}as Record<string,string>)[extension??'']??'plaintext';}
