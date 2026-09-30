import { useCallback, useRef, useState } from "react";
import { createElement } from "./elementDefaults.js";

const HISTORY_LIMIT = 50;

const emptyFrame = (canvas) => ({
  name: "Untitled Frame",
  width: canvas.width,
  height: canvas.height,
  aspectRatio: canvas.id || "custom",
  background: { type: "color", value: "#eef2ff", fileId: "" },
  elements: [],
});

export function useFrameEditor(initialFrame) {
  const [frame, setFrameState] = useState(initialFrame);
  const [selectedId, setSelectedId] = useState(null);
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const commit = useCallback((updater, { record = true } = {}) => {
    setFrameState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (record) {
        historyRef.current = [...historyRef.current, prev].slice(-HISTORY_LIMIT);
        futureRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    setFrameState((prev) => {
      const previous = historyRef.current[historyRef.current.length - 1];
      historyRef.current = historyRef.current.slice(0, -1);
      futureRef.current = [prev, ...futureRef.current].slice(0, HISTORY_LIMIT);
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(true);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setFrameState((prev) => {
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      historyRef.current = [...historyRef.current, prev].slice(-HISTORY_LIMIT);
      setCanRedo(futureRef.current.length > 0);
      setCanUndo(true);
      return next;
    });
  }, []);

  const setFrameMeta = useCallback((patch) => commit((f) => ({ ...f, ...patch })), [commit]);

  // Updater functions passed to commit()/setFrameState must stay pure (React
  // may invoke them more than once, e.g. under StrictMode) — so the new
  // element is created up front, outside the updater, and selection is set
  // as a separate, ordinary state update afterward.
  const addElement = useCallback(
    (type) => {
      const el = createElement(type, frame);
      commit((f) => ({ ...f, elements: [...f.elements, el] }));
      setSelectedId(el.id);
    },
    [commit, frame]
  );

  const addImageElement = useCallback(
    (src) => {
      const el = createElement("image", frame);
      el.src = src;
      commit((f) => ({ ...f, elements: [...f.elements, el] }));
      setSelectedId(el.id);
    },
    [commit, frame]
  );

  const addVariableElement = useCallback(
    (variableKey, x, y) => {
      const el = createElement("text", frame);
      el.content = `{{${variableKey}}}`;
      el.name = variableKey;
      el.width = 320;
      el.height = 50;
      el.x = Math.round(Math.max(0, Math.min(frame.width - el.width, x - el.width / 2)));
      el.y = Math.round(Math.max(0, Math.min(frame.height - el.height, y - el.height / 2)));
      commit((f) => ({ ...f, elements: [...f.elements, el] }));
      setSelectedId(el.id);
    },
    [commit, frame]
  );

  const updateElement = useCallback(
    (id, patch, { record = true } = {}) => {
      commit(
        (f) => ({ ...f, elements: f.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) }),
        { record }
      );
    },
    [commit]
  );

  const removeElement = useCallback(
    (id) => {
      commit((f) => ({ ...f, elements: f.elements.filter((el) => el.id !== id) }));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [commit]
  );

  const duplicateElement = useCallback(
    (id) => {
      commit((f) => {
        const source = f.elements.find((el) => el.id === id);
        if (!source) return f;
        const copy = { ...source, id: `${source.type}-${Date.now().toString(36)}`, x: source.x + 20, y: source.y + 20 };
        setSelectedId(copy.id);
        return { ...f, elements: [...f.elements, copy] };
      });
    },
    [commit]
  );

  const moveLayer = useCallback(
    (id, direction) => {
      commit((f) => {
        const idx = f.elements.findIndex((el) => el.id === id);
        if (idx === -1) return f;
        const swapWith = direction === "up" ? idx + 1 : idx - 1;
        if (swapWith < 0 || swapWith >= f.elements.length) return f;
        const next = [...f.elements];
        [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
        return { ...f, elements: next };
      });
    },
    [commit]
  );

  const reorderElements = useCallback(
    (fromId, toId) => {
      commit((f) => {
        const from = f.elements.findIndex((el) => el.id === fromId);
        const to = f.elements.findIndex((el) => el.id === toId);
        if (from === -1 || to === -1 || from === to) return f;
        const next = [...f.elements];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...f, elements: next };
      });
    },
    [commit]
  );

  return {
    frame,
    selectedId,
    setSelectedId,
    setFrameMeta,
    addElement,
    addImageElement,
    addVariableElement,
    updateElement,
    removeElement,
    duplicateElement,
    moveLayer,
    reorderElements,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export { emptyFrame };
