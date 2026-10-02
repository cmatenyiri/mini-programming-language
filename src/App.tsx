import { Alert, Box, Snackbar, useMediaQuery } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AppHeader } from './components/AppHeader';
import { EditorPane } from './components/EditorPane';
import { InsightPanel, type PanelTab } from './components/InsightPanel';
import { PipelineBar } from './components/PipelineBar';
import { StatusBar } from './components/StatusBar';
import { DocsDrawer } from './docs/DocsDrawer';
import type { CursorInfo, LumenEditorHandle } from './editor/LumenEditor';
import { DEFAULT_EXAMPLE, type Example } from './examples/examples';
import { useAnalysis } from './hooks/useAnalysis';
import { useRunner } from './hooks/useRunner';
import type { Diagnostic, Span } from './lumen/diagnostics';
import { analyze } from './lumen/index';
import {
  buildShareUrl,
  clearShareHash,
  loadFileName,
  loadSavedCode,
  loadSharedCode,
  saveCode,
  saveFileName,
  setTutorialHiddenOnStartup,
  tutorialHiddenOnStartup,
} from './storage';
import { colors } from './theme/tokens';
import { Tutorial } from './tutorial/Tutorial';

interface InitialState {
  code: string;
  fileName: string;
  exampleId?: string;
}

function getInitialState(): InitialState {
  const shared = loadSharedCode();
  if (shared) return { code: shared, fileName: 'shared.lum' };
  const saved = loadSavedCode();
  if (saved !== null) return { code: saved, fileName: loadFileName() ?? 'main.lum' };
  return { code: DEFAULT_EXAMPLE.code, fileName: 'welcome.lum', exampleId: DEFAULT_EXAMPLE.id };
}

export default function App() {
  const [initial] = useState(getInitialState);
  const editorRef = useRef<LumenEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState(initial.code);
  const [fileName, setFileName] = useState(initial.fileName);
  const [exampleId, setExampleId] = useState(initial.exampleId);
  const [tab, setTab] = useState<PanelTab>('output');
  const [cursor, setCursor] = useState<CursorInfo>({ pos: 0, line: 1, column: 1, selected: 0 });
  const [tutorialOpen, setTutorialOpen] = useState(() => !tutorialHiddenOnStartup());
  const [docsOpen, setDocsOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    severity: 'success' | 'info' | 'error';
  } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [ranSource, setRanSource] = useState<string | null>(null);

  const { analysis, lastChecked } = useAnalysis(code);
  const runner = useRunner();
  const narrow = useMediaQuery('(max-width: 900px)');

  // Autosave to this browser.
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveCode(code);
      saveFileName(fileName);
      setSavedAt(Date.now());
    }, 500);
    return () => window.clearTimeout(id);
  }, [code, fileName]);

  // A shared link is loaded once; afterwards the URL is cleaned so edits are not confused with it.
  useEffect(() => {
    clearShareHash();
  }, []);

  const runtimeError = runner.summary?.error;
  const diagnostics = useMemo<Diagnostic[]>(() => {
    const list = [...analysis.diagnostics];
    if (runtimeError && ranSource === code) {
      list.push({
        severity: 'error',
        phase: 'runtime',
        message: runtimeError.message,
        span: runtimeError.span,
      });
    }
    return list.sort((a, b) => a.span.start - b.span.start);
  }, [analysis.diagnostics, runtimeError, ranSource, code]);

  const getAnalysis = useCallback(() => {
    return analysis.check ? analysis : lastChecked.current;
  }, [analysis, lastChecked]);

  const run = useCallback(() => {
    const source = editorRef.current?.getValue() ?? code;
    const ok = source === analysis.source ? analysis.ok : analyze(source).ok;
    setRanSource(source);
    runner.run(source);
    setTab(ok ? 'output' : 'problems');
  }, [analysis, code, runner]);

  // Global shortcut (also works when the editor is not focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !tutorialOpen && !e.defaultPrevented) {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, tutorialOpen]);

  const loadCode = useCallback(
    (value: string, name: string, id?: string) => {
      editorRef.current?.setValue(value);
      setCode(value);
      setFileName(name);
      setExampleId(id);
      runner.clear();
      setRanSource(null);
      editorRef.current?.focus();
    },
    [runner],
  );

  const onExample = useCallback(
    (example: Example) => loadCode(example.code, `${example.id}.lum`, example.id),
    [loadCode],
  );

  const tryCode = useCallback(
    (snippet: string, name = 'snippet.lum') => {
      loadCode(snippet, name);
      setTutorialOpen(false);
      setDocsOpen(false);
      setTab('output');
    },
    [loadCode],
  );

  const onShare = useCallback(async () => {
    const url = buildShareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setToast({
        message: 'Share link copied — the code is embedded in the link itself.',
        severity: 'success',
      });
    } catch {
      window.prompt('Copy this link to share your program:', url);
    }
  }, [code]);

  const onDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.lum') ? fileName : `${fileName}.lum`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, fileName]);

  const onFileChosen = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const text = await file.text();
      loadCode(text, file.name);
      setToast({ message: `Opened ${file.name}`, severity: 'info' });
    },
    [loadCode],
  );

  const onSave = useCallback(() => {
    saveCode(editorRef.current?.getValue() ?? code);
    setSavedAt(Date.now());
    setToast({
      message: 'Saved in this browser. Use Download to get a .lum file.',
      severity: 'success',
    });
  }, [code]);

  const jump = useCallback((span: Span) => editorRef.current?.reveal(span), []);
  const hover = useCallback((span: Span | null) => editorRef.current?.flash(span), []);

  const closeTutorial = useCallback((hideOnStartup: boolean) => {
    setTutorialHiddenOnStartup(hideOnStartup);
    setTutorialOpen(false);
    window.setTimeout(() => editorRef.current?.focus(), 50);
  }, []);

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AppHeader
        running={runner.status === 'running'}
        currentExampleId={exampleId}
        onRun={run}
        onStop={runner.stop}
        onExample={onExample}
        onShare={onShare}
        onOpenFile={() => fileInputRef.current?.click()}
        onDownload={onDownload}
        onDocs={() => setDocsOpen(true)}
        onTutorial={() => setTutorialOpen(true)}
      />
      <PipelineBar
        analysis={analysis}
        runStatus={runner.status}
        summary={runner.summary}
        onSelect={setTab}
      />

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Group orientation={narrow ? 'vertical' : 'horizontal'} key={narrow ? 'v' : 'h'}>
          <Panel defaultSize="56" minSize="22">
            <EditorPane
              editorRef={editorRef}
              fileName={fileName}
              initialValue={initial.code}
              diagnostics={diagnostics}
              getAnalysis={getAnalysis}
              onChange={setCode}
              onCursor={setCursor}
              onRun={run}
              onSave={onSave}
            />
          </Panel>
          <Separator
            className={
              narrow ? 'lumen-separator lumen-separator-v' : 'lumen-separator lumen-separator-h'
            }
          />
          <Panel defaultSize="44" minSize="20">
            <Box sx={{ height: '100%', background: 'rgba(10, 11, 18, 0.55)' }}>
              <InsightPanel
                tab={tab}
                onTab={setTab}
                analysis={analysis}
                diagnostics={diagnostics}
                cursor={cursor.pos}
                run={runner}
                onJump={jump}
                onHover={hover}
              />
            </Box>
          </Panel>
        </Group>
      </Box>

      <StatusBar
        analysis={getAnalysis()}
        diagnostics={diagnostics}
        cursor={cursor}
        savedAt={savedAt}
        onProblems={() => setTab('problems')}
      />

      <Tutorial open={tutorialOpen} onClose={closeTutorial} onTry={tryCode} />
      <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} onTry={tryCode} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".lum,text/plain"
        hidden
        onChange={(e) => {
          void onFileChosen(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={3200}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 3 }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{
              background: colors.surface4,
              color: colors.text,
              border: `1px solid ${colors.borderStrong}`,
              boxShadow: '0 20px 50px -12px rgba(0,0,0,0.8)',
              '& .MuiAlert-icon': { color: toast.severity === 'error' ? colors.red : colors.green },
            }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
